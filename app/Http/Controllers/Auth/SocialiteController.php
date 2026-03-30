<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class SocialiteController extends Controller
{
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
            // Usuario encontrado con google_id, iniciamos sesión
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

            // Vinculamos (o re-vinculamos si era el mismo) la cuenta de Google.
            $user->update([
                'google_id' => $googleUser->getId(),
                // Actualizamos el avatar solo si el usuario no tiene uno customizado
                'avatar' => $user->avatar ?? $googleUser->getAvatar(),
            ]);

            Auth::login($user);
            return redirect()->intended(route('dashboard', absolute: false));
        }

        // Si no existe ni email ni google_id, registramos al nuevo usuario
        $baseName = $googleUser->getName() ?? $googleUser->getNickname() ?? 'Usuario';
        $baseUsername = str($baseName)->slug()->replace('-', '_')->toString();
        
        // Aseguramos que el username sea único añadiendo un sufijo aleatorio corto
        $username = $baseUsername . '_' . strtolower(str()->random(4));

        $user = User::create([
            'name' => $baseName,
            'username' => $username,
            'email' => $googleUser->getEmail(),
            'google_id' => $googleUser->getId(),
            'avatar' => $googleUser->getAvatar(),
            // Generamos una contraseña aleatoria ya que no utilizará password para entrar de forma nativa a priori
            'password' => bcrypt(str()->random(24)),
        ]);

        // Marcamos el correo como verificado porque viene autenticado por Google
        $user->markEmailAsVerified();

        Auth::login($user);

        return redirect()->intended(route('dashboard', absolute: false));
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

        $user->update([
            'google_id' => null,
        ]);

        return back()->with('status', 'google-unlinked');
    }
}
