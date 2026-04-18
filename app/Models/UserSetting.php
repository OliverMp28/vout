<?php

namespace App\Models;

use Database\Factories\UserSettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Preferencias personales del usuario en el portal.
 *
 * Cada usuario tiene un único registro de configuración (one-to-one)
 * que controla opciones de interfaz y funcionalidad.
 */
class UserSetting extends Model
{
    /** @use HasFactory<UserSettingFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'locale',
        'appearance',
        'show_mascot',
        'gestures_enabled',
        'dashboard_welcome_dismissed_at',
    ];

    /**
     * Definición de casts para atributos del modelo.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'show_mascot' => 'boolean',
            'gestures_enabled' => 'boolean',
            'dashboard_welcome_dismissed_at' => 'datetime',
        ];
    }

    /**
     * Usuario dueño de esta configuración.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
