<?php

namespace App\Jobs;

use App\Models\{Property, User};
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\{InteractsWithQueue, SerializesModels};
use Illuminate\Support\Facades\Log;

class DetectDuplicateProperty implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 2;
    public int $timeout = 60;

    public function __construct(public Property $property) {}

    public function handle(): void
    {
        $p = $this->property;

        // Find properties with similar location AND similar price (within 20%)
        $priceMin = $p->price * 0.8;
        $priceMax = $p->price * 1.2;

        $candidates = Property::where('id', '!=', $p->id)
            ->where('property_type', $p->property_type)
            ->where('listing_type',  $p->listing_type)
            ->where('status', '!=', 'deleted')
            ->where('price', '>=', $priceMin)
            ->where('price', '<=', $priceMax)
            ->where(function ($q) use ($p) {
                // Similar location — check district or location text
                $q->where('district', $p->district)
                  ->orWhere('location', 'ilike', '%' . substr($p->location, 0, 10) . '%');
            })
            ->where('seller_id', '!=', $p->seller_id) // same seller re-listing is ok
            ->get();

        if ($candidates->isEmpty()) return;

        foreach ($candidates as $candidate) {
            $score = $this->similarityScore($p, $candidate);

            if ($score >= 75) {
                $this->flagAsDuplicate($p, $candidate, $score);
                return; // Flag once and stop
            }
        }
    }

    private function similarityScore(Property $a, Property $b): int
    {
        $score = 0;

        // Same district — strong signal (30 pts)
        if ($a->district && $b->district && strtolower($a->district) === strtolower($b->district)) {
            $score += 30;
        }

        // Price within 5% — very strong signal (25 pts)
        if (abs($a->price - $b->price) / max($a->price, 1) <= 0.05) {
            $score += 25;
        }

        // Same size — strong signal (20 pts)
        if ($a->size && $b->size && strtolower(trim($a->size)) === strtolower(trim($b->size))) {
            $score += 20;
        }

        // Same bedrooms (10 pts)
        if ($a->bedrooms !== null && $a->bedrooms === $b->bedrooms) {
            $score += 10;
        }

        // Title similarity — check for significant overlap (15 pts)
        $titleSimilarity = $this->stringSimilarity(strtolower($a->title), strtolower($b->title));
        if ($titleSimilarity >= 0.6) {
            $score += 15;
        }

        return min(100, $score);
    }

    private function stringSimilarity(string $a, string $b): float
    {
        similar_text($a, $b, $percent);
        return $percent / 100;
    }

    private function flagAsDuplicate(Property $property, Property $original, int $score): void
    {
        // Notify all admins
        $admins = User::where('role', 'admin')->get();
        foreach ($admins as $admin) {
            $admin->notify(new \App\Notifications\DuplicatePropertyDetected(
                $property, $original, $score
            ));
        }

        // Notify the seller of the new listing
        $property->seller->notify(
            new \App\Notifications\DuplicatePropertyDetected($property, $original, $score, true)
        );

        Log::warning("Potential duplicate property detected", [
            'new_property_id'      => $property->id,
            'existing_property_id' => $original->id,
            'similarity_score'     => $score,
            'seller_id'            => $property->seller_id,
        ]);
    }
}
