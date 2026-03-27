<?php

namespace App\Services;

use App\Models\KycDocument;
use App\Models\User;
use App\Notifications\KycApproved;
use App\Notifications\KycRejected;
use App\Notifications\KycNeedsReview;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Services\SellerCategoryService;

class KycAiService
{
    // Minimum score below which we always flag for admin review
    const FLAG_FOR_REVIEW_THRESHOLD = 60;

    // Company documents are more formal — fixed lower threshold
    const COMPANY_BASE_THRESHOLD = 85;

    /**
     * Determine the auto-approve threshold for a user dynamically.
     *
     * Individuals: based on strictest selected seller category
     *   land        → 95%  (strictest  — land fraud is biggest risk in Uganda)
     *   apartment   → 90%  (moderate   — large money involved)
     *   house_rent / short_stay / lodge → 80% (light — low risk)
     *
     * Companies: always 85% (business docs are formal and consistent)
     */
    private function approveThreshold(User $user): int
    {
        if ($user->role === 'company') {
            return self::COMPANY_BASE_THRESHOLD;
        }
        $categories = $user->seller_categories ?? [];
        return SellerCategoryService::kycThreshold($categories);
    }

    // Expected document keywords for each type
    const DOCUMENT_KEYWORDS = [
        'national_id'           => ['uganda', 'national', 'identity', 'card', 'republic'],
        'passport'              => ['passport', 'republic', 'uganda', 'travel'],
        'drivers_licence'       => ['driving', 'licence', 'permit', 'uganda'],
        'business_registration' => ['certificate', 'incorporation', 'registration', 'company',
                                    'uganda registration', 'ursb', 'republic', 'business'],
    ];

    /**
     * Main entry point — called from the queued job.
     * Analyses the document and auto-approves, flags, or rejects.
     */
    public function analyse(KycDocument $document): void
    {
        $document->load('user');

        Log::info("KYC AI analysis started", [
            'document_id' => $document->id,
            'user_id'     => $document->user_id,
            'doc_type'    => $document->document_type,
        ]);

        try {
            // 1. Get image content from Cloudinary URL
            $imageContent = $this->fetchImageAsBase64($document->file_url);

            if (!$imageContent) {
                $this->flagForReview($document, 'Could not retrieve document image for analysis.');
                return;
            }

            // 2. Run Google Vision API
            $visionResult = $this->callGoogleVision($imageContent);

            if (!$visionResult) {
                // Vision API failed — don't auto-reject, send to admin
                $this->flagForReview($document, 'AI analysis service unavailable. Manual review required.');
                return;
            }

            // 3. Run all checks and build confidence score
            $analysis = $this->runChecks($document, $visionResult);

            Log::info("KYC AI analysis complete", [
                'document_id'      => $document->id,
                'confidence_score' => $analysis['confidence'],
                'checks'           => $analysis['checks'],
                'extracted_name'   => $analysis['extracted_name'] ?? null,
            ]);

            // 4. Make decision based on score
            $this->makeDecision($document, $analysis);

        } catch (\Exception $e) {
            Log::error("KYC AI analysis failed", [
                'document_id' => $document->id,
                'error'       => $e->getMessage(),
            ]);

            // On any unexpected error — send to admin, never auto-reject
            $this->flagForReview($document, 'AI analysis encountered an error. Manual review required.');
        }
    }

    // ── Google Vision API call ────────────────────────────────────────────────
    private function callGoogleVision(string $imageBase64): ?array
    {
        $apiKey = config('services.google_vision.api_key');

        if (!$apiKey) {
            Log::warning("Google Vision API key not configured.");
            return null;
        }

        $response = Http::timeout(30)->post(
            "https://vision.googleapis.com/v1/images:annotate?key={$apiKey}",
            [
                'requests' => [[
                    'image' => ['content' => $imageBase64],
                    'features' => [
                        ['type' => 'TEXT_DETECTION',         'maxResults' => 1],
                        ['type' => 'DOCUMENT_TEXT_DETECTION', 'maxResults' => 1],
                        ['type' => 'SAFE_SEARCH_DETECTION',  'maxResults' => 1],
                        ['type' => 'IMAGE_PROPERTIES',       'maxResults' => 1],
                    ],
                ]],
            ]
        );

        if (!$response->successful()) {
            Log::error("Google Vision API error", ['status' => $response->status(), 'body' => $response->body()]);
            return null;
        }

        return $response->json('responses.0');
    }

