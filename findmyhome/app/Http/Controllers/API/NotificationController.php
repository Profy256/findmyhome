<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\{Request, JsonResponse};

class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()
            ->notifications()
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json([
            'unread_count'  => $request->user()->unreadNotifications()->count(),
            'notifications' => $notifications,
        ]);
    }

    /**
     * Get only unread notifications.
     */
    public function unread(Request $request): JsonResponse
    {
        return response()->json([
            'count'         => $request->user()->unreadNotifications()->count(),
            'notifications' => $request->user()->unreadNotifications()
                ->orderByDesc('created_at')
                ->get(),
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->findOrFail($id);

        $notification->markAsRead();

        return response()->json(['message' => 'Notification marked as read.']);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    /**
     * Delete a single notification.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $request->user()->notifications()->findOrFail($id)->delete();
        return response()->json(['message' => 'Notification deleted.']);
    }
}
