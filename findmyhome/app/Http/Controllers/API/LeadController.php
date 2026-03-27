<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\{Lead, Property};
use App\Notifications\NewLeadNotification;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\Log;

class LeadController extends Controller
{
    /**
     * Record a platform enquiry lead.
     * Called when buyer taps "Send Enquiry" button.
     */
    public function recordPlatformLead(Request $request, Property $property): JsonResponse
    {
        return $this->recordLead($request, $property, 'platform');
    }

    /**
     * Record a WhatsApp lead.
     * Called the INSTANT buyer taps "Chat on WhatsApp" — before WhatsApp opens.
     * This ensures the lead is captured even if the buyer changes their mind.
     */
    public function recordWhatsappLead(Request $request, Property $property): JsonResponse
    {
        $lead = $this->recordLead($request, $property, 'whatsapp');

        // Return the WhatsApp deep link URL in the response
        // Frontend opens this URL after the API call completes
        $seller = $property->seller;
        $phone  = $this->formatPhoneForWhatsApp($seller->phone);
        $buyer  = $request->user();

        $message = urlencode(
            "Hello! I found your listing on Find My Home.\n" .
            "Property: {$property->title}\n" .
            "Location: {$property->location}\n\n" .
            "I am interested and would like more details.\n" .
            "My name is {$buyer->name}."
        );

        return response()->json([
            'lead'          => $lead->getData()['lead'] ?? null,
            'whatsapp_url'  => "https://wa.me/{$phone}?text={$message}",
            'message'       => 'Lead recorded. Redirecting to WhatsApp.',
        ]);
    }

    /**
     * Core lead recording logic used by both methods.
     */
    private function recordLead(Request $request, Property $property, string $method): JsonResponse
    {
        // Property must be active
        if ($property->status !== 'active') {
            return response()->json(['message' => 'This property is no longer available.'], 422);
        }

        // Buyer cannot contact their own listing
        if ($property->seller_id === $request->user()->id) {
            return response()->json(['message' => 'You cannot contact your own listing.'], 422);
        }

        // Check for duplicate lead in last 24 hours (same buyer, same property, same method)
        $recentLead = Lead::where('buyer_id',       $request->user()->id)
            ->where('property_id',    $property->id)
            ->where('contact_method', $method)
            ->where('created_at',     '>=', now()->subHours(24))
            ->first();

        if ($recentLead) {
            // Don't create duplicate — just return the WhatsApp URL if needed
            return response()->json([
                'message'     => 'Lead already recorded.',
                'lead_id'     => $recentLead->id,
                'already_recorded' => true,
            ]);
        }

        // Create the lead
        $lead = Lead::create([
            'buyer_id'       => $request->user()->id,
            'seller_id'      => $property->seller_id,
            'property_id'    => $property->id,
            'contact_method' => $method,
            'seller_notified'=> false,
        ]);

        // Notify the seller — email + SMS + push
        // Queued so it doesn't slow down the API response
        $property->seller->notify(
            new NewLeadNotification($lead, $property, $request->user())
        );

        $lead->update(['seller_notified' => true, 'notified_at' => now()]);

        Log::info("Lead recorded", [
            'lead_id'    => $lead->id,
            'method'     => $method,
            'buyer_id'   => $request->user()->id,
            'seller_id'  => $property->seller_id,
            'property_id'=> $property->id,
        ]);

        return response()->json([
            'message' => 'Lead recorded successfully.',
            'lead'    => [
                'id'             => $lead->id,
                'contact_method' => $lead->contact_method,
                'created_at'     => $lead->created_at,
            ],
        ], 201);
    }

    /**
     * Get leads for the authenticated seller.
     */
    public function myLeads(Request $request): JsonResponse
    {
        $leads = Lead::where('seller_id', $request->user()->id)
            ->with('buyer:id,name,phone', 'property:id,title,location,price')
            ->orderByDesc('created_at')
            ->paginate(20);

        $summary = [
            'total'     => Lead::where('seller_id', $request->user()->id)->count(),
            'platform'  => Lead::where('seller_id', $request->user()->id)->where('contact_method', 'platform')->count(),
            'whatsapp'  => Lead::where('seller_id', $request->user()->id)->where('contact_method', 'whatsapp')->count(),
            'today'     => Lead::where('seller_id', $request->user()->id)->whereDate('created_at', today())->count(),
        ];

        return response()->json([
            'summary' => $summary,
            'leads'   => $leads,
        ]);
    }

    /**
     * Format phone number for WhatsApp (remove leading 0, add country code).
     * Uganda numbers: 0712345678 → 256712345678
     */
    private function formatPhoneForWhatsApp(string $phone): string
    {
        $phone = preg_replace('/\D/', '', $phone); // digits only

        // Already has country code
        if (str_starts_with($phone, '256')) return $phone;
        if (str_starts_with($phone, '+256')) return ltrim($phone, '+');

        // Remove leading 0 and add Uganda country code
        if (str_starts_with($phone, '0')) {
            return '256' . substr($phone, 1);
        }

        return '256' . $phone;
    }
}
