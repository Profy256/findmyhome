<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\{Hash, Password};
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;

class PasswordResetController extends Controller
{
    /**
     * Send a password reset link to the user's email.
     */
    public function sendLink(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json([
                'message' => 'Password reset link sent to your email address.',
            ]);
        }

        return response()->json([
            'message' => 'We could not find a user with that email address.',
        ], 422);
    }

    /**
     * Reset the user's password using the token from the email link.
     */
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token'    => 'required',
            'email'    => 'required|email',
            'password' => ['required', 'confirmed', Rules\Password::min(8)],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password'       => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Password reset successfully. You can now log in.']);
        }

        return response()->json(['message' => 'This password reset link is invalid or has expired.'], 422);
    }
}
