<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ExternalAvatarDownloader
{
    private const MAX_BYTES = 5 * 1024 * 1024;

    private const ALLOWED_MIME = [
        'image/jpeg' => 'jpg',
        'image/pjpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    /**
     * Descarga un avatar externo (ej. Google) y lo persiste en el disco público.
     *
     * Devuelve la URL pública relativa (ej. /storage/avatars/abc.jpg)
     * o null si la descarga falla por cualquier motivo.
     */
    public function download(?string $url): ?string
    {
        if (! $url || ! filter_var($url, FILTER_VALIDATE_URL)) {
            return null;
        }

        try {
            $response = Http::timeout(5)
                ->withHeaders(['Referer' => ''])
                ->get($url);

            if (! $response->successful()) {
                Log::warning('External avatar download failed', [
                    'url' => $url,
                    'status' => $response->status(),
                ]);

                return null;
            }

            $body = $response->body();

            if (strlen($body) === 0 || strlen($body) > self::MAX_BYTES) {
                return null;
            }

            $mime = strtolower(explode(';', (string) $response->header('Content-Type'))[0]);
            $extension = self::ALLOWED_MIME[$mime] ?? null;

            if ($extension === null) {
                return null;
            }

            $filename = 'avatars/'.Str::random(40).'.'.$extension;

            Storage::disk('public')->put($filename, $body);

            return '/storage/'.$filename;
        } catch (\Throwable $e) {
            Log::warning('External avatar download exception', [
                'url' => $url,
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
