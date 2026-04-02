<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeveloperResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'bio' => $this->bio,
            'website_url' => $this->website_url,
            'logo_url' => $this->logo_url,
            'games_count' => $this->whenCounted('games'),
            'role' => $this->whenPivotLoaded('developer_game', fn () => $this->pivot->role),
        ];
    }
}
