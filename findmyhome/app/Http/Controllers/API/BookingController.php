<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\{Booking, Property, Setting};
use App\Notifications\BookingNotification;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\{Http, Log};

class BookingController extends Controller
{
    /**
     * Create a booking request and initiate Pesapal payment.
     */
    public function store(Request $request, Property $property): JsonResponse
    {
        if ($property->listing_type !== 'rent') {
            return response()->json([
                'message' => 'Online booking is only available for rental properties.',
            ], 422);
        }

        if (!$property->seller->booking_enabled) {
            return response()->json([
                'message' => 'This seller has not enabled online booking. Please contact them directly.',
            ], 422);
        }

        if ($property->status !== 'active') {
            return response()->json(['message' => 'This property is not available.'], 422);
        }

        if ($property->seller_id === $request->user()->id) {
            return response()->json(['message' => 'You cannot book your own property.'], 422);
        }

        $data = $request->validate([
            'checkin_date'  => 'required|date|after:today',
            'checkout_date' => 'required|date|after:checkin_date',
            'guests'        => 'required|integer|min:1|max:20',
        ]);

        // Check availability
        $conflict = Booking::where('property_id', $property->id)
            ->whereIn('status', ['confirmed', 'pending'])
            ->where(function ($q) use ($data) {
                $q->whereBetween('checkin_date',  [$data['checkin_date'], $data['checkout_date']])
                  ->orWhereBetween('checkout_date',[$data['checkin_date'], $data['checkout_date']])
                  ->orWhere(function ($q) use ($data) {
                      $q->where('checkin_date',  '<=', $data['checkin_date'])
                        ->where('checkout_date', '>=', $data['checkout_date']);
                  });
            })->exists();

        if ($conflict) {
            return response()->json([
                'message' => 'This property is not available for your selected dates.',
            ], 422);
        }

        $checkin     = \Carbon\Carbon::parse($data['checkin_date']);
        $checkout    = \Carbon\Carbon::parse($data['checkout_date']);
        $nights      = $checkin->diffInDays($checkout);
        $totalPrice  = $property->price * $nights;
        $feeRate     = Setting::bookingFeeRate() / 100;
        $platformFee = (int) round($totalPrice * $feeRate);
        $orderId     = 'FMH-' . strtoupper(uniqid());

        $booking = Booking::create([
            'buyer_id'        => $request->user()->id,
            'property_id'     => $property->id,
            'checkin_date'    => $data['checkin_date'],
            'checkout_date'   => $data['checkout_date'],
            'guests'          => $data['guests'],
            'total_price'     => $totalPrice,
            'platform_fee'    => $platformFee,
            'status'          => 'pending',
            'payment_status'  => 'unpaid',
            'pesapal_order_id'=> $orderId,
        ]);

        // Initiate Pesapal payment
        $paymentUrl = $this->initiatePesapalPayment($booking, $request->user());

        // Notify seller of new booking request
        $property->seller->notify(new BookingNotification($booking, 'new_request'));

        return response()->json([
            'message'     => 'Booking request created. Please complete payment to confirm.',
            'booking'     => $booking,
            'payment_url' => $paymentUrl,
            'summary'     => [
                'nights'          => $nights,
                'price_per_night' => number_format($property->price),
                'total_price'     => number_format($totalPrice),
                'platform_fee'    => number_format($platformFee),
                'total_due'       => number_format($totalPrice + $platformFee),
            ],
        ], 201);
    }

    /**
     * Seller confirms or rejects a booking.
     */
    public function updateStatus(Request $request, Booking $booking): JsonResponse
    {
        if ($booking->property->seller_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!in_array($booking->status, ['pending'])) {
            return response()->json(['message' => 'This booking cannot be updated.'], 422);
        }

        $request->validate([
            'status' => 'required|in:confirmed,rejected',
            'reason' => 'nullable|string|max:500',
        ]);

        $booking->update(['status' => $request->status]);
        $booking->buyer->notify(new BookingNotification($booking, $request->status, $request->reason));

        return response()->json([
            'message' => $request->status === 'confirmed'
                ? 'Booking confirmed. The guest has been notified.'
                : 'Booking rejected. The guest has been notified.',
            'booking' => $booking->fresh(),
        ]);
    }

