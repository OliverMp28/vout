<?php

use App\Services\ExternalAvatarDownloader;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
});

it('downloads a valid image and returns a local storage path', function () {
    Http::fake([
        'lh3.googleusercontent.com/*' => Http::response(
            fakePngBytes(),
            200,
            ['Content-Type' => 'image/png']
        ),
    ]);

    $path = app(ExternalAvatarDownloader::class)
        ->download('https://lh3.googleusercontent.com/a/avatar.jpg');

    expect($path)->toStartWith('/storage/avatars/')
        ->and($path)->toEndWith('.png');

    Storage::disk('public')->assertExists(str_replace('/storage/', '', $path));
});

it('returns null when the remote returns a non-successful status', function () {
    Http::fake([
        '*' => Http::response('', 429),
    ]);

    $path = app(ExternalAvatarDownloader::class)
        ->download('https://example.com/avatar.jpg');

    expect($path)->toBeNull();
});

it('returns null when the content type is not a supported image', function () {
    Http::fake([
        '*' => Http::response('not an image', 200, ['Content-Type' => 'text/html']),
    ]);

    $path = app(ExternalAvatarDownloader::class)
        ->download('https://example.com/avatar.jpg');

    expect($path)->toBeNull();
});

it('returns null for invalid or empty urls', function () {
    $downloader = app(ExternalAvatarDownloader::class);

    expect($downloader->download(null))->toBeNull()
        ->and($downloader->download(''))->toBeNull()
        ->and($downloader->download('not-a-url'))->toBeNull();
});

it('returns null when the request throws an exception', function () {
    Http::fake(function () {
        throw new RuntimeException('connection refused');
    });

    $path = app(ExternalAvatarDownloader::class)
        ->download('https://example.com/avatar.jpg');

    expect($path)->toBeNull();
});
