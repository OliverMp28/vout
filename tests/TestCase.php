<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Passport\ClientRepository;

abstract class TestCase extends BaseTestCase
{
    /**
     * Crea el cliente de acceso personal de Passport necesario para tests.
     *
     * Al usar RefreshDatabase, la tabla oauth_clients se vacía en cada test.
     * Este helper registra el cliente personal mínimo para que `createToken()`
     * funcione en tests que involucren PlayController u otros usos de PAT.
     *
     * Llamar en el test cuando se necesite: $this->setUpPassport()
     * O sobreescribir setUp() en una clase de test concreta.
     */
    protected function setUpPassport(): void
    {
        app(ClientRepository::class)->createPersonalAccessGrantClient(
            'Test Personal Access Client',
        );
    }
}
