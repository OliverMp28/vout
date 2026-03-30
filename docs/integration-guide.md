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

## Validación Stateless del Token (Avanzado)

Los Access Tokens de Vout son **JWT firmados con RS256**. Esto significa que tu servidor puede validar los tokens **sin consultar la base de datos de Vout**, usando la clave pública.

### Endpoint de Claves Públicas (JWKS)
```
GET https://vout.example.com/oauth/token/keys
```

Devuelve las claves públicas en formato JWKS. Tu librería JWT puede usarlas para verificar las firmas.

### Datos dentro del Token (Claims)

| Claim | Descripción |
| :--- | :--- |
| `sub` | ID interno del usuario (no usar externamente) |
| `aud` | Tu `client_id` |
| `iss` | URL del IdP Vout |
| `exp` | Timestamp de expiración |
| `scopes` | Array de scopes autorizados |

### Ejemplo de validación con `lcobucci/jwt` (PHP)

```php
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;

$config = Configuration::forSymmetricSigner(
    new Sha256(),
    InMemory::file('/ruta/a/clave-publica-vout.pem')
);

$token = $config->parser()->parse($accessToken);

// Validar firma, emisor, audiencia y expiración
$constraints = [
    new \Lcobucci\JWT\Validation\Constraint\SignedWith($config->signer(), $config->signingKey()),
    new \Lcobucci\JWT\Validation\Constraint\IssuedBy('https://vout.example.com'),
    new \Lcobucci\JWT\Validation\Constraint\PermittedFor('TU_CLIENT_ID'),
    new \Lcobucci\JWT\Validation\Constraint\StrictValidAt(new \DateTimeImmutable()),
];
```

> **Recomendación:** Si tu app tiene backend, es más sencillo usar el endpoint `/api/v1/user/me` que validar el JWT directamente. La validación stateless es útil para optimizar rendimiento cuando tienes muchas peticiones.

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
