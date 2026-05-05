# Guía de Integración: Ecosistema de Usuarios Vout

> **Versión:** 1.0  
> **Protocolo:** OAuth 2.0 (Authorization Code + PKCE)  
> **Última actualización:** Marzo 2026

---

## ¿Qué es Vout?

Vout es un **Proveedor de Identidad (IdP)** que centraliza las cuentas de usuario para un ecosistema de minijuegos web. En lugar de que cada juego gestione su propia base de datos de usuarios, Vout ofrece un "pasaporte universal": el usuario se registra una vez y puede jugar en cualquier proyecto integrado.

**Beneficios para tu proyecto:**
- No necesitas gestionar registros, contraseñas ni recuperación de cuentas.
- Tus usuarios acceden con un clic usando su cuenta de Vout (o Google).
- Recibes un identificador único (`vout_id`) para vincular progreso y datos.

---

## Tipos de Integración

Tu proyecto puede integrarse con Vout de dos maneras:

### 1. Solo Catálogo (sin autenticación)
Tu juego aparece en el portal de Vout pero **no necesita identificar usuarios**. Ideal para juegos simples sin backend ni base de datos.

- Tu app se registra en Vout con `requires_auth = false`.
- No necesitas configurar OAuth2 ni tokens.
- El juego simplemente se carga en el portal.

### 2. Con Ecosistema de Usuarios (OAuth2)
Tu juego necesita saber **quién es el usuario** (para guardar puntuaciones, mostrar su nombre, etc.).

- Tu app se registra en Vout con `requires_auth = true`.
- Recibes un `client_id` (y opcionalmente un `client_secret`).
- Implementas el flujo OAuth2 estándar descrito a continuación.

> **Nota:** El protocolo es **exactamente el mismo** para proyectos propios y de terceros. La única diferencia es que los proyectos propios de Vout (`is_first_party = true`) no muestran pantalla de autorización al usuario — la sesión se inicia de forma transparente.

---

## Protocolo: OAuth2 Authorization Code + PKCE

Vout implementa el estándar **OAuth 2.0** con la extensión **PKCE** (Proof Key for Code Exchange), que es el flujo recomendado para aplicaciones web modernas.

### ¿Qué significa esto para ti?

Puedes usar **cualquier librería OAuth2** de tu lenguaje favorito para integrarte:

