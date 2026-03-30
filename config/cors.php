<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) – Ecosistema Vout
    |--------------------------------------------------------------------------
    |
    | Configuración de cabeceras CORS para el IdP de Vout.
    |
    | Las rutas /api/* y /oauth/* deben ser accesibles desde las aplicaciones
    | del ecosistema (juegos propios y de terceros) que corren en dominios
    | diferentes al de Vout.
    |
    | Nota para producción: reemplaza el wildcard de allowed_origins con los
    | dominios específicos de tus apps registradas, o implementa CORS dinámico
    | basado en la tabla registered_apps.allowed_origins.
    |
    | Referencia: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'oauth/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [env('APP_URL', 'http://localhost')],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];

