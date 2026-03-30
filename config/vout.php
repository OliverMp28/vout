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
];
