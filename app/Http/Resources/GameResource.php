<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GameResource extends JsonResource
{
    /**
     * Transforma el juego para su uso en el catálogo y la SPA.
     *
     * El bloque user_interaction se incluye solo cuando el usuario está
     * autenticado y la relación ha sido cargada mediante scopeWithUserInteraction.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'cover_image' => $this->cover_image,
            'embed_url' => $this->embed_url,
            'release_date' => $this->release_date?->toDateString(),
            'play_count' => $this->play_count,
            'is_active' => $this->is_active,
            'is_featured' => $this->is_featured,
            'categories' => CategoryResource::collection($this->whenLoaded('categories')),
            'developers' => DeveloperResource::collection($this->whenLoaded('developers')),
            'user_interaction' => $this->when(
                $request->user() !== null && $this->is_favorite !== null,
                fn () => [
                    'is_favorite' => (bool) $this->is_favorite,
                    'is_saved' => (bool) $this->is_saved,
                    'play_count_user' => (int) ($this->play_count_user ?? 0),
                    'best_score' => $this->best_score !== null ? (int) $this->best_score : null,
                    'last_played_at' => $this->last_played_at,
                ],
            ),
        ];
    }
}
