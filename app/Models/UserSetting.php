<?php

namespace App\Models;

use App\Enums\FacialControlUsage;
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
        'facial_control_usage',
        'camera_autostart',
        'dashboard_welcome_dismissed_at',
    ];

    /**
     * Valores por defecto, iguales a los de la migración: la fila se crea
     * sobre la marcha en varios sitios y así el modelo recién creado ya los
     * tiene (sin volver a leerlo de la base de datos).
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'appearance' => 'system',
        'show_mascot' => true,
        'facial_control_usage' => 'off',
        'camera_autostart' => false,
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
            'facial_control_usage' => FacialControlUsage::class,
            'camera_autostart' => 'boolean',
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
