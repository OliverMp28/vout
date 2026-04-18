<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ExternalAvatarDownloader;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Facades\Socialite;

class SocialiteController extends Controller
{
    public function __construct(private ExternalAvatarDownloader $avatarDownloader) {}

    /**
     * Redirige al usuario al proveedor de autenticación (Google).
     */
    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')->redirect();
    }

    /**
     * Maneja el callback de Google y autentica al usuario.
     */
    public function callback(): RedirectResponse
    {
        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (\Exception $e) {
            // Si el usuario cancela o hay un error, lo devolvemos al login con mensaje
            return redirect()->route('login')->withErrors([
                'email' => 'No se pudo autenticar con Google.',
            ]);
        }

        // Buscar un usuario existente usando el google_id
        $user = User::where('google_id', $googleUser->getId())->first();

        if ($user) {
            // Si el avatar guardado es una URL externa (legado), lo reemplazamos por una
            // copia local descargada ahora. Así evitamos que las apariciones aleatorias
            // de 429/403 de lh3.googleusercontent.com rompan la UX.
            if ($this->isExternalAvatar($user->avatar)) {
                $local = $this->avatarDownloader->download($googleUser->getAvatar());
                if ($local !== null) {
                    $user->update(['avatar' => $local]);
                }
            }

            Auth::login($user);

            return redirect()->intended(route('dashboard', absolute: false));
        }

        // Si no se encuentra por google_id, buscamos por correo electrónico
        $user = User::where('email', $googleUser->getEmail())->first();

        if ($user) {
            // El usuario existe nativamente.

            // Protección contra sobrescritura silenciosa:
            // Si el usuario ya tiene un google_id distinto al que intenta usar ahora, abortamos.
            if ($user->google_id !== null && $user->google_id !== $googleUser->getId()) {
                return redirect()->route('login')->withErrors([
                    'email' => 'Esta cuenta de Vout ya está vinculada a otra cuenta de Google distinta. Inicia sesión con la cuenta de Google correcta.',
                ]);
            }

            // Avatar: conservamos uno local existente; descargamos desde Google si no
            // hay avatar o si el actual es una URL externa (legado).
            $avatar = $user->avatar;
            if ($avatar === null || $this->isExternalAvatar($avatar)) {
                $avatar = $this->avatarDownloader->download($googleUser->getAvatar());
            }

            $user->update([
                'google_id' => $googleUser->getId(),
                'avatar' => $avatar,
            ]);

            Auth::login($user);

            return redirect()->intended(route('dashboard', absolute: false));
        }

        // Si no existe ni email ni google_id, registramos al nuevo usuario
        $baseName = $googleUser->getName() ?? $googleUser->getNickname() ?? 'Usuario';
        $baseUsername = str($baseName)->slug()->replace('-', '_')->toString();

        // Aseguramos que el username sea único añadiendo un sufijo aleatorio corto
        $username = $baseUsername.'_'.strtolower(str()->random(4));

        $user = User::create([
            'name' => $baseName,
            'username' => $username,
            'email' => $googleUser->getEmail(),
            'google_id' => $googleUser->getId(),
            'avatar' => $this->avatarDownloader->download($googleUser->getAvatar()),
            // Generamos una contraseña aleatoria ya que no utilizará password para entrar de forma nativa a priori
            'password' => bcrypt(str()->random(24)),
            // terms_accepted_at queda null intencionalmente: el callback no recoge
            // consentimiento. Lo pediremos en el interstitial /auth/google/complete.
        ]);

        // Marcamos el correo como verificado porque viene autenticado por Google
        $user->markEmailAsVerified();

        Auth::login($user);

        // Fase 5 — Primer registro vía Google: pedimos consentimiento explícito
        // (Términos + edad ≥14) antes de dejarlo navegar el portal.
        return redirect()->route('auth.google.complete');
    }

    /**
     * Desvincula la cuenta de Google del usuario autenticado.
     */
    public function unlink(): RedirectResponse
    {
        $user = Auth::user();

        // Validamos si el usuario tiene contraseña. Si no tiene, no puede desvincular Google
        // o perdería el acceso a su cuenta por completo.
        if (empty($user->password)) {
            return back()->with('error', 'No puedes desvincular Google porque no has establecido una contraseña para tu cuenta nativa.');
        }

        // Si el avatar del usuario es una URL externa (heredada de Google sin descargar),
        // al desvincular ya no queremos depender de ella.
        if ($this->isExternalAvatar($user->avatar)) {
            $user->avatar = null;
        }

        $user->update([
            'google_id' => null,
            'avatar' => $user->avatar,
        ]);

        return back()->with('status', 'google-unlinked');
    }

    /**
     * Un avatar se considera externo si es una URL absoluta (http/https).
     * Los avatares locales se guardan como rutas relativas (/storage/...).
     */
    private function isExternalAvatar(?string $avatar): bool
    {
        return $avatar !== null && str_starts_with($avatar, 'http');
    }
}
