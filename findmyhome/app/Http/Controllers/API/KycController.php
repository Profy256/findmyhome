<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Jobs\AnalyseKycDocument;
use App\Models\KycDocument;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\Http;

class KycController extends Controller
{
    /**
     * Get the current user's KYC status and documents.
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        $docs = $user->kycDocuments()->latest()->get();

        return response()->json([
            'kyc_status'    => $user->kyc_status,
            'role'          => $user->role,
            'documents'     => $docs,
            'requirements'  => $this->requirements($user->role),
            'is_complete'   => $user->kyc_status === 'verified',
            'can_list'      => $user->isVerified(),
        ]);
    }

    /**
     * Upload a KYC document.
     * Saves to Cloudinary as a private asset, then dispatches AI analysis.
     */
    public function upload(Request $request): JsonResponse
    {
        $user = $request->user();

        // Buyers don't need KYC
        if ($user->role === 'buyer') {
            return response()->json(['message' => 'Buyers do not need KYC verification.'], 422);
        }

        // Already fully verified
        if ($user->kyc_status === 'verified') {
            return response()->json(['message' => 'Your identity is already verified.'], 422);
        }

        $request->validate([
            'document_type' => [
                'required',
                'in:national_id,passport,drivers_licence,business_registration',
                function ($attribute, $value, $fail) use ($user) {
                    // Companies must upload business_registration
                    if ($user->role === 'company' && $value !== 'business_registration') {
                        // This is allowed — companies also need a director ID
                        // But they cannot submit national_id as their primary business doc
                    }
                    // Individuals cannot submit business_registration
                    if ($user->role === 'seller' && $value === 'business_registration') {
                        $fail('Individual sellers cannot upload a business registration certificate.');
                    }
                },
            ],
            'file_url'            => 'required|string|url',   // Cloudinary URL from frontend upload
            'cloudinary_public_id' => 'required|string',
        ]);

        // Check for existing pending/verified doc of same type
        $existing = $user->kycDocuments()
            ->where('document_type', $request->document_type)
            ->whereIn('status', ['pending', 'verified'])
            ->first();

        if ($existing) {
            return response()->json([
                'message' => "You already have a {$request->document_type} document " .
                             ($existing->status === 'verified' ? 'that is verified.' : 'pending review.'),
                'status'  => $existing->status,
            ], 422);
        }

        // Create the document record
        $document = KycDocument::create([
            'user_id'              => $user->id,
            'document_type'        => $request->document_type,
            'file_url'             => $request->file_url,
            'cloudinary_public_id' => $request->cloudinary_public_id,
            'status'               => 'pending',
        ]);

        // Update user KYC status to pending if it was 'none' or 'rejected'
        if (in_array($user->kyc_status, ['none', 'rejected'])) {
            $user->update(['kyc_status' => 'pending']);
        }

        // Dispatch AI analysis job — runs in background queue
        AnalyseKycDocument::dispatch($document)->onQueue('kyc');

        return response()->json([
            'message'  => 'Document uploaded successfully. We are analysing it now. ' .
                          'You will be notified once verification is complete.',
            'document' => $document,
            'what_happens_next' => $user->role === 'company'
                ? 'Your business document will be automatically reviewed. Activation takes just a few minutes.'
                : 'Your document will be automatically reviewed. Most verifications complete within a few minutes.',
        ], 201);
    }

    /**
     * List all documents uploaded by the current user.
     */
    public function myDocuments(Request $request): JsonResponse
    {
        $docs = $request->user()
            ->kycDocuments()
            ->select('id', 'document_type', 'status', 'rejection_reason',
                     'ai_confidence_score', 'reviewed_at', 'created_at')
            ->latest()
            ->get();

        return response()->json($docs);
    }

    /**
     * What documents are required based on account role.
     */
    private function requirements(string $role): array
    {
        if ($role === 'company') {
            return [
                'required' => [
                    'business_registration' => 'Certificate of Incorporation from Uganda Registration Services Bureau (URSB)',
                ],
                'note' => 'Your business document must be verified before your company account is activated.',
                'benefits' => [
                    'Free Blue Badge for 30 days',
                    'Online booking pre-approved',
                    '2 free featured listing slots',
                    'Reduced commission rate (3%)',
                    'Land listings do not require title uploads',
                ],
            ];
        }

        return [
            'required' => [
                'id_document' => 'National ID, Passport, or Driver\'s Licence',
            ],
            'note' => 'Individual sellers must also upload a land title when listing land properties.',
        ];
    }
}
