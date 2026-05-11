<?php

namespace App\Http\Controllers;

use Laravel\Socialite\Facades\Socialite;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Instructor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Exception;

class GoogleAuthController extends Controller
{
    // Redirect the user to Google's OAuth page
        public function redirectToGoogle()
        {
            return Socialite::driver('google')->stateless()->redirect();
        }

        // Handle the callback from Google after user authenticates
        public function handleGoogleCallback() {
            try {
            $googleUser = Socialite::driver('google')->stateless()->user();
            $email = $googleUser->getEmail();

            // Determine user role
            $role = null;

            // Check if instructor
            $instructor = \App\Models\Instructor::where('email', $email)->first();
            if ($instructor) {
                $role = 'Instructor';
            }

            // Check if student
            elseif (str_contains($email, '@student')) {
                if (str_ends_with($email, '@student.laverdad.edu.ph')) {
                    $role = 'Student';
                } else {
                    return response()->json([
                        'error' => 'Only @student.laverdad.edu.ph student emails are allowed.'
                    ], 403);
                }
            }

            // Check for specific admin email
            elseif (in_array($email, ['evaluationsystem2025@gmail.com', 'atpes2025@gmail.com'])) {
                $role = 'Admin';
            }
            

            // All others unauthorized
            else {
                return redirect("http://localhost:5173/login?status=error&error_type=unauthorized&message=" . urlencode('Unauthorized email domain.'));
            }

            // Check if user exists
            $user = User::where('email', $email)->first();

            // Revoke existing tokens if any - allow fresh login
            if ($user) {
                $user->tokens()->delete();
            }

            if (!$user) {
                // Create new user
                $user = User::create([
                    'name' => $googleUser->getName(),
                    'email' => $email,
                    'google_id' => $googleUser->getId(),
                    'role' => $role,
                    'profile_picture' => null, // Set after avatar is saved
                    'password' => bcrypt('defaultpassword'), // not used but required
                    'profile_completed' => false,
                ]);

                // Save avatar locally
                $localAvatar = $this->storeGoogleAvatar($googleUser->getAvatar(), $user->id);
                $user->update(['profile_picture' => $localAvatar]);
            } else {
                // Update if needed
                if (!$user->google_id) {
                    $user->google_id = $googleUser->getId();
                }
                if (!$user->role) {
                    $user->role = $role;
                }
                $user->save();

                // Save avatar if missing
                if (!$user->profile_picture && $googleUser->getAvatar()) {
                    $localAvatar = $this->storeGoogleAvatar($googleUser->getAvatar(), $user->id);
                    $user->update(['profile_picture' => $localAvatar]);
                }
            }

            // Link instructor ID if applicable
            if ($role === 'Instructor' && $instructor) {
                $user->instructor_id = $instructor->id;
                $user->save();
            }

                // Issue token and redirect with success status
                $token = $user->createToken('authToken')->plainTextToken;
                return redirect("http://localhost:5173/login?status=success&token={$token}&role={$user->role}");

            } catch (Exception $e) {
                // Log full exception for debugging (will appear in storage/logs/laravel.log)
                Log::error('GoogleAuthController exception', ['message' => $e->getMessage(), 'exception' => $e]);
                // Enhanced error handling with frontend-friendly messages
                $errorMessage = 'Authentication failed';
                $errorType = 'general_error';

                if ($e instanceof \Laravel\Socialite\Two\InvalidStateException) {
                    $errorMessage = 'Invalid state parameter. Please try again.';
                    $errorType = 'invalid_state';
                } elseif ($e instanceof \GuzzleHttp\Exception\ClientException) {
                    $errorMessage = 'Google authentication service error. Please try again later.';
                    $errorType = 'service_error';
                } elseif (str_contains($e->getMessage(), 'student.laverdad.edu.ph')) {
                    $errorMessage = 'Only @student.laverdad.edu.ph student emails are allowed.';
                    $errorType = 'unauthorized_email';
                }

                // Redirect to frontend with error information
                return redirect("http://localhost:5173/login?status=error&error_type={$errorType}&message=" . urlencode($errorMessage));
            }
        }

    // Log out the current user by revoking all their tokens
    public function logout(Request $request)
    {
        $request->user()->tokens()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    // Download and save the user's Google avatar locally
    public function storeGoogleAvatar($url, $userId)
    {
        // Get the image from Google
        $imageContent = Http::get($url)->body();

        // Set file name and path
        $filename = "avatars/user-{$userId}.jpg";

        // Save the image to the 'public' disk
        Storage::disk('public')->put($filename, $imageContent);

        // Return the URL of the stored image
        return Storage::url($filename);
    }
}