    // ── Run all checks and calculate confidence score ─────────────────────────
    private function runChecks(KycDocument $document, array $vision): array
    {
        $checks     = [];
        $confidence = 0;
        $reasons    = [];

        // Extract full text from document
        $fullText = strtolower($vision['fullTextAnnotation']['text'] ?? $vision['textAnnotations'][0]['description'] ?? '');

        // ── Check 1: Is the image clear enough? (20 points) ──────────────────
        $brightness = $vision['imagePropertiesAnnotation']['dominantColors']['colors'][0]['score'] ?? 0;
        $hasText    = strlen($fullText) > 20;

        if ($hasText && $brightness > 0.1) {
            $checks['image_quality'] = 'pass';
            $confidence += 20;
        } else {
            $checks['image_quality'] = 'fail';
            $reasons[] = 'Document image is unclear, too dark, or does not contain readable text.';
        }

        // ── Check 2: Does the document type match? (20 points) ────────────────
        $expectedKeywords = self::DOCUMENT_KEYWORDS[$document->document_type] ?? [];
        $keywordMatches   = 0;
        foreach ($expectedKeywords as $keyword) {
            if (str_contains($fullText, $keyword)) {
                $keywordMatches++;
            }
        }

        if ($keywordMatches >= 2) {
            $checks['document_type_match'] = 'pass';
            $confidence += 20;
        } elseif ($keywordMatches === 1) {
            $checks['document_type_match'] = 'partial';
            $confidence += 10;
            $reasons[] = 'Document type could not be fully confirmed.';
        } else {
            $checks['document_type_match'] = 'fail';
            $reasons[] = "Document does not appear to be a {$document->document_type}.";
        }

        // ── Check 3: Does the name on the document match the user? (25 points) ─
        $userName      = strtolower($document->user->name);
        $nameParts     = explode(' ', $userName);
        $nameMatches   = 0;
        $extractedName = null;

        foreach ($nameParts as $part) {
            if (strlen($part) > 2 && str_contains($fullText, $part)) {
                $nameMatches++;
            }
        }

        $nameScore = count($nameParts) > 0 ? ($nameMatches / count($nameParts)) : 0;

        if ($nameScore >= 0.7) {
            $checks['name_match'] = 'pass';
            $confidence += 25;
            $extractedName = $document->user->name;
        } elseif ($nameScore >= 0.4) {
            $checks['name_match'] = 'partial';
            $confidence += 12;
            $reasons[] = 'Name on document partially matches account name. May need review.';
        } else {
            $checks['name_match'] = 'fail';
            $reasons[] = 'Name on document does not match the registered account name.';
        }

        // ── Check 4: Is there an ID/document number? (15 points) ──────────────
        // Look for patterns: sequences of digits (8+ chars) or alphanumeric IDs
        $hasIdNumber = preg_match('/\b[A-Z0-9]{6,20}\b/', strtoupper($fullText));

        if ($hasIdNumber) {
            $checks['id_number_present'] = 'pass';
            $confidence += 15;
        } else {
            $checks['id_number_present'] = 'fail';
            $reasons[] = 'No valid ID number detected on the document.';
        }

        // ── Check 5: Is the document expired? (10 points) ────────────────────
        // Look for date patterns
        $datePattern = '/\b(0[1-9]|[12][0-9]|3[01])[\/\-](0[1-9]|1[012])[\/\-](20\d{2})\b/';
        preg_match_all($datePattern, $fullText, $dates);

        $expired = false;
        foreach ($dates[0] ?? [] as $dateStr) {
            try {
                $date = \Carbon\Carbon::createFromFormat('d/m/Y', str_replace('-', '/', $dateStr));
                if ($date->isPast() && $date->year > 2000) {
                    $expired = true;
                    break;
                }
            } catch (\Exception $e) {
                // ignore parse errors
            }
        }

        if ($expired) {
            $checks['not_expired'] = 'fail';
            $reasons[] = 'Document appears to be expired.';
        } else {
            $checks['not_expired'] = 'pass';
            $confidence += 10;
        }

        // ── Check 6: Duplicate document check (10 points) ────────────────────
        // Check if the same Cloudinary public ID was used before
        $isDuplicate = \App\Models\KycDocument::where('cloudinary_public_id', $document->cloudinary_public_id)
            ->where('id', '!=', $document->id)
            ->where('status', 'verified')
            ->exists();

        if ($isDuplicate) {
            $checks['not_duplicate'] = 'fail';
            $reasons[] = 'This document has already been used to verify another account.';
            $confidence = max(0, $confidence - 30); // heavy penalty
        } else {
            $checks['not_duplicate'] = 'pass';
            $confidence += 10;
        }

        return [
            'confidence'     => min(100, $confidence),
            'checks'         => $checks,
            'reasons'        => $reasons,
            'extracted_name' => $extractedName,
            'full_text'      => substr($fullText, 0, 500), // store first 500 chars for admin
        ];
    }

