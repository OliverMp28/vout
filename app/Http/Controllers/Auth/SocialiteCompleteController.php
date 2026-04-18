<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Fase 5 — Interstitial de consentimiento tras un primer login con Google.
 *
 * Cuando un usuario se registra por primera vez vía Socialite (Google), el
 * `SocialiteController::callback` lo crea sin haber pasado por la pantalla
 * de registro nativo, así que no hay constancia de que aceptara Términos +
 * Privacidad ni de que confirmara ser mayor de 14. Antes de dejarlo navegar
 * lo desviamos aquí para que confirme exactamente lo mismo que un registro
 * nativo. Si rechaza, lo desconectamos y borramos su cuenta para no dejar
 * un usuario huérfano sin consentimiento.
 */
class SocialiteCompleteController extends Controller
{
    /**
     * Pantalla de consentimiento. Sólo accesible si el usuario autenticado
     * aún no ha aceptado las políticas (terms_accepted_at = null).
     */
    public function show(Request $request): RedirectResponse|Response
    {
        $user = $request->user();

        if ($user === null) {
            return redirect()->route('login');
        }

        if ($user->terms_accepted_at !== null) {
            return redirect()->intended(route('dashboard', absolute: false));
        }

        return Inertia::render('auth/google-complete', [
            'name' => $user->name,
            'email' => $user->email,
        ]);
    }

    /**
     * Persiste el consentimiento. Si el usuario rechaza, eliminamos la cuenta
     * recién creada para no acumular registros sin base legal.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user === null) {
            return redirect()->route('login');
        }

        if ($user->terms_accepted_at !== null) {
            return redirect()->intended(route('dashboard', absolute: false));
        }

        $request->validate([
            'accept_terms' => ['required', Rule::in([true, 'true', 1, '1', 'on'])],
            'confirm_age' => ['required', Rule::in([true, 'true', 1, '1', 'on'])],
        ], [
            'accept_terms.required' => __('auth.consent.terms.required'),
            'accept_terms.in' => __('auth.consent.terms.required'),
            'confirm_age.required' => __('auth.consent.age.required'),
            'confirm_age.in' => __('auth.consent.age.required'),
        ]);

        $user->update([
            'terms_accepted_at' => now(),
            'privacy_version_accepted' => config('vout.legal.current_privacy_version'),
        ]);

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * El usuario rechaza el consentimiento. Cerramos sesión y borramos al
     * usuario recién creado para que pueda volver a iniciar el flujo si
     * cambia de opinión, sin dejar registros huérfanos sin consentimiento.
     */
    public function cancel(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user !== null && $user->terms_accepted_at === null) {
            Auth::logout();
            $user->delete();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return redirect()->route('login');
    }
}
