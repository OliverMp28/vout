<?php

namespace App\Models;

use Database\Factories\GestureConfigFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Configuración de gestos faciales del usuario.
 *
 * Cada usuario puede tener múltiples perfiles de gestos
 * (ej. "Modo Relajado", "Modo Competitivo") pero solo
 * uno puede estar activo a la vez.
 *
 * El campo `gesture_mapping` almacena un JSON con la
 * asociación gesto → acción del juego.
 */
class GestureConfig extends Model
{
    /** @use HasFactory<GestureConfigFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'profile_name',
        'detection_mode',
        'sensitivity',
        'gesture_mapping',
        'head_tracking_mode',
        'is_active',
    ];

    /**
     * Definición de casts para atributos del modelo.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'gesture_mapping' => 'array',
            'is_active' => 'boolean',
            'sensitivity' => 'integer',
        ];
    }

    /**
     * Usuario dueño de esta configuración de gestos.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