    // ── Make the final decision ───────────────────────────────────────────────
    private function makeDecision(KycDocument $document, array $analysis): void
    {
        $score            = $analysis['confidence'];
        $isCompany        = $document->user->role === 'company';
        $approveThreshold = $this->approveThreshold($document->user);

        // Store analysis result on the document
        $document->update([
            'ai_confidence_score' => $score,
            'ai_checks'           => json_encode($analysis['checks']),
            'ai_extracted_text'   => $analysis['full_text'] ?? null,
            'ai_analysed_at'      => now(),
            'ai_auto_decided'     => true,
        ]);

        if ($score >= $approveThreshold) {
            // ── AUTO APPROVE ──────────────────────────────────────────────────
            $document->update([
                'status'      => 'verified',
                'reviewed_at' => now(),
                'review_note' => "Auto-approved by AI. Confidence: {$score}%. " .
                                 ($isCompany ? "Company threshold: {$approveThreshold}%." : "Individual threshold: {$approveThreshold}%."),
            ]);

            // For individuals — mark KYC verified immediately
            // For companies — check if BOTH documents are now verified
            if ($isCompany) {
                app(\App\Services\CompanyVerificationService::class)
                    ->checkAndActivate($document->user);
            } else {
                $document->user->update(['kyc_status' => 'verified']);
                $document->user->notify(new KycApproved($document, true));
            }

            Log::info("KYC AUTO-APPROVED by AI", [
                'document_id' => $document->id,
                'user_id'     => $document->user_id,
                'role'        => $document->user->role,
                'score'       => $score,
                'threshold'   => $approveThreshold,
            ]);

        } elseif ($score >= self::FLAG_FOR_REVIEW_THRESHOLD) {
            // ── FLAG FOR ADMIN REVIEW ─────────────────────────────────────────
            $document->update(['ai_auto_decided' => false]);
            $this->flagForReview(
                $document,
                "AI confidence: {$score}% (threshold: {$approveThreshold}%). " .
                "Needs manual review. Issues: " . implode(' | ', $analysis['reasons'])
            );

        } else {
            // ── AUTO REJECT ───────────────────────────────────────────────────
            $reason = count($analysis['reasons']) > 0
                ? implode(' ', $analysis['reasons'])
                : "Document did not meet verification requirements. AI confidence: {$score}%.";

            $document->update([
                'status'           => 'rejected',
                'rejection_reason' => $reason,
                'reviewed_at'      => now(),
                'review_note'      => "Auto-rejected by AI. Confidence: {$score}%.",
            ]);

            // Only update user KYC status to rejected for individuals
            // For companies — one bad document doesn't reject the whole application
            if (!$isCompany) {
                $document->user->update(['kyc_status' => 'rejected']);
            }

            $document->user->notify(new KycRejected($document, $reason, true));

            Log::info("KYC AUTO-REJECTED by AI", [
                'document_id' => $document->id,
                'user_id'     => $document->user_id,
                'role'        => $document->user->role,
                'score'       => $score,
                'reasons'     => $analysis['reasons'],
            ]);
        }
    }

    private function flagForReview(KycDocument $document, string $note): void
    {
        $document->update([
            'status'      => 'pending',
            'review_note' => $note,
        ]);

        // Notify all admins that a document needs manual review
        User::where('role', 'admin')->get()->each(function (User $admin) use ($document, $note) {
            $admin->notify(new KycNeedsReview($document, $note));
        });

        Log::info("KYC flagged for manual admin review", [
            'document_id' => $document->id,
            'note'        => $note,
        ]);
    }

    private function fetchImageAsBase64(string $url): ?string
    {
        try {
            $response = Http::timeout(15)->get($url);
            if ($response->successful()) {
                return base64_encode($response->body());
            }
        } catch (\Exception $e) {
            Log::error("Failed to fetch KYC image: " . $e->getMessage());
        }
        return null;
    }
}
