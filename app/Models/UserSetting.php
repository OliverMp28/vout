<?php

namespace App\Models;

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
    /** @use HasFactory<\Database\Factories\UserSettingFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'dark_mode',
        'show_mascot',
        'gestures_enabled',
    ];

    /**
     * Definición de casts para atributos del modelo.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'dark_mode' => 'boolean',
            'show_mascot' => 'boolean',
            'gestures_enabled' => 'boolean',
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
