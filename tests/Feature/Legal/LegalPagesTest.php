<?php

use function Pest\Laravel\get;

it('renders the legal notice in Spanish by default', function (): void {
    app()->setLocale('es');

    get(route('legal.show', ['slug' => 'aviso-legal']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('legal/show', false)
            ->where('slug', 'aviso-legal')
            ->where('locale', 'es')
            ->where('version', '1.0.0')
            ->where('last_updated', '2026-04-18')
            ->has('markdown')
            ->has('available_locales', 2)
            ->has('documents', 4)
        );
});

it('renders the privacy policy', function (): void {
    get(route('legal.show', ['slug' => 'privacidad']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('legal/show', false)
            ->where('slug', 'privacidad')
            ->has('markdown')
        );
});

it('renders the cookie policy', function (): void {
    get(route('legal.show', ['slug' => 'cookies']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('legal/show', false)
            ->where('slug', 'cookies')
        );
});

it('renders the terms of service', function (): void {
    get(route('legal.show', ['slug' => 'terminos']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('legal/show', false)
            ->where('slug', 'terminos')
        );
});

it('serves English markdown when the locale is en', function (): void {
    app()->setLocale('en');

    get(route('legal.show', ['slug' => 'aviso-legal']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('locale', 'en')
            ->where('markdown', fn (string $md) => str_contains($md, '# Legal Notice'))
        );
});

it('substitutes config tokens in markdown', function (): void {
    config()->set('vout.legal.contact_email', 'legal-test@vout.example');
    config()->set('vout.legal.holder_name', 'Testing Operator');

    get(route('legal.show', ['slug' => 'aviso-legal']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('markdown', fn (string $md) => str_contains($md, 'legal-test@vout.example')
                && str_contains($md, 'Testing Operator')
                && ! str_contains($md, '{{contact_email}}')
                && ! str_contains($md, '{{holder_name}}'))
        );
});

it('accepts the english alias "privacy" for the privacy policy', function (): void {
    get(route('legal.show', ['slug' => 'privacy']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('slug', 'privacidad'));
});

it('accepts the english alias "notice" for the legal notice', function (): void {
    get(route('legal.show', ['slug' => 'notice']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('slug', 'aviso-legal'));
});

it('accepts the english alias "terms" for the terms of service', function (): void {
    get(route('legal.show', ['slug' => 'terms']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('slug', 'terminos'));
});

it('returns 404 for slugs outside the whitelist', function (): void {
    get(route('legal.show', ['slug' => 'privacy-policy']))->assertNotFound();
    get(route('legal.show', ['slug' => 'unknown']))->assertNotFound();
});

it('blocks path traversal attempts via the slug', function (): void {
    // The `where('slug', '[a-z0-9-]+')` regex rejects these before the controller runs.
    get('/legal/..%2F..%2Fconfig%2Fapp')->assertNotFound();
    get('/legal/../secret')->assertNotFound();
    get('/legal/aviso-legal/../../etc/passwd')->assertNotFound();
});

it('exposes every real cookie in the cookies policy table', function (): void {
    get(route('legal.show', ['slug' => 'cookies']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('slug', 'cookies')
            ->where('version', '1.0.0')
            ->where('markdown', function (string $md): bool {
                // Each name that actually exists at runtime must appear in
                // the user-facing cookie table — guarantees we never ship a
                // policy that hides a cookie (AEPD 2024 §minimum inventory).
                foreach ([
                    'vout-session',
                    'XSRF-TOKEN',
                    'remember_web_*',
                    'appearance',
                    'sidebar_state',
                    'vout-cookie-consent',
                ] as $name) {
                    if (! str_contains($md, $name)) {
                        return false;
                    }
                }

                return true;
            })
        );
});

it('exposes the four legal documents in the sidebar menu', function (): void {
    get(route('legal.show', ['slug' => 'aviso-legal']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('documents.0.slug', 'aviso-legal')
            ->where('documents.1.slug', 'privacidad')
            ->where('documents.2.slug', 'cookies')
            ->where('documents.3.slug', 'terminos')
        );
});
