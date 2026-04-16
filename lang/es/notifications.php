<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Notification Language Lines
    |--------------------------------------------------------------------------
    |
    | Used by mail and database notifications sent from the admin panel.
    |
    */

    'app_suspended' => [
        'subject' => 'Tu app ":app" ha sido suspendida',
        'greeting' => 'Hola :name,',
        'line1' => 'Tu app ":app" ha sido suspendida por un administrador de Vout.',
        'reason' => 'Motivo: :reason',
        'line2' => 'Si crees que es un error, contacta con soporte. Tras la reactivación, deberás regenerar tus credenciales OAuth.',
        'action' => 'Ir al Dashboard de Desarrollador',
    ],

    'game_approved' => [
        'subject' => 'Tu juego ":game" ha sido aprobado',
        'greeting' => 'Hola :name,',
        'line1' => 'Tu juego ":game" ha sido revisado y aprobado por el equipo de Vout.',
        'line2' => 'Ya está publicado y visible en el catálogo público. ¡Felicidades!',
        'action' => 'Ver tu juego',
    ],

    'game_rejected' => [
        'subject' => 'Tu juego ":game" necesita cambios',
        'greeting' => 'Hola :name,',
        'line1' => 'Tu juego ":game" ha sido revisado pero no fue aprobado en esta ocasión.',
        'reason' => 'Motivo: :reason',
        'line2' => 'Puedes editar tu juego y reenviarlo para otra revisión desde tu Dashboard de Desarrollador.',
        'action' => 'Editar y reenviar',
    ],

];
