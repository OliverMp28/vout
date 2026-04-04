<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class VisionLabController extends Controller
{
    /**
     * Muestra la página de debug Vision Lab.
     *
     * Solo disponible en entorno local (la ruta se registra condicionalmente).
     */
    public function __invoke(): Response
    {
        return Inertia::render('vision-lab');
    }
}
