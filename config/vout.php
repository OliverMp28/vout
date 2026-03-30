<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Vout Identity Provider Configuration (Passport)
    |--------------------------------------------------------------------------
    |
    | Centralizamos aquí la configuración criptográfica y operativa del IdP
    | para asegurar su trazabilidad y evitar "magic numbers" dispersos en
    | todo el código, especialmente los TTLs de seguridad.
    |
    */
    'passport' => [
        // Tiempo de vida oficial del Access Token usado por aplicaciones del ecosistema (standalone & web).
        'access_token_ttl_minutes' => (int) env('VOUT_PASSPORT_TOKEN_TTL_MINUTES', 60),

        // Tiempo en el que un usuario deberá reconectar o consentir explícitamente una app para no usar un refresh.
        'refresh_token_ttl_days' => (int) env('VOUT_PASSPORT_REFRESH_TOKEN_TTL_DAYS', 30),

        // Duración de Personal Access Tokens si fuesen emitidos para desarrollo manual.
        'personal_access_token_ttl_months' => (int) env('VOUT_PASSPORT_PAT_TTL_MONTHS', 6),
    ],

    /*
    |--------------------------------------------------------------------------
    | OAuth2 Scopes (Permisos del Ecosistema)
    |--------------------------------------------------------------------------
    |
    | Define los permisos que las aplicaciones del ecosistema pueden solicitar.
    | Cada scope limita qué datos del usuario se comparten con la app.
    | Formato: 'scope:id' => 'Descripción legible para el usuario'.
    |
    | Convención de nombres:
    |   - recurso:acción (ej. user:read, games:write)
    |   - Usar ':' como separador de namespace
    |
    */
    'scopes' => [
        'user:read'   => 'Ver tu perfil público (nombre, usuario, avatar)',
        'user:email'  => 'Ver tu dirección de correo electrónico',
        'games:read'  => 'Ver tu historial y estadísticas de juegos',
        'games:write' => 'Guardar progreso y puntuaciones en juegos',
    ],

    // Scope que se asigna por defecto si la app no solicita ninguno explícitamente.
    'default_scope' => 'user:read',
];

