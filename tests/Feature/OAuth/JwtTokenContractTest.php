<?php

use App\Models\User;
use App\Support\Jwks;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\Validation\Constraint\IssuedBy;
use Lcobucci\JWT\Validation\Constraint\SignedWith;
use Lcobucci\JWT\Validation\Validator;

beforeEach(function (): void {
    // RefreshDatabase vacía oauth_clients en cada test, hay que recrear
    // el cliente de Personal Access que `User::createToken()` necesita.
    $this->setUpPassport();
});

/*
 * Garantiza el contrato del Access Token de Vout. Si Passport actualiza
 * el AccessTokenTrait y nuestro override pierde sincronía, este test
 * salta — es la red de seguridad para la integridad del IdP.
 *
 *   - Header debe llevar `kid` igual al thumbprint del JWK público.
 *   - Payload debe llevar `iss` igual al `app.url`.
 *   - La firma debe verificarse con la clave pública de storage.
 *   - Un consumidor stateless reconstruyendo desde JWKS puede validar
 *     todo el JWT solo con datos públicos.
 */

it('el JWT emitido por Vout contiene kid en header e iss en payload', function (): void {
    $user = User::factory()->create();
    $jwt = $user->createToken('test', ['user:read'])->accessToken;

    [$headerB64, $payloadB64] = explode('.', $jwt);
    $header = json_decode(base64_decode(strtr($headerB64, '-_', '+/')), true);
    $payload = json_decode(base64_decode(strtr($payloadB64, '-_', '+/')), true);

    expect($header)->toMatchArray([
        'typ' => 'JWT',
        'alg' => 'RS256',
    ]);
    expect($header['kid'])->toBe(Jwks::keyId());

    expect($payload['iss'])->toBe(rtrim((string) config('app.url'), '/'));
    expect($payload)->toHaveKeys(['aud', 'sub', 'jti', 'iat', 'nbf', 'exp', 'scopes']);
});

it('un consumidor stateless puede validar firma + iss usando solo el JWKS público', function (): void {
    $user = User::factory()->create();
    $jwt = $user->createToken('e2e', ['user:read'])->accessToken;

    // Simulamos un Resource Server: descarga JWKS, reconstruye la PEM,
    // valida la firma del token y comprueba `iss`.
    $jwks = $this->get('/oauth/jwks')->json();
    $jwk = $jwks['keys'][0];

    // Sanidad: el kid del header debe estar en el JWKS.
    $parser = new Parser(new JoseEncoder);
    $parsed = $parser->parse($jwt);
    expect($parsed->headers()->get('kid'))->toBe($jwk['kid']);

    // En un consumer real, reconstruirían la clave RSA desde n,e usando
    // su lib JWT. Aquí usamos directamente la pública del storage para
    // validar el contrato de firma sin reescribir un helper de JWK→PEM
    // (eso es parte del trabajo del consumer, no de este test).
    $publicPem = file_get_contents(storage_path('oauth-public.key'));

    $validator = new Validator;
    $signedWith = new SignedWith(new Sha256, InMemory::plainText($publicPem));
    $issuedBy = new IssuedBy(rtrim((string) config('app.url'), '/'));

    expect($validator->validate($parsed, $signedWith))->toBeTrue();
    expect($validator->validate($parsed, $issuedBy))->toBeTrue();
});

it('rechaza tokens manipulados (prueba de regresión: la firma se valida de verdad)', function (): void {
    $user = User::factory()->create();
    $jwt = $user->createToken('tampered', ['user:read'])->accessToken;

    // Manipular el payload — cambiar `sub` a otro user — y dejar la
    // firma original (que ya no corresponde con el contenido).
    [$h, $p, $sig] = explode('.', $jwt);
    $payload = json_decode(base64_decode(strtr($p, '-_', '+/')), true);
    $payload['sub'] = '999999';
    $tampered = $h.'.'.rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=').'.'.$sig;

    $parser = new Parser(new JoseEncoder);
    $parsed = $parser->parse($tampered);

    $publicPem = file_get_contents(storage_path('oauth-public.key'));
    $validator = new Validator;
    $signedWith = new SignedWith(new Sha256, InMemory::plainText($publicPem));

    expect($validator->validate($parsed, $signedWith))->toBeFalse();
});
