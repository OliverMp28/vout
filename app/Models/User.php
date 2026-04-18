<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Passport\Contracts\OAuthenticatable;
use Laravel\Passport\HasApiTokens;

/**
 * Usuario del ecosistema Vout.
 *
 * Es la entidad central del sistema de identidad (IdP).
 * Un usuario puede tener configuración personal, perfiles
 * de gestos faciales, y un historial de juegos interactuados.
 */
class User extends Authenticatable implements OAuthenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens;

    use HasFactory;
    use Notifiable;
    use TwoFactorAuthenticatable;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'vout_id',
        'name',
        'username',
        'email',
        'password',
        'avatar',
        'bio',
        'google_id',
        'is_admin',
        'terms_accepted_at',
        'privacy_version_accepted',
    ];

    /**
     * Hook para modelos
     */
    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if (empty($user->vout_id)) {
                $user->vout_id = (string) Str::uuid();
            }
        });
    }

    /**
     * Atributos ocultos en la serialización (JSON/array).
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Definición de casts para atributos del modelo.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'is_admin' => 'boolean',
            'terms_accepted_at' => 'datetime',
        ];
    }

    // ─── Relaciones ──────────────────────────────────────────

    /**
     * Configuración personal del usuario (modo oscuro, mascota, etc.).
     * Relación uno-a-uno.
     */
    public function settings(): HasOne
    {
        return $this->hasOne(UserSetting::class);
    }

    /**
     * Perfiles de configuración de gestos faciales del usuario.
     * Un usuario puede tener múltiples perfiles de gestos.
     */
    public function gestureConfigs(): HasMany
    {
        return $this->hasMany(GestureConfig::class);
    }

    /**
     * Perfil de gestos actualmente activo del usuario, si existe.
     * Simplifica consultas frecuentes (dashboard, play, calibración).
     */
    public function activeGestureConfig(): HasOne
    {
        return $this->hasOne(GestureConfig::class)->where('is_active', true);
    }

    /**
     * Juegos con los que el usuario ha interactuado.
     * La tabla pivote almacena favoritos, puntuaciones y conteo de partidas.
     */
    public function games(): BelongsToMany
    {
        return $this->belongsToMany(Game::class)
            ->withPivot('is_favorite', 'is_saved', 'play_count', 'best_score', 'last_played_at')
            ->withTimestamps();
    }

    /**
     * Aplicaciones del ecosistema OAuth registradas por el usuario
     * desde el Developer Portal (Fase 4.1).
     */
    public function registeredApps(): HasMany
    {
        return $this->hasMany(RegisteredApp::class);
    }

    /**
     * Juegos que el usuario ha enviado al catálogo desde el Developer Portal
     * (Fase 4.1). No confundir con `games()` (interacción/historial).
     */
    public function submittedGames(): HasMany
    {
        return $this->hasMany(Game::class, 'submitted_by_user_id');
    }

    /**
     * Ficha pública de desarrollador mantenida por el usuario (Fase 4.2 S4.5).
     * Opcional — un user puede no haber reclamado ninguna ficha aún.
     */
    public function developerProfile(): HasOne
    {
        return $this->hasOne(Developer::class);
    }

    // ─── Accessors ───────────────────────────────────────────

    /**
     * Indica si el usuario tiene una cuenta de Google vinculada.
     * Útil para verificar rápidamente el estado SSO del perfil.
     */
    protected function hasGoogleLinked(): Attribute
    {
        return Attribute::get(fn (): bool => $this->google_id !== null);
    }

    // ─── Scopes ──────────────────────────────────────────────

    /**
     * Scope: solo usuarios con cuenta de Google vinculada.
     */
    public function scopeWithGoogle(Builder $query): Builder
    {
        return $query->whereNotNull('google_id');
    }

    /**
     * Scope: solo usuarios con privilegios administrativos (Fase 4.2).
     */
    public function scopeAdmins(Builder $query): Builder
    {
        return $query->where('is_admin', true);
    }
}
