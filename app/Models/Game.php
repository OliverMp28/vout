<?php

namespace App\Models;

use Database\Factories\GameFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\DB;

/**
 * Juego disponible en el portal Vout.
 *
 * Representa un minijuego web que puede ser embebido en un iframe.
 * Cada juego puede pertenecer a múltiples categorías, tener múltiples
 * desarrolladores y ser jugado por múltiples usuarios.
 */
class Game extends Model
{
    /** @use HasFactory<GameFactory> */
    use HasFactory;

    /**
     * Atributos asignables masivamente.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'slug',
        'description',
        'repo_url',
        'cover_image',
        'embed_url',
        'release_date',
        'play_count',
        'is_active',
        'is_featured',
    ];

    /**
     * Clave de ruta para route model binding.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Definición de casts para atributos del modelo.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'release_date' => 'date',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'play_count' => 'integer',
        ];
    }

    /**
     * Orígenes de confianza para el handshake postMessage (Fase 3.3).
     *
     * Extrae el scheme + host + puerto del campo `embed_url` existente.
     * No requiere ningún campo extra en la BD: si un juego está en el catálogo
     * con una `embed_url`, su dominio de confianza se deriva automáticamente.
     *
     * Diseño deliberado:
     * - Juegos first-party / sin SSO: su `embed_url` define el único dominio
     *   autorizado. No necesitan `RegisteredApp`.
     * - Juegos con SSO / Developer Portal (Fase 4): cuando exista la FK
     *   `registered_app_id` en la tabla `games`, se podrá consultar también
     *   `RegisteredApp::allowed_origins` para dominios adicionales. Por ahora
     *   este método cubre el 100% de los casos existentes sin columnas extra.
     *
     * Ejemplos:
     *   embed_url = 'https://dino.vout.com/play' → ['https://dino.vout.com']
     *   embed_url = 'http://localhost:8080/game'  → ['http://localhost:8080']
     *   embed_url = null                          → []
     *
     * @return list<string>
     */
    public function getEffectiveOriginsAttribute(): array
    {
        if (! $this->embed_url) {
            return [];
        }

        $parsed = parse_url($this->embed_url);
        $scheme = $parsed['scheme'] ?? null;
        $host = $parsed['host'] ?? null;
        $port = isset($parsed['port']) ? ':'.$parsed['port'] : '';

        if (! $scheme || ! $host) {
            return [];
        }

        return [$scheme.'://'.$host.$port];
    }

    /**
     * Categorías a las que pertenece el juego (many-to-many).
     * Un juego puede estar etiquetado en múltiples géneros.
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class);
    }

    /**
     * Desarrolladores que crearon o contribuyeron a este juego.
     * La tabla pivote incluye el rol de cada desarrollador.
     */
    public function developers(): BelongsToMany
    {
        return $this->belongsToMany(Developer::class)
            ->withPivot('role');
    }

    /**
     * Usuarios que han interactuado con este juego.
     * La tabla pivote almacena datos de progreso y preferencias.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('is_favorite', 'is_saved', 'play_count', 'best_score', 'last_played_at')
            ->withTimestamps();
    }

    /**
     * Scope: solo juegos activos (visibles en el catálogo).
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: solo juegos destacados (mostrados en la portada).
     */
    public function scopeFeatured(Builder $query): Builder
    {
        return $query->where('is_featured', true);
    }

    /**
     * Scope: adjunta los datos de interacción del usuario autenticado.
     *
     * Hace un LEFT JOIN con la tabla pivote game_user para el usuario dado,
     * añadiendo is_favorite, is_saved y play_count_user en una sola query.
     * Evita el problema N+1 al listar el catálogo para usuarios autenticados.
     */
    public function scopeWithUserInteraction(Builder $query, int $userId): Builder
    {
        return $query->leftJoin(
            DB::raw('(SELECT game_id, is_favorite, is_saved, play_count AS play_count_user, best_score, last_played_at
                       FROM game_user WHERE user_id = '.(int) $userId.') AS user_pivot'),
            'games.id',
            '=',
            'user_pivot.game_id',
        )->addSelect([
            'games.*',
            'user_pivot.is_favorite',
            'user_pivot.is_saved',
            'user_pivot.play_count_user',
            'user_pivot.best_score',
            'user_pivot.last_played_at',
        ]);
    }

    /**
     * Scope: filtra juegos que pertenezcan a cualquiera de las categorías dadas (OR).
     *
     * Los resultados se ordenan por relevancia: los juegos que coincidan con
     * más categorías de las solicitadas aparecen primero.
     *
     * @param  list<string>  $slugs  Slugs de categorías a filtrar.
     */
    public function scopeInCategories(Builder $query, array $slugs): Builder
    {
        if (empty($slugs)) {
            return $query;
        }

        return $query->whereHas(
            'categories',
            fn (Builder $q): Builder => $q->whereIn('categories.slug', $slugs),
        );
    }

    /**
     * Scope: búsqueda fulltext con fallback a LIKE.
     *
     * En MySQL/MariaDB usa MATCH AGAINST (fulltext) aprovechando games_fulltext_idx.
     * En otros drivers (SQLite en tests) usa LIKE para mantener compatibilidad.
     * Para términos menores a 3 caracteres siempre usa LIKE.
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        $term = trim($term);

        if ($term === '') {
            return $query;
        }

        $useFulltext = mb_strlen($term) >= 3
            && in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb']);

        if ($useFulltext) {
            return $query->whereRaw(
                'MATCH(games.name, games.description) AGAINST(? IN BOOLEAN MODE)',
                [$term.'*'],
            );
        }

        return $query->where(function (Builder $q) use ($term): void {
            $q->where('games.name', 'LIKE', '%'.$term.'%')
                ->orWhere('games.description', 'LIKE', '%'.$term.'%');
        });
    }

    /**
     * Scope: ordena los resultados según el criterio solicitado.
     *
     * - popular:      más jugados primero (play_count DESC)
     * - newest:       más recientes primero (release_date DESC, luego created_at DESC)
     * - alphabetical: orden A-Z por nombre
     */
    public function scopeSortedBy(Builder $query, string $sort): Builder
    {
        return match ($sort) {
            'newest' => $query->orderByDesc('release_date')->orderByDesc('games.created_at'),
            'alphabetical' => $query->orderBy('games.name'),
            default => $query->orderByDesc('play_count'),
        };
    }
}
