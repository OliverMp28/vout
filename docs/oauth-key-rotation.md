# Rotación de claves OAuth de Vout (runbook)

Procedimiento operativo para rotar el par de claves RSA con el que Passport firma los Access Tokens (`storage/oauth-private.key` + `storage/oauth-public.key`). Pensado para que el día que toque hacerlo no haya improvisación.

**Audiencia:** mantenedores de Vout. No es algo que toquen los devs externos del ecosistema.

---

## Cuándo rotar

- **Programado** (recomendado): una vez al año como higiene preventiva. La ventana de exposición ante una filtración silenciosa queda acotada.
- **Reactivo** (urgente): sospecha de filtración, servidor comprometido, miembro del equipo con acceso al servidor que sale del proyecto, fallo en la gestión de backups, etc.
- **Por compliance**: si Vout llega a integrarse en un entorno con certificación que exija rotación periódica (no es el caso ahora).

Si la rotación es **reactiva**, el procedimiento cambia — saltar al apartado [Rotación de emergencia](#rotación-de-emergencia).

---

## Modelo mental

Vout firma cada JWT con la **clave privada**. Cualquier Resource Server del ecosistema valida la firma con la **clave pública** que descarga del JWKS (`/oauth/jwks`).

El `kid` del header del JWT identifica con qué clave se firmó — es el thumbprint RFC 7638 derivado del JWK. Cuando rotemos:

1. Habrá tokens vivos firmados con la clave **vieja** (TTL máximo: `vout.passport.access_token_ttl_minutes` minutos, por defecto 60).
2. Tokens nuevos se firmarán con la **nueva**.
3. El JWKS debe exponer **ambas claves a la vez** durante la transición para que ningún consumidor rechace tokens vivos legítimos.
4. Pasada la TTL de la vieja, los tokens firmados con ella ya están expirados y se puede retirar del JWKS.

El código de Vout ya soporta `keys` con múltiples entradas — solo hay que extender [`App\Support\Jwks`](../app/Support/Jwks.php) para que lea más de un archivo.

---

## Procedimiento estándar (sin presión de tiempo)

### Fase 1 — Generar la nueva clave (sin tocar la actual)

```bash
# En el servidor de producción de Vout
cd storage/

# Generar nuevo par RSA-4096 (mismo bit-length que la actual)
openssl genrsa -out oauth-private-next.key 4096
openssl rsa -in oauth-private-next.key -pubout -out oauth-public-next.key
chmod 600 oauth-private-next.key
chmod 644 oauth-public-next.key
```

La clave nueva queda lista pero **no se está usando todavía**.

### Fase 2 — Publicar la nueva en el JWKS (sin firmar con ella aún)

Editar [`App\Support\Jwks::buildJwks()`](../app/Support/Jwks.php) para listar ambos archivos:

```php
// Pseudo: el método actual devuelve un único JWK; pasarlo a array
public static function publicJwks(): array
{
    return [
        self::buildJwkFromPath(storage_path('oauth-public.key')),       // actual
        self::buildJwkFromPath(storage_path('oauth-public-next.key')),  // próxima
    ];
}
```

Y `JwksController::__invoke()` retorna `{ keys: Jwks::publicJwks() }` en lugar de un único JWK.

Limpiar la cache:

```bash
php artisan cache:forget vout.jwks.public
```

A partir de aquí, los consumidores que descarguen `/oauth/jwks` ya ven las dos claves. Como sus librerías eligen por `kid`, los tokens vigentes (firmados con la vieja) **siguen validándose normalmente**. Nada cambia para ellos.

### Fase 3 — Promocionar la nueva como activa

Cuando todos los consumidores hayan refrescado su JWKS — depende del `Cache-Control` que respeten, **espera al menos 1h** después de Fase 2:

```bash
cd storage/
mv oauth-private.key oauth-private-old.key
mv oauth-public.key oauth-public-old.key
mv oauth-private-next.key oauth-private.key
mv oauth-public-next.key oauth-public.key
```

A partir de ahora, Passport firma con la **nueva**. Los tokens nuevos llevan el `kid` nuevo, y los consumidores ya tienen ese JWK en su cache, así que validan sin problema.

Limpiar de nuevo la cache:

```bash
php artisan cache:forget vout.jwks.public
```

### Fase 4 — Esperar a que mueran los tokens viejos

Desde la Fase 3, espera **TTL máximo + margen**: `access_token_ttl_minutes + 15min` (por defecto 60+15 = 1h 15min). Cualquier token firmado con la vieja ya estará expirado.

### Fase 5 — Retirar la clave vieja del JWKS

Volver a editar `Jwks::publicJwks()` para listar solo la actual:

```php
return [
    self::buildJwkFromPath(storage_path('oauth-public.key')),
];
```

Limpiar cache:

```bash
php artisan cache:forget vout.jwks.public
```

Y borrar los archivos viejos del disco:

```bash
rm storage/oauth-private-old.key storage/oauth-public-old.key
```

Rotación completa.

---

## Rotación de emergencia

Si sospechas que la clave privada está comprometida, **no hay tiempo para Fase 4**. Procedimiento:

1. Genera el par nuevo (Fase 1, igual).
2. **Reemplaza directamente** `oauth-private.key` y `oauth-public.key` con los nuevos. Los tokens en circulación firmados con la vieja **dejan de validar** instantáneamente — esto invalida sesiones activas legítimas, pero también las de un atacante con la clave robada.
3. Publica el nuevo JWKS (cache:forget). Los consumidores volverán a validar tokens nuevos.
4. Anuncia a los integradores del ecosistema que pueden ver errores transitorios y deben pedir a sus usuarios que vuelvan a iniciar sesión.

Coste: jugadores expulsados a media partida durante ~unos minutos. Beneficio: cierre instantáneo del agujero.

---

## Verificación

Tras cualquier rotación, valida en orden:

```bash
# 1. JWKS lista las claves esperadas
curl -s https://vout.app/oauth/jwks | jq '.keys[] | .kid'

# 2. Un token recién emitido lleva el kid esperado
TOKEN=$(...)  # emite uno con cualquier flow
echo $TOKEN | cut -d. -f1 | base64 -d 2>/dev/null | jq '.kid'

# 3. La validación stateless funciona desde un consumer real (Daino, etc.)
```

Si el `kid` del paso 2 no aparece en la lista del paso 1, **algo salió mal** — vuelve atrás (mover los archivos `*-old.key` a su sitio original).

---

## Lo que el código YA soporta

- `App\Support\Jwks` cachea el JWK con `Cache::put(..., 3600)` — invalidable con `cache:forget vout.jwks.public`.
- `JwksController` devuelve `{ keys: [...] }` — el array ya está en su sitio, solo hay que meterle más entradas.
- El `kid` se deriva matemáticamente del JWK (RFC 7638 thumbprint), nunca colisiona entre claves distintas.
- Los consumidores que usen `jose` (Node), `lcobucci/jwt` con re-fetch, `python-jose`, `node-openid-client`, etc. detectan automáticamente `kid` desconocidos y refrescan el JWKS — la rotación es transparente para ellos sin código adicional.

## Lo que el código NO soporta todavía

- `Jwks::publicJwk()` (singular) asume una sola clave. Fase 2 requiere migrarlo a `publicJwks()` (plural).
- El `AccessToken` personalizado siempre firma con `oauth-private.key`. Eso lo hace Passport por debajo, leyéndolo del path por defecto. Para firmar con una clave alternativa habría que tocar la config de Passport (`Passport::loadKeysFrom(...)`) — o, más simple, mover archivos como propone Fase 3.

Si llega el momento de la primera rotación real, abrir un PR primero con el cambio de `Jwks` (singular → plural) **antes** de tocar los archivos. Tests cubren el escenario multi-key con un par sintético generado en `setUp()`.
