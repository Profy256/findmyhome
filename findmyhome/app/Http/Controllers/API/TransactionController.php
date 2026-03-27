<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\{Transaction, Property};
use App\Notifications\TransactionNotification;
use Illuminate\Http\{Request, JsonResponse};

class TransactionController extends Controller
{
    /**
     * Initiate a transaction — either buyer or seller starts it.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'property_id'  => 'required|uuid|exists:properties,id',
            'agreed_price' => 'required|integer|min:1',
        ]);

        $property = Property::findOrFail($data['property_id']);
        $user     = $request->user();

        if ($property->status !== 'active') {
            return response()->json(['message' => 'This property is no longer available.'], 422);
        }

        // Prevent duplicate open transactions on same property
        $existing = Transaction::where('property_id', $property->id)
            ->whereNull('completed_at')
            ->first();

        if ($existing) {
            return response()->json([
                'message'     => 'A transaction is already in progress for this property.',
                'transaction' => $existing,
            ], 422);
        }

        // Determine buyer and seller from context
        $isBuyer  = $user->role === 'buyer';
        $buyerId  = $isBuyer ? $user->id : $request->buyer_id;
        $sellerId = $property->seller_id;

        if (!$buyerId) {
            return response()->json(['message' => 'buyer_id is required.'], 422);
        }

        $transaction = Transaction::create([
            'buyer_id'         => $buyerId,
            'seller_id'        => $sellerId,
            'property_id'      => $property->id,
            'agreed_price'     => $data['agreed_price'],
            'buyer_confirmed'  => $isBuyer,
            'seller_confirmed' => !$isBuyer,
            'buyer_confirmed_at'  => $isBuyer  ? now() : null,
            'seller_confirmed_at' => !$isBuyer ? now() : null,
        ]);

        // Notify the other party to confirm
        $otherParty = $isBuyer ? $property->seller : \App\Models\User::find($buyerId);
        $otherParty->notify(new TransactionNotification($transaction, 'confirmation_needed'));

        return response()->json([
            'message'     => 'Transaction created. Waiting for the other party to confirm.',
            'transaction' => $transaction,
        ], 201);
    }

    /**
     * Buyer or seller confirms their side of the transaction.
     * When BOTH confirm → property marked sold/rented + commission created.
     */
    public function confirm(Request $request, Transaction $transaction): JsonResponse
    {
        $user = $request->user();

        // Only buyer or seller of this transaction can confirm
        if (!in_array($user->id, [$transaction->buyer_id, $transaction->seller_id])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($transaction->completed_at) {
            return response()->json(['message' => 'This transaction is already completed.'], 422);
        }

        // Record confirmation
        if ($user->id === $transaction->buyer_id && !$transaction->buyer_confirmed) {
            $transaction->update([
                'buyer_confirmed'    => true,
                'buyer_confirmed_at' => now(),
            ]);
        } elseif ($user->id === $transaction->seller_id && !$transaction->seller_confirmed) {
            $transaction->update([
                'seller_confirmed'    => true,
                'seller_confirmed_at' => now(),
            ]);
        } else {
            return response()->json(['message' => 'You have already confirmed this transaction.'], 422);
        }

        $transaction->refresh();

        // Both parties confirmed — complete the transaction
        if ($transaction->buyer_confirmed && $transaction->seller_confirmed) {
            $transaction->complete();

            // Notify both parties
            $transaction->buyer->notify(new TransactionNotification($transaction, 'completed'));
            $transaction->seller->notify(new TransactionNotification($transaction, 'completed'));

            return response()->json([
                'message'     => 'Transaction confirmed by both parties. Property is now marked as ' .
                                 ($transaction->property->listing_type === 'sale' ? 'sold' : 'rented') . '.',
                'transaction' => $transaction->fresh()->load('property:id,title,status'),
                'commission'  => $transaction->commission,
            ]);
        }

        // Still waiting for the other party
        $waitingFor = $transaction->buyer_confirmed ? 'seller' : 'buyer';

        // Notify the other party again
        $otherParty = $waitingFor === 'seller'
            ? $transaction->seller
            : $transaction->buyer;

        $otherParty->notify(new TransactionNotification($transaction, 'confirmation_needed'));

        return response()->json([
            'message'      => "Your confirmation recorded. Waiting for the {$waitingFor} to confirm.",
            'transaction'  => $transaction,
            'waiting_for'  => $waitingFor,
        ]);
    }

    /**
     * Get transactions for the authenticated user.
     */
    public function myTransactions(Request $request): JsonResponse
    {
        $user = $request->user();

        $transactions = Transaction::where('buyer_id',  $user->id)
            ->orWhere('seller_id', $user->id)
            ->with([
                'property:id,title,location,price,listing_type',
                'buyer:id,name,phone',
                'seller:id,name,phone,company_name',
                'commission:id,transaction_id,commission_amount,status,due_date',
            ])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($transactions);
    }
}