| Lenguaje / Framework | Librería sugerida |
| :--- | :--- |
| PHP (Laravel) | `laravel/socialite` con un [provider personalizado](https://socialiteproviders.com/) |
| PHP (genérico) | `league/oauth2-client` |
| JavaScript / Node.js | `openid-client`, `next-auth`, o `passport` (npm) |
| Python | `authlib`, `requests-oauthlib` |
| Cualquier otro | Cualquier cliente OAuth2/OIDC compatible |

No necesitas una librería específica de Vout. **Si tu herramienta habla OAuth2, funciona con Vout.**

---

## Flujo Paso a Paso

### Paso 1: Registra tu aplicación

Contacta al administrador de Vout para registrar tu app. Recibirás:
- **`client_id`**: Identificador público de tu aplicación (UUID).
- **`client_secret`** (opcional): Solo para aplicaciones con backend seguro. Las SPAs usan PKCE sin secret.
- **`redirect_uri`**: La URL de tu app donde Vout redirigirá al usuario tras autenticarse.

### Paso 2: Redirige al usuario a Vout

Tu aplicación redirige al usuario a la URL de autorización de Vout:

```
GET https://vout.example.com/oauth/authorize?
    client_id=TU_CLIENT_ID
    &redirect_uri=https://tu-app.com/callback
    &response_type=code
    &scope=user:read user:email
    &state=CADENA_ALEATORIA_ANTI_CSRF
    &code_challenge=HASH_SHA256_DEL_CODE_VERIFIER
    &code_challenge_method=S256
```

**Parámetros:**
| Parámetro | Obligatorio | Descripción |
| :--- | :---: | :--- |
| `client_id` | ✅ | Tu UUID de cliente |
| `redirect_uri` | ✅ | Debe coincidir con la registrada |
| `response_type` | ✅ | Siempre `code` |
| `scope` | ✅ | Permisos solicitados (ver sección Scopes) |
| `state` | ✅ | Cadena aleatoria para protección CSRF |
| `code_challenge` | ✅* | Hash SHA-256 del code verifier (PKCE) |
| `code_challenge_method` | ✅* | Siempre `S256` |

*\*Obligatorio para clientes públicos (SPAs). Recomendado para todos.*

### Paso 3: El usuario autoriza (o no)

- Si es una app **first-party**, el usuario se redirige automáticamente sin ver ningún prompt.
- Si es una app **third-party**, el usuario verá: *"La app X solicita acceso a tu perfil"*, con los scopes listados.

> **Vout recuerda el consentimiento.** Tras la primera autorización exitosa, los siguientes `/oauth/authorize` del mismo usuario para tu app saltan la pantalla y emiten el `code` directo (paridad UX con Google/GitHub). El usuario puede revocar el acceso desde `/settings/connected-apps` cuando quiera; en ese momento se invalidan los tokens activos y la próxima autorización mostrará la pantalla otra vez. Si la app pide un scope **nuevo** que el grant no cubre, Vout vuelve a preguntar (incremental consent).

### Paso 4: Intercambia el código por un token

Vout redirige al usuario de vuelta a tu `redirect_uri` con un `code` temporal:

```
GET https://tu-app.com/callback?code=CODIGO_TEMPORAL&state=TU_STATE
```

Tu backend intercambia ese código por un Access Token:

```
POST https://vout.example.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=TU_CLIENT_ID
&client_secret=TU_CLIENT_SECRET    (solo si tu cliente tiene secret)
&redirect_uri=https://tu-app.com/callback
&code=CODIGO_TEMPORAL
&code_verifier=EL_CODE_VERIFIER_ORIGINAL    (PKCE)
```

**Respuesta exitosa:**
```json
{
    "token_type": "Bearer",
    "expires_in": 3600,
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOi...",
    "refresh_token": "def50200c..."
}
```

### Paso 5: Consulta la API de Vout

Con el Access Token, puedes obtener los datos del usuario:

```
GET https://vout.example.com/api/v1/user/me
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOi...
```

**Respuesta:**
```json
{
    "data": {
        "vout_id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Oliver",
        "username": "oliver_mp",
        "avatar": "https://lh3.googleusercontent.com/...",
        "email": "oliver@example.com"
    }
}
```

> **Nota:** El campo `email` solo aparece si solicitaste el scope `user:email`.

---

## Scopes Disponibles

Los scopes controlan qué datos del usuario comparte Vout con tu app. **Importante:** Vout no almacena el progreso interno de tu juego (niveles, inventario, etc.). Esos datos los gestiona tu propia base de datos usando el `vout_id` como clave.

Los scopes relacionados con juegos sirven exclusivamente para sincronizar **metadatos globales** con el portal público de Vout (ej. mostrar récords o favoritos en el perfil público del jugador).

| Scope | Datos que incluye | Caso de uso |
| :--- | :--- | :--- |
| `user:read` | `vout_id`, `name`, `username`, `avatar` | Mostrar nombre y foto en tu juego |
| `user:email` | `email` | Enviar notificaciones, comunicación directa |
| `games:read` | Historial global y estadísticas en Vout | Saber qué otros juegos prefiere el usuario en el portal |
| `games:write` | Metadatos públicos hacia Vout | Actualizar en el portal Vout que el usuario rompió un récord en tu juego, o marcar tu juego como su favorito |

**Scope por defecto:** Si no especificas ningún scope, se asigna `user:read`.

**Buena práctica:** Solicita solo los scopes que necesitas. Los usuarios confían más en apps que piden menos permisos.

---

## Persistencia del consentimiento y parámetro `prompt`

Vout sigue la semántica de OIDC Core §3.1.2.1 para el parámetro `prompt` en `/oauth/authorize`. Por defecto, **una vez que el usuario autoriza tu app, Vout recuerda esa decisión** y futuras peticiones saltan la pantalla — incluso si la sesión web del usuario en Vout caducó. El consentimiento sobrevive a la vida del access token (60 min) y solo se borra si el usuario revoca el acceso desde `/settings/connected-apps`.

### Comportamiento por defecto (sin `prompt`)

| Estado del usuario | Resultado |
|---|---|
| Sin sesión en Vout | Vout muestra `/login`. Tras autenticar, se aplica la regla siguiente. |
| Con sesión + grant activo cubriendo los scopes pedidos | Salto directo: 302 al `redirect_uri` con `?code=...&state=...`. |
| Con sesión + grant pero piden un scope nuevo | Pantalla de consent (incremental consent). Al aprobar, el grant se actualiza con la unión de scopes. |
| Con sesión sin grant | Pantalla de consent normal. |

### Forzar comportamientos específicos

```
GET /oauth/authorize?...&prompt=consent
```

| Valor | Cuándo usarlo | Comportamiento |
|---|---|---|
| `prompt=consent` | Operaciones sensibles, "ejecutar como otro usuario", cambiar de cuenta. | Vout **siempre** muestra la pantalla aunque exista grant activo. |
| `prompt=login` | Después de un cambio de identidad o si quieres forzar verificación de credenciales. | Vout cierra la sesión actual y obliga a iniciar sesión de nuevo antes de continuar el flow. |
| `prompt=none` | SSO silencioso (típico de iframes embebidos o re-auth en background). | Si hay sesión + grant: 302 con código. Si falta cualquiera de los dos: redirige al `redirect_uri` con `?error=login_required` o `?error=consent_required` — **nunca muestra UI**. |

### Revocación desde el lado del usuario

Cualquier usuario puede entrar en `/settings/connected-apps` (en su cuenta de Vout) y revocar el acceso a tu app. Eso:

- Marca el grant como revocado (no desaparece del histórico, queda con `revoked_at`).
- Marca todos los `oauth_access_tokens` y `oauth_refresh_tokens` del par (user, client) como `revoked=1`. Tu próximo refresh fallará con `invalid_grant`.
- Los JWTs ya emitidos siguen siendo criptográficamente válidos hasta su `exp` natural (≤ 60 min), porque la validación stateless no consulta la BD. Si necesitas revocación instantánea, llama a `/api/v1/user/me` periódicamente o vuelve a stateless con TTL más corto.

Cuando el usuario revoque y vuelva a entrar en tu app, Vout mostrará la pantalla de consent otra vez como si fuera la primera vez.

---

## Validación Stateless del Token (Avanzado)

Los Access Tokens de Vout son **JWT firmados con RS256**. Esto significa que tu servidor puede validar los tokens **sin consultar la base de datos de Vout**, usando la clave pública. Útil para microservicios, APIs de alto QPS o juegos con backend que no quiera depender del round-trip a `/api/v1/user/me` en cada petición.

### Discovery automático

Vout publica un documento OIDC Discovery — la mayoría de librerías JWT modernas se autoconfiguran con solo apuntar al issuer:

```
GET https://vout.example.com/.well-known/openid-configuration
```

Respuesta (resumida):

```json
{
  "issuer": "https://vout.example.com",
  "authorization_endpoint": "https://vout.example.com/oauth/authorize",
  "token_endpoint": "https://vout.example.com/oauth/token",
  "jwks_uri": "https://vout.example.com/oauth/jwks",
  "userinfo_endpoint": "https://vout.example.com/api/v1/user/me",
  "scopes_supported": ["user:read", "user:email", "games:read", "games:write", "game:play"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials", "urn:ietf:params:oauth:grant-type:device_code"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "none"],
  "code_challenge_methods_supported": ["S256"],
  "id_token_signing_alg_values_supported": ["RS256"]
}
```

> **Aviso honesto:** Vout es **OAuth 2.0 con Access Tokens firmados (RS256)**, no un IdP OIDC completo. No emite ID Tokens ni implementa el flujo de `nonce` de OIDC. Exponemos esta URL porque las librerías cliente la usan para descubrir endpoints — todo lo que devolvemos (jwks, scopes, endpoints) es real y respetado.

### Endpoint JWKS

```
GET https://vout.example.com/oauth/jwks
```

Respuesta (RFC 7517):

```json
{
  "keys": [{
    "kty": "RSA",
    "use": "sig",
    "alg": "RS256",
    "kid": "Vw5D5w1BbAXKmaCCqc6m2MpffbXnTqaX7ye5BaNjB5U",
    "n": "sfnwC5_4zVwIJHajk3Dlsnlbl_jSOspy7Bf1vBnkeGl...",
    "e": "AQAB"
  }]
}
```

El `kid` es el JWK Thumbprint (RFC 7638), derivado matemáticamente del propio JWK — cualquier validador puede recomputarlo y verificarlo. Cuando Vout rote claves, el JWKS expondrá la antigua y la nueva durante la transición; tu librería elegirá la correcta usando el `kid` del header del JWT.

**Cabeceras de cache:** `Cache-Control: public, max-age=3600`. Tu librería normalmente cachea el JWKS automáticamente — no necesitas re-descargarlo en cada petición.

### Datos dentro del Token (Claims)

| Claim | Descripción |
| :--- | :--- |
| `iss` | URL del IdP Vout (debes validar que coincide con tu instancia) |
| `sub` | ID interno del usuario en Vout (no usar para identificarlo entre apps — usa `vout_id` desde `/api/v1/user/me`) |
| `aud` | Tu `client_id` (debes validar que coincide con el tuyo) |
| `exp` | Timestamp de expiración |
| `iat` | Timestamp de emisión |
| `nbf` | "Not before" — antes de este timestamp el token no es válido |
| `jti` | ID único del token (útil para revocación local, blacklists, etc.) |
| `scopes` | Array de scopes autorizados |

El header del JWT incluye `kid` apuntando a la clave del JWKS:

```json
{ "typ": "JWT", "alg": "RS256", "kid": "Vw5D5w1BbAXKmaCCqc6m2MpffbXnTqaX7ye5BaNjB5U" }
```

### Ejemplo de validación con `lcobucci/jwt` (PHP)

```php
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Validation\Constraint;

// Obtén la PEM de la clave pública desde el JWKS (cacheada por tu app).
// Cualquier librería JWK→PEM sirve: web-token/jwt-library, paragonie/jwt, etc.
$pem = jwksToPem(httpGet('https://vout.example.com/oauth/jwks'));

$config = Configuration::forAsymmetricSigner(
    new Sha256(),
    InMemory::plainText(''),                  // privateKey vacío: solo validamos
    InMemory::plainText($pem),                // publicKey desde JWKS
);

$token = $config->parser()->parse($accessToken);

$constraints = [
    new Constraint\SignedWith($config->signer(), $config->verificationKey()),
    new Constraint\IssuedBy('https://vout.example.com'),
    new Constraint\PermittedFor('TU_CLIENT_ID'),
    new Constraint\StrictValidAt(new \Lcobucci\Clock\SystemClock(new \DateTimeZone('UTC'))),
];

$config->validator()->assert($token, ...$constraints);
```

### Ejemplo en Node.js (`jose` / `node-openid-client`)

```js
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('https://vout.example.com/oauth/jwks'));

const { payload } = await jwtVerify(accessToken, JWKS, {
    issuer: 'https://vout.example.com',
    audience: process.env.VOUT_CLIENT_ID,
});
```

`jose` cachea el JWKS automáticamente y refresca cuando aparece un `kid` desconocido — útil para rotación de claves transparente.

### ¿Validación stateless o llamar a `/api/v1/user/me`?

Las dos son válidas, sirven escenarios distintos:

| | Validación local (JWKS) | Llamada a `/api/v1/user/me` |
| :--- | :--- | :--- |
| **Latencia** | Microsegundos (sin red) | Round-trip HTTP |
| **Detecta revocación** | No (hasta que expire el token, máx 60 min) | **Sí, instantánea** |
| **Detecta cambios de perfil** | No | Sí, en cada llamada |
| **Datos disponibles** | Solo claims del JWT | Perfil completo + `vout_id` |
| **Escalabilidad** | Excelente (sin acoplamiento a Vout) | Limitada por Vout |
| **Recomendado para** | APIs de alto QPS, microservicios | Apps con backend ligero, dashboards |

**Patrón recomendado:** valida la firma localmente (rápido) y consulta `/api/v1/user/me` solo en operaciones críticas que requieran datos frescos o detección inmediata de revocación.

---

## Refresh Tokens

Los Access Tokens expiran después de **60 minutos** (configurable). Para obtener uno nuevo sin pedir al usuario que vuelva a autorizarse:

```
POST https://vout.example.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=def50200c...
&client_id=TU_CLIENT_ID
&client_secret=TU_CLIENT_SECRET
&scope=user:read
```

Los Refresh Tokens son válidos durante **30 días** (configurable).

---

## Identificador Externo: `vout_id`

Cada usuario de Vout tiene un **UUID único** llamado `vout_id`. Este es el **único identificador** que debes almacenar en tu base de datos para vincular al usuario.

**Nunca** uses el ID autoincremental — por seguridad, Vout no lo expone externamente.

```sql
-- En tu base de datos (ejemplo para tu tabla de jugadores):
CREATE TABLE players (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vout_id CHAR(36) UNIQUE NOT NULL,  -- El UUID de Vout
    best_score INT DEFAULT 0,
    created_at TIMESTAMP
);
```

---

## Embebiendo tu juego en Vout (X-Frame-Options / CSP)

Tu juego se carga dentro de un `<iframe>` del portal Vout. Por defecto, **muchos servidores y frameworks bloquean los iframes** mediante cabeceras de seguridad — y este bloqueo lo aplica el navegador, no Vout. Si te ocurre, en la consola del navegador verás algo así:

```
Refused to display 'https://tu-juego.com/' in a frame because it set
'X-Frame-Options' to 'sameorigin'.
```

O bien:

```
Refused to frame 'https://tu-juego.com/' because an ancestor violates
the following Content Security Policy directive: "frame-ancestors 'self'".
```

**Esto ocurre en producción y en desarrollo por igual.** No es un fallo de Vout: tu servidor está diciéndole al navegador que no permite ser embebido.

### Cómo arreglarlo

El estándar moderno y recomendado es `Content-Security-Policy: frame-ancestors`, que sí permite whitelistear orígenes concretos (`X-Frame-Options` solo soporta SAMEORIGIN o DENY, sin granularidad — y queda obsoleta cuando ambas cabeceras están presentes).

En el servidor de tu juego, **elimina** `X-Frame-Options` y **añade**:

```
Content-Security-Policy: frame-ancestors 'self' https://vout.app https://www.vout.app
```

`frame-ancestors` lista los **orígenes del portal que embebe tu juego**, no los tuyos. Cambia `https://vout.app` por el dominio real de la instancia de Vout en la que registraste tu app (te lo confirmamos al darte de alta). Tu juego puede correr en `localhost`, en staging o en producción — eso no afecta a esta cabecera. Lo único que importa es de **dónde** se carga el iframe que va a contenerte: ese origen es el que tienes que autorizar.

### Recetas por stack

**Laravel** — añade un middleware o usa `spatie/laravel-csp`. El más rápido:

```php
// app/Http/Middleware/FrameAncestors.php
public function handle(Request $request, Closure $next): Response
{
    $response = $next($request);
    $response->headers->remove('X-Frame-Options');
    $response->headers->set(
        'Content-Security-Policy',
        "frame-ancestors 'self' https://vout.app",
    );
    return $response;
}
```

**Express / Node con Helmet** — Helmet activa `frameguard` por defecto. Apágalo y configura CSP:

```js
app.use(helmet({ frameguard: false }));
app.use(helmet.contentSecurityPolicy({
    directives: {
        frameAncestors: ["'self'", 'https://vout.app'],
    },
}));
```

**Next.js** — en `next.config.js`:

```js
async headers() {
    return [{
        source: '/:path*',
        headers: [{
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://vout.app",
        }],
    }];
}
```

**nginx** — en el bloque `server` del juego:

```
add_header Content-Security-Policy "frame-ancestors 'self' https://vout.app" always;
# Quita cualquier línea previa que ponga X-Frame-Options.
```

**Apache** — en `.htaccess` o vhost:

```
Header always unset X-Frame-Options
Header always set Content-Security-Policy "frame-ancestors 'self' https://vout.app"
```

### Verifica antes de publicar

```bash
curl -I https://tu-juego.com/ | grep -iE "x-frame|content-security"
```

- Si ves `X-Frame-Options: SAMEORIGIN` o `DENY` → tu juego no embebe en Vout.
- Si ves `Content-Security-Policy: frame-ancestors 'self' https://vout.app` → todo listo.

Sin esta cabecera correctamente configurada, el iframe del portal mostrará un cuadro en blanco, y tus jugadores no podrán abrir tu juego desde Vout. Comprueba ambas cosas (desarrollo y producción) antes de subir el juego.

---

## Preguntas Frecuentes

### ¿Necesito una librería específica de Vout?
**No.** Vout usa OAuth2 estándar. Cualquier librería OAuth2 compatible funciona.

### ¿Qué pasa si mi juego no tiene backend?
Si tu juego es solo frontend (HTML/JS sin servidor), usa un cliente PKCE (`--public`) que no requiere `client_secret`. El flujo funciona directamente desde el navegador.

### ¿Puedo registrar mi app pero no usar autenticación?
**Sí.** Registra tu app con `requires_auth = false`. Aparecerá en el catálogo de Vout sin necesidad de OAuth2.

### ¿Cómo se diferencia un proyecto propio de uno de terceros?
Las apps marcadas como `is_first_party = true` no muestran el prompt de autorización al usuario. El flujo OAuth2 es idéntico en ambos casos — la única diferencia es la experiencia de usuario.

---

## Soporte

Para registrar tu aplicación o resolver dudas técnicas, contacta al equipo de Vout.