    /**
     * Get bookings for the authenticated user (as buyer or seller).
     */
    public function myBookings(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isSeller()) {
            $bookings = Booking::whereHas('property', fn($q) =>
                $q->where('seller_id', $user->id)
            )->with(['buyer:id,name,phone', 'property:id,title,location,price'])
             ->orderByDesc('created_at')
             ->paginate(20);
        } else {
            $bookings = Booking::where('buyer_id', $user->id)
                ->with(['property.seller:id,name,phone,company_name'])
                ->orderByDesc('created_at')
                ->paginate(20);
        }

        return response()->json($bookings);
    }

    /**
     * Pesapal payment IPN — called by Pesapal when payment is complete.
     */
    public function pesapalIpn(Request $request): JsonResponse
    {
        $trackingId  = $request->OrderTrackingId;
        $merchantRef = $request->OrderMerchantReference;

        if (!$trackingId || !$merchantRef) {
            return response()->json(['message' => 'Invalid IPN data.'], 400);
        }

        $booking = Booking::where('pesapal_order_id', $merchantRef)->first();
        if (!$booking) {
            return response()->json(['message' => 'Booking not found.'], 404);
        }

        $status = $this->verifyPesapalPayment($trackingId);

        if ($status === 'COMPLETED') {
            $booking->update([
                'payment_status'      => 'paid',
                'pesapal_tracking_id' => $trackingId,
            ]);

            // Notify seller payment received
            $booking->property->seller->notify(
                new BookingNotification($booking, 'new_request')
            );

            Log::info("Pesapal payment confirmed", [
                'booking_id'  => $booking->id,
                'tracking_id' => $trackingId,
                'amount'      => $booking->total_price,
            ]);
        }

        return response()->json(['OrderNotificationType' => 'IPNCHANGE', 'OrderTrackingId' => $trackingId]);
    }

    // ── Pesapal v3 Integration ────────────────────────────────────────────────

    private function getPesapalToken(): ?string
    {
        $isSandbox = config('services.pesapal.env') === 'sandbox';
        $baseUrl   = $isSandbox
            ? 'https://cybqa.pesapal.com/pesapalv3'
            : 'https://pay.pesapal.com/v3';

        $response = Http::post("{$baseUrl}/api/Auth/RequestToken", [
            'consumer_key'    => config('services.pesapal.consumer_key'),
            'consumer_secret' => config('services.pesapal.consumer_secret'),
        ]);

        if ($response->successful()) {
            return $response->json('token');
        }

        Log::error("Pesapal token request failed", ['response' => $response->body()]);
        return null;
    }

    private function initiatePesapalPayment(Booking $booking, $buyer): ?string
    {
        $token = $this->getPesapalToken();
        if (!$token) return null;

        $isSandbox = config('services.pesapal.env') === 'sandbox';
        $baseUrl   = $isSandbox
            ? 'https://cybqa.pesapal.com/pesapalv3'
            : 'https://pay.pesapal.com/v3';

        $response = Http::withToken($token)
            ->post("{$baseUrl}/api/Transactions/SubmitOrderRequest", [
                'id'                    => $booking->pesapal_order_id,
                'currency'              => 'UGX',
                'amount'                => $booking->total_price + $booking->platform_fee,
                'description'           => "Booking: {$booking->property->title}",
                'callback_url'          => url("/api/payments/ipn"),
                'notification_id'       => config('services.pesapal.ipn_url'),
                'billing_address'       => [
                    'email_address'  => $buyer->email,
                    'phone_number'   => $buyer->phone,
                    'first_name'     => explode(' ', $buyer->name)[0],
                    'last_name'      => explode(' ', $buyer->name)[1] ?? '',
                ],
            ]);

        if ($response->successful()) {
            return $response->json('redirect_url');
        }

        Log::error("Pesapal order submission failed", ['response' => $response->body()]);
        return null;
    }

    private function verifyPesapalPayment(string $trackingId): ?string
    {
        $token = $this->getPesapalToken();
        if (!$token) return null;

        $isSandbox = config('services.pesapal.env') === 'sandbox';
        $baseUrl   = $isSandbox
            ? 'https://cybqa.pesapal.com/pesapalv3'
            : 'https://pay.pesapal.com/v3';

        $response = Http::withToken($token)
            ->get("{$baseUrl}/api/Transactions/GetTransactionStatus", [
                'orderTrackingId' => $trackingId,
            ]);

        if ($response->successful()) {
            return $response->json('payment_status_description');
        }

        return null;
    }
}
