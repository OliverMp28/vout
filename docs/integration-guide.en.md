# Integration Guide: Vout User Ecosystem

> **Version:** 1.1  
> **Protocol:** OAuth 2.0 (Authorization Code + PKCE)  
> **Last updated:** October 2026

---

## What is Vout?

Vout is an **Identity Provider (IdP)** that centralizes user accounts for an ecosystem of web-based minigames. Instead of each game managing its own user database, Vout provides a "universal passport": users register once and can play any integrated project.

**Benefits for your project:**
- No need to manage registration, passwords, or account recovery.
- Your users sign in with one click using their Vout (or Google) account.
- You receive a unique identifier (`vout_id`) to link progress and data.

---

## Integration Types

Your project can integrate with Vout in two ways:

### 1. Catalog Only (no authentication)
Your game appears in the Vout portal but **doesn't need to identify users**. Ideal for simple games with no backend or database.

- Your app is registered in Vout with `requires_auth = false`.
- No OAuth2 or token configuration needed.
- The game simply loads in the portal.

### 2. With User Ecosystem (OAuth2)
Your game needs to know **who the user is** (to save scores, display their name, etc.).

- Your app is registered in Vout with `requires_auth = true`.
- You receive a `client_id` (and optionally a `client_secret`).
- You implement the standard OAuth2 flow described below.
- If you also publish the game in the portal, there is no redirect inside the iframe: the portal passes you the token over `postMessage` (see "Identity Inside the iFrame").

> **Note:** The protocol is **exactly the same** for first-party and third-party projects. The only difference is that Vout's own projects (`is_first_party = true`) don't show an authorization prompt — the session starts transparently.

---

## Protocol: OAuth2 Authorization Code + PKCE

Vout implements the **OAuth 2.0** standard with the **PKCE** extension (Proof Key for Code Exchange), the recommended flow for modern web applications.

### What does this mean for you?

You don't need a Vout-specific library. If your stack speaks OAuth2 and standard JWT, it works with Vout, whether you use PHP, Node.js, Python, Go, or any other language.

A Vout integration has two phases, and each one uses a different type of library:

| Phase | What it does | When it happens | Which library to use |
| :--- | :--- | :--- | :--- |
| 1. Login | Redirects the user to Vout, receives the `code` on the callback, and exchanges it for an Access Token. | Once per user session. | An OAuth2 client: `laravel/socialite` or `league/oauth2-client` (PHP), `openid-client` (Node.js), `authlib` (Python), `golang.org/x/oauth2` (Go)... |
| 2. Each API request | Verifies the Access Token is still valid before serving the response. | On every authenticated call. | Two options, described below. |

For Phase 2 you have two ways to verify the token:

- Option A, local validation (fast). You verify the JWT's RS256 signature on your server with Vout's public key (published at `/oauth/jwks`). Since there's no network call, the check takes microseconds. You need a JWT validator: `lcobucci/jwt` (PHP), `jose` (Node.js), `PyJWT` (Python), `jwx` (Go). The "Stateless Token Validation" section below covers it in detail.
- Option B, forward the token to Vout (simple). You call `GET /api/v1/user/me` passing the token. If Vout responds 200, the token is valid and you also receive the user's data; a 401 means it's invalid. You don't need any JWT library, just an HTTP client (curl, Guzzle, axios, requests).

> Which one to pick? If your app is simple, start with Option B: less code, and revocations are detected instantly. When the per-request round-trip starts to hurt under load, move to Option A. There's a comparison table further down with all the details.

---

## Step-by-Step Flow

### Step 1: Register your application

Contact the Vout administrator to register your app. You'll receive:
- **`client_id`**: Your application's public identifier (UUID).
- **`client_secret`** (optional): Only for applications with a secure backend. SPAs use PKCE without a secret.
- **`redirect_uri`**: The URL in your app where Vout will redirect the user after authentication.

### Step 2: Redirect the user to Vout

Your application redirects the user to Vout's authorization URL:

```
GET https://vout.example.com/oauth/authorize?
    client_id=YOUR_CLIENT_ID
    &redirect_uri=https://your-app.com/callback
    &response_type=code
    &scope=user:read user:email
    &state=RANDOM_CSRF_STRING
    &code_challenge=SHA256_HASH_OF_CODE_VERIFIER
    &code_challenge_method=S256
```

**Parameters:**
| Parameter | Required | Description |
| :--- | :---: | :--- |
| `client_id` | ✅ | Your client UUID |
| `redirect_uri` | ✅ | Must match the registered one |
| `response_type` | ✅ | Always `code` |
| `scope` | ✅ | Requested permissions (see Scopes section) |
| `state` | ✅ | Random string for CSRF protection |
| `code_challenge` | ✅* | SHA-256 hash of the code verifier (PKCE) |
| `code_challenge_method` | ✅* | Always `S256` |

*\*Required for public clients (SPAs). Recommended for all.*

### Step 3: The user authorizes (or doesn't)

- For **first-party** apps, the user is redirected automatically without seeing any prompt.
- For **third-party** apps, the user will see: *"App X requests access to your profile"*, with the scopes listed.

> **Vout remembers consent.** After a successful first authorization, subsequent `/oauth/authorize` calls from the same user for your app skip the screen and emit the `code` directly (UX parity with Google/GitHub). The user can revoke access from `/settings/connected-apps` at any time; that invalidates the active tokens and the next authorization will display the screen again. If your app requests a **new scope** that the existing grant doesn't cover, Vout prompts again (incremental consent).

### Step 4: Exchange the code for a token

Vout redirects the user back to your `redirect_uri` with a temporary `code`:

```
GET https://your-app.com/callback?code=TEMPORARY_CODE&state=YOUR_STATE
```

Your backend exchanges that code for an Access Token:

```
POST https://vout.example.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET    (only if your client has a secret)
&redirect_uri=https://your-app.com/callback
&code=TEMPORARY_CODE
&code_verifier=THE_ORIGINAL_CODE_VERIFIER    (PKCE)
```

**Successful response:**
```json
{
    "token_type": "Bearer",
    "expires_in": 3600,
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOi...",
    "refresh_token": "def50200c..."
}
```

### Step 5: Query the Vout API

With the Access Token, you can retrieve the user's data:

```
GET https://vout.example.com/api/v1/user/me
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOi...
```

**Response:**
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

> **Note:** The `email` field only appears if you requested the `user:email` scope.

---

## Available Scopes

Scopes control what user data Vout shares with your app. **Important:** Vout does not store your game's internal progress (levels, inventory, etc.). You manage that data in your own database using the `vout_id` as the key.

Game-related scopes are exclusively used to sync **global metadata** with the public Vout portal (e.g., displaying high scores or favorites on the player's public profile).

| Scope | Included data | Use case |
| :--- | :--- | :--- |
| `user:read` | `vout_id`, `name`, `username`, `avatar` | Display name and photo in your game |
| `user:email` | `email` | Send notifications, direct communication |
| `games:read` | Global history and statistics in Vout | Know what other games the user prefers in the portal |
| `games:write` | Public metadata directed to Vout | Update the Vout portal when a user breaks a record in your game, or mark your game as their favorite |

**Default scope:** If you don't specify any scope, `user:read` is assigned.

**Best practice:** Only request the scopes you need. Users trust apps that ask for fewer permissions.

---

## Consent persistence and the `prompt` parameter

Vout follows OIDC Core §3.1.2.1 semantics for the `prompt` parameter on `/oauth/authorize`. By default, **once a user authorizes your app, Vout remembers that decision** and future requests skip the screen — even if the user's web session in Vout has expired. Consent outlives the access token (60 min) and is only cleared if the user revokes access from `/settings/connected-apps`.

### Default behavior (no `prompt`)

| User state | Result |
|---|---|
| Not signed in to Vout | Vout shows `/login`. After authentication, the rule below applies. |
| Signed in + active grant covering requested scopes | Direct skip: 302 to `redirect_uri` with `?code=...&state=...`. |
| Signed in + grant exists but a new scope is requested | Consent screen (incremental consent). On approval, the grant is updated with the union of scopes. |
| Signed in without grant | Normal consent screen. |

### Forcing specific behaviors

```
GET /oauth/authorize?...&prompt=consent
```

| Value | When to use | Behavior |
|---|---|---|
| `prompt=consent` | Sensitive operations, "run as another user", account switching. | Vout **always** displays the screen even if an active grant exists. |
| `prompt=login` | After identity changes or when you want to force credential re-verification. | Vout signs the current session out and forces a fresh login before continuing the flow. |
| `prompt=none` | Silent SSO (typical of embedded iframes or background re-auth). | If session + grant exist: 302 with code. If either is missing: redirect to `redirect_uri` with `?error=login_required` or `?error=consent_required` — **never shows UI**. |

### User-side revocation

Any user can go to `/settings/connected-apps` (in their Vout account) and revoke your app's access. That:

- Marks the grant as revoked (it doesn't disappear from history; it stays with `revoked_at` populated).
- Marks all `oauth_access_tokens` and `oauth_refresh_tokens` for that (user, client) pair as `revoked=1`. Your next refresh will fail with `invalid_grant`.
- Already-issued JWTs remain cryptographically valid until their natural `exp` (≤ 60 min), because stateless validation does not query the DB. If you need instant revocation, call `/api/v1/user/me` periodically or shorten your TTL.

When the user revokes and signs in to your app again, Vout will display the consent screen again as if it were the first time.

---

## Stateless Token Validation (Advanced)

This section expands Option A of Phase 2: verifying the JWT locally with Vout's public key. It's optional. If your app is simple, Option B (forwarding the token to `/api/v1/user/me`) does the job just as well and is easier to implement.

Vout's Access Tokens are JWTs signed with RS256, so any standard JWT library can verify the signature with the public key published at `/oauth/jwks`. It's a good fit for microservices, high-traffic APIs, or backend-heavy games whose backend doesn't want a round-trip to `/me` on every request.

### Automatic discovery

Vout publishes an OIDC Discovery document — most modern JWT libraries auto-configure when pointed at the issuer:

```
GET https://vout.example.com/.well-known/openid-configuration
```

Response (abridged):

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

> **Honest disclosure:** Vout is **OAuth 2.0 with signed JWT Access Tokens (RS256)**, not a full OIDC IdP. It does not issue ID Tokens or implement OIDC's `nonce` flow. We expose this URL because client libraries use it to discover endpoints — everything we return (jwks, scopes, endpoints) is real and honored.

### JWKS Endpoint

```
GET https://vout.example.com/oauth/jwks
```

Response (RFC 7517):

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

The `kid` is the JWK Thumbprint (RFC 7638), derived mathematically from the JWK itself — any validator can recompute and verify it. When Vout rotates keys, the JWKS will expose both the old and the new during the transition; your library will pick the right one using the `kid` from the JWT header.

**Cache headers:** `Cache-Control: public, max-age=3600`. Your library typically caches JWKS automatically — you don't need to re-download it on every request.

### Data Inside the Token (Claims)

If you decode the JWT without verifying the signature yet, the payload looks like this:

```json
{
  "iss": "https://vout.example.com",
  "aud": "9d0e4f3a-1234-5678-90ab-cdef12345678",
  "jti": "a1b2c3d4e5f6...",
  "iat": 1778151275,
  "nbf": 1778151275,
  "exp": 1778154875,
  "sub": "2",
  "vout_id": "4f1ade51-449a-4871-8e62-d908ad737c24",
  "scopes": ["user:read"]
}
```

| Claim | Description |
| :--- | :--- |
| `iss` | Vout IdP URL. You must validate it matches your instance. |
| `aud` | Your `client_id`. You must validate it matches yours. |
| `sub` | Internal user ID in Vout (integer, opaque). RFC 7519 allows it, but **to link the user in your DB use `vout_id`**: the format of `sub` may change in future versions. |
| `vout_id` | **User's canonical UUID.** Same value returned by `/api/v1/user/me`. Use it as the key to map the token to your local `users` table and you save a round-trip. Not present in `client_credentials` tokens (no associated user). |
| `scopes` | Array of authorized scopes. |
| `exp` | Expiration timestamp. |
| `iat` | Issued-at timestamp. |
| `nbf` | "Not before". The token isn't valid before this timestamp. |
| `jti` | Unique token ID. Useful for local revocation, blacklists, etc. |

The JWT header includes `kid` pointing to the JWKS key:

```json
{ "typ": "JWT", "alg": "RS256", "kid": "Vw5D5w1BbAXKmaCCqc6m2MpffbXnTqaX7ye5BaNjB5U" }
```

> Why two identifiers. `sub` complies with RFC 7519: any standard JWT library reads it without knowing anything about Vout. `vout_id` is the external identifier this guide documents and that `/api/v1/user/me` returns. Having both in the same token means that to map `JWT → local user` you don't need to touch `/me`; decoding the JWT is enough.

### Validation example with `lcobucci/jwt` (PHP)

```php
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Lcobucci\JWT\Validation\Constraint;

// Get the public key PEM from the JWKS (cached by your app).
// Any JWK→PEM library will do: web-token/jwt-library, paragonie/jwt, etc.
$pem = jwksToPem(httpGet('https://vout.example.com/oauth/jwks'));

$config = Configuration::forAsymmetricSigner(
    new Sha256(),
    InMemory::plainText(''),                  // empty privateKey: validation only
    InMemory::plainText($pem),                // publicKey from JWKS
);

$token = $config->parser()->parse($accessToken);

$constraints = [
    new Constraint\SignedWith($config->signer(), $config->verificationKey()),
    new Constraint\IssuedBy('https://vout.example.com'),
    new Constraint\PermittedFor('YOUR_CLIENT_ID'),
    new Constraint\StrictValidAt(new \Lcobucci\Clock\SystemClock(new \DateTimeZone('UTC'))),
];

$config->validator()->assert($token, ...$constraints);
```

### Node.js example (`jose` / `node-openid-client`)

```js
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('https://vout.example.com/oauth/jwks'));

const { payload } = await jwtVerify(accessToken, JWKS, {
    issuer: 'https://vout.example.com',
    audience: process.env.VOUT_CLIENT_ID,
});
```

`jose` caches the JWKS automatically and refreshes when an unknown `kid` appears — supports key rotation transparently.

### Mapping the JWT to your database

Once the token is validated, read `vout_id` from the payload and use it as the FK against your local `users` table. The pattern is the same in any stack:

> Store `vout_id` (UUID) in your table, not `sub`. `sub` is an internal Vout detail; `vout_id` is the stable public contract this guide documents.

PHP (`lcobucci/jwt`):

```php
$voutId = $token->claims()->get('vout_id');
$user = $db->query('SELECT * FROM users WHERE vout_id = ?', [$voutId])->fetch();
```

Node.js (`jose`):

```js
const { payload } = await jwtVerify(accessToken, JWKS, { issuer, audience });
const user = await db.users.findUnique({ where: { vout_id: payload.vout_id } });
```

Python (`PyJWT` + `cryptography`):

```python
import jwt, requests
jwks_client = jwt.PyJWKClient('https://vout.example.com/oauth/jwks')
signing_key = jwks_client.get_signing_key_from_jwt(access_token)
payload = jwt.decode(
    access_token,
    signing_key.key,
    algorithms=['RS256'],
    audience=client_id,
    issuer='https://vout.example.com',
)
user = User.query.filter_by(vout_id=payload['vout_id']).first()
```

Go (`github.com/lestrrat-go/jwx/v2`):

```go
keySet, _ := jwk.Fetch(ctx, "https://vout.example.com/oauth/jwks")
token, _ := jwt.Parse(
    []byte(accessToken),
    jwt.WithKeySet(keySet),
    jwt.WithIssuer("https://vout.example.com"),
    jwt.WithAudience(clientID),
)
voutID, _ := token.Get("vout_id")
// SELECT * FROM users WHERE vout_id = $1 ...
```

> Note for Laravel: the PHP snippets above apply equally in Laravel. The Phase 1 OAuth library (`laravel/socialite`) and the Phase 2 JWT library (`lcobucci/jwt`) are different and complementary. Socialite doesn't validate JWTs, and lcobucci doesn't run the OAuth flow.

### Stateless validation vs. calling `/api/v1/user/me`?

Both are valid, they cover different scenarios:

| | Local validation (JWKS) | Call to `/api/v1/user/me` |
| :--- | :--- | :--- |
| **Latency** | Microseconds (no network) | HTTP round-trip |
| **Detects revocation** | No (until token expires, max 60 min) | **Yes, instantly** |
| **Detects profile changes** | No | Yes, on every call |
| **Available data** | Only JWT claims | Full profile + `vout_id` |
| **Scalability** | Excellent (no Vout coupling) | Limited by Vout |
| **Recommended for** | High-QPS APIs, microservices | Backend-light apps, dashboards |

**Recommended pattern:** validate the signature locally (fast) and call `/api/v1/user/me` only on critical operations that need fresh data or instant revocation detection.

---

## Refresh Tokens

Access Tokens expire after **60 minutes** (configurable). To get a new one without asking the user to re-authorize:

```
POST https://vout.example.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=def50200c...
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&scope=user:read
```

Refresh Tokens are valid for **30 days** (configurable).

---

## External Identifier: `vout_id`

Each Vout user has a **unique UUID** called `vout_id`. It's the identifier you should store in your database to link the user.

You can obtain it from two places, and both return exactly the same value:

1. Inside the JWT, as the `vout_id` claim. No network in the middle, so it's instant. Available since the current version of Vout.
2. From `GET /api/v1/user/me`, in the `vout_id` field. It also includes name, avatar, and email.

For the `JWT → local user` lookup, read the claim from the JWT and you save the call. Reserve `/me` for when you need fresh profile data (updated avatar, email, etc.).

Don't use the auto-incremental ID: for security reasons, Vout does not expose it externally.

```sql
-- In your database (example for your players table):
CREATE TABLE players (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    vout_id CHAR(36) UNIQUE NOT NULL,  -- The Vout UUID
    best_score INT DEFAULT 0,
    created_at TIMESTAMP
);
```

---

## Embedding Your Game in Vout (X-Frame-Options / CSP)

Your game is loaded inside an `<iframe>` of the Vout portal. By default, **many servers and frameworks block iframes** through security headers — and that block is enforced by the browser, not Vout. If this happens to you, the browser console will show something like:

```
Refused to display 'https://your-game.com/' in a frame because it set
'X-Frame-Options' to 'sameorigin'.
```

Or:

```
Refused to frame 'https://your-game.com/' because an ancestor violates
the following Content Security Policy directive: "frame-ancestors 'self'".
```

**This happens in production and in development alike.** It is not a Vout bug: your server is telling the browser it does not allow being framed.

### How to fix it

The modern and recommended standard is `Content-Security-Policy: frame-ancestors`, which lets you whitelist specific origins (`X-Frame-Options` only supports SAMEORIGIN or DENY — no granularity — and is overridden when both headers are present).

On your game's server, **remove** `X-Frame-Options` and **add**:

```
Content-Security-Policy: frame-ancestors 'self' https://vout.app https://www.vout.app
```

`frame-ancestors` lists the **origins of the portal that will embed your game**, not your own. Replace `https://vout.app` with the actual domain of the Vout instance where you registered your app (we confirm it when you onboard). Your game can run on `localhost`, staging, or production — that does not affect this header. What matters is **where** the embedding iframe is loaded from: that's the origin you must authorize.

### Recipes by stack

**Laravel** — add a middleware or use `spatie/laravel-csp`. Quickest approach:

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

**Express / Node with Helmet** — Helmet enables `frameguard` by default. Disable it and configure CSP:

```js
app.use(helmet({ frameguard: false }));
app.use(helmet.contentSecurityPolicy({
    directives: {
        frameAncestors: ["'self'", 'https://vout.app'],
    },
}));
```

**Next.js** — in `next.config.js`:

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

**nginx** — in the game's `server` block:

```
add_header Content-Security-Policy "frame-ancestors 'self' https://vout.app" always;
# Remove any previous line setting X-Frame-Options.
```

**Apache** — in `.htaccess` or vhost:

```
Header always unset X-Frame-Options
Header always set Content-Security-Policy "frame-ancestors 'self' https://vout.app"
```

### Verify before publishing

```bash
curl -I https://your-game.com/ | grep -iE "x-frame|content-security"
```

- If you see `X-Frame-Options: SAMEORIGIN` or `DENY` → your game won't embed in Vout.
- If you see `Content-Security-Policy: frame-ancestors 'self' https://vout.app` → you're all set.

Without this header configured correctly, the portal's iframe will show a blank box, and your players won't be able to open your game from Vout. Check both environments (development and production) before submitting the game.

---

## Identity Inside the iFrame (`postMessage` handshake)

When a user opens your game from the portal, they are already signed in to Vout. Sending them to `/oauth/authorize` would make them repeat something they already did, so the portal hands your game an access token directly, over `postMessage`. Never in the URL.

That token is a regular Vout access token: same format, same signature and same claims as the ones from `/oauth/token`. You validate it with the code you already have (see "Stateless Token Validation").

### The messages

| Direction | Message | When |
| :--- | :--- | :--- |
| game → portal | `{ type: 'READY', suggestedPreset?: string }` | Your game can receive the identity. Repeat it until `VOUT_AUTH` arrives. |
| portal → game | `{ type: 'VOUT_AUTH', token, expiresAt, voutId, username }` | In response to every valid `READY`, and again each time the portal renews the token. |
| portal → game | `{ type: 'VOUT_SESSION_END', reason }` | No more renewals are coming. `reason` is `'signed_out'`, `'revoked'` or `'unavailable'`. |
| portal → game | `{ type: 'VOUT_ACTION', event: string, at: number }` | An action starts: a user gesture mapped to a game event (face control). |
| portal → game | `{ type: 'VOUT_ACTION_END', event: string, at: number }` | That action ends: the user stopped making the gesture. |
| portal → game | `{ type: 'VOUT_CURSOR', x: number, y: number }` | Head-movement cursor. Coordinates from 0 to 1, relative to your iframe. |
| game → portal | `{ type: 'EXIT' }` | The user wants to leave. The portal takes them to the catalog. |
| game → portal | `{ type: 'GAME_STATE', state: 'playing' \| 'paused' \| 'ended', score?: number }` | Reserved. The portal accepts it but does nothing with it yet. |

`expiresAt` is the token expiry in Unix seconds (the same value as its `exp` claim). `at` is in Unix milliseconds.

Ignore any `type` you don't know. The protocol may grow and your game shouldn't break because of it.

### How it happens

1. The portal loads your `embed_url` as is, with no parameters.
2. Your game sends `READY` to `window.parent`.
3. The portal checks two things: that `event.origin` is one of your app's `allowed_origins` (exact match on scheme, host and port) and that the message comes from the iframe it created. If anything is off, it drops the message without replying.
4. The portal replies with `VOUT_AUTH`, addressed to that origin only.
5. About 5 minutes before the token expires, the portal requests a new one and sends you another `VOUT_AUTH`. Always keep the latest.

Your iframe stays hidden until the handshake completes. It is hidden through opacity, not `display: none`: it has its real size from the very start, so you can measure the window and start your game loop as usual.

If you don't send `READY` within 8 seconds of your page loading, the user sees a "The game is not responding" notice with a retry button. A late `READY` still works and clears the notice by itself. Even so, send it as soon as your script starts: `READY` means "I can receive the identity", not "I finished loading all my assets".

### Which token you get

| | App with OAuth (`requires_auth = true`) | Catalog-only game |
| :--- | :--- | :--- |
| `aud` | Your `client_id` | An internal portal client |
| `scopes` | `["user:read"]` | `["game:play"]` |
| Lifetime | 60 minutes | 60 minutes |
| Asks for consent | Only if your app is third-party and the user hasn't authorized it yet | No |

If your app has an OAuth client, the token is issued for you: validate `aud` against your `client_id` just like in the direct flow, and you can use it as a Bearer token against `/api/v1/user/me`.

If your game is catalog-only, the token is not issued for you. At most, use it to greet the player by name. If you need an identity you can rely on (saving progress, leaderboards), register your app with `requires_auth = true`.

### Consent

A third-party app only receives the identity of a user who has authorized it. The first time they open your game from the portal, before your iframe loads, they see a permissions screen with the `user:read` scope. Once they accept, the game opens.

It is the same consent as in the direct flow, not a separate one:

- If the user already signed in to your site with "Sign in with Vout", the portal doesn't ask again.
- If they authorize from the portal, they won't see the screen either when they visit your site requesting only `user:read`.
- If they revoke it at `/settings/connected-apps`, the portal stops renewing your token and will ask again next time.

Vout's own apps (`is_first_party = true`) skip this screen.

### Renewal: the portal does it, not you

Inside an iframe your cookies are third-party cookies, and browsers block them more and more. Don't count on being able to use your refresh token or your own session while embedded.

That is why the portal renews. As long as the user keeps the tab open and stays signed in to Vout, you will get a new `VOUT_AUTH` before the previous token expires.

When the portal tries to renew and no longer can, it tells you with `VOUT_SESSION_END`:

| `reason` | What happened |
| :--- | :--- |
| `signed_out` | The user signed out of Vout or their session expired. |
| `revoked` | The user revoked your app's access. |
| `unavailable` | Your game is no longer available in the portal. |

When you receive it, drop the identity. Keep in mind that the portal finds out at renewal time, not the instant it happens: the notice can arrive up to 55 minutes later. If you need to learn about a revocation sooner, ask `/api/v1/user/me` from your backend before a sensitive operation: a revoked token gets a 401 right away.

As a safety net, if `expiresAt` comes with neither a new `VOUT_AUTH` nor a `VOUT_SESSION_END` (for example, the user went offline), treat the session as over anyway.

If the user switches Vout accounts in another tab, the portal reloads the whole game page. Your iframe starts from scratch and receives the new identity the usual way.

> **Watch out locally.** To the browser, `http://localhost` and `http://localhost:8090` are the same site (the port doesn't count), so on your machine your cookies do travel inside the iframe. The blocking only shows up in production, with different domains. Working locally doesn't prove your refresh works while embedded.

### Face control: what reaches your game

Vout lets users play with facial gestures and head movements. The user chooses what each gesture does: press a key, click, or emit a game event.

There is one limitation you need to know about. If your game lives on a different origin than the portal (the usual case for an external app), the browser doesn't let the portal simulate keys or clicks inside your iframe. Only messages reach your game: `VOUT_ACTION` and `VOUT_CURSOR`.

| User preset | What it emits | Does it reach a cross-origin game? |
| :--- | :--- | :--- |
| `platformer` | Keys (Space, arrows, Z, X, C) | No |
| `shooter` | Keys, click and `VOUT_CURSOR` | Cursor only |
| `accessible` | Keys (Space, Enter, arrows, Escape) | No |
| `runner` | `VOUT_ACTION` with `JUMP` and `DUCK` | Yes |

For face control to work in your game, send `suggestedPreset: 'runner'` in your `READY`. The portal will offer the user to switch to that preset for the current session, without touching their saved configuration.

#### Taps and held actions

Every action has a start and an end. `VOUT_ACTION` arrives when the user starts the gesture and `VOUT_ACTION_END`, with the same `event`, when they stop.

- If your game works with taps (jumping), keep `VOUT_ACTION` and ignore the end.
- If it has hold mechanics (gliding, a thruster), start on `VOUT_ACTION` and stop on `VOUT_ACTION_END`.

Two details worth knowing:

- **The end doesn't arrive equally fast for every gesture.** With the head (up, down, sideways) it is immediate. With a facial gesture (eyebrows, mouth) it arrives between 0.6 and 0.75 seconds after the user relaxes the gesture, because the portal infers it once it stops seeing it. For an action that must be released precisely, the head works better.
- **Two gestures can hold the same action.** In the `runner` preset, both raising the eyebrows and tilting the head up emit `JUMP`. You may receive two `VOUT_ACTION` in a row for the same event; `VOUT_ACTION_END` arrives only once, when the user releases the last one.

The portal always closes what it opens: if the user turns the camera off, switches tabs or changes preset with an action in progress, you receive its `VOUT_ACTION_END`.

#### When the gesture happened

`at` tells you when it really happened, in Unix milliseconds of the browser clock (the same as your `Date.now()`, because the portal and your game run on the same machine). Between the gesture and the message there is the time it takes to analyze the image; with `at` you can subtract it, which is useful in a rhythm game.

- In `VOUT_ACTION`, `at` is the instant of the camera image in which the portal saw the gesture start.
- In `VOUT_ACTION_END`, it is the best estimate of when it ended: the image in which the head left the zone, or the last one in which the facial gesture was seen.

Treat it as a hint and bound it: if `at` is in the future or more than a couple of seconds in the past, use the moment the message reached you.

The user can also map a gesture to an event with any name they like, and it reaches you as is in `event`. Treat it as text you don't control: compare it against your list of actions and drop the rest.

### Minimal example

```js
// The portal origin, fixed in your configuration. Never derive it from the message.
const VOUT_ORIGIN = 'https://vout.app';

let session = null;

window.addEventListener('message', (event) => {
    if (event.origin !== VOUT_ORIGIN || event.source !== window.parent) return;

    const message = event.data;
    if (!message || typeof message.type !== 'string') return;

    switch (message.type) {
        case 'VOUT_AUTH':
            // Arrives after READY and on every renewal: keep the latest.
            session = { token: message.token, expiresAt: message.expiresAt };
            // Send it to your backend and validate it there (signature, iss, aud, exp).
            break;
        case 'VOUT_SESSION_END':
            // No more renewals are coming: drop the identity.
            session = null;
            break;
        case 'VOUT_ACTION':
            // message.at: when the gesture started (Unix ms).
            if (message.event === 'JUMP') startJump(message.at);
            if (message.event === 'DUCK') startDuck(message.at);
            break;
        case 'VOUT_ACTION_END':
            // You only need it if you have actions that are held.
            if (message.event === 'JUMP') endJump(message.at);
            if (message.event === 'DUCK') endDuck(message.at);
            break;
        // VOUT_CURSOR and any unknown type: ignore them if you don't use them.
    }
});

// Repeat READY until VOUT_AUTH arrives, in case the portal wasn't listening yet.
(function announce() {
    if (session) return;
    window.parent.postMessage({ type: 'READY', suggestedPreset: 'runner' }, VOUT_ORIGIN);
    setTimeout(announce, 500);
})();

function exitToPortal() {
    window.parent.postMessage({ type: 'EXIT' }, VOUT_ORIGIN);
}
```

To know whether you are embedded, check `window.parent !== window`. Outside the portal, use the regular OAuth flow.

### Security rules

- **Exact origin in both directions.** When sending, pass the portal origin as `targetOrigin`, never `'*'`. When receiving, drop any message whose `event.origin` is not exactly the portal's.
- **`voutId` and `username` are for painting the UI, not for deciding anything.** They let you show the name right away. The verifiable identity is the token's `vout_id` claim, once validated.
- **Validate the token like any other:** signature against the JWKS, `iss`, `aud` equal to your `client_id`, and `exp`. Do it on your backend.
- **Keep the token in memory.** Don't write it to `localStorage` or put it in a URL.

### What the iframe won't let you do

The portal loads your game with `sandbox="allow-scripts allow-same-origin allow-orientation-lock"` and `allow="autoplay; fullscreen; clipboard-write; web-share"`. In practice:

- **You can:** run scripts, use `fetch`, play audio, go fullscreen, lock the screen orientation (while in fullscreen), copy to the clipboard and open the system share dialog. The last two only in response to a user action, such as a click.
- **You can't:** open popups, use `alert()` or `confirm()`, submit classic HTML forms, read the clipboard, or navigate the portal window. To leave, send `EXIT`.

---

## Frequently Asked Questions

### Do I need a Vout-specific library?
**No.** Vout uses standard OAuth2. Any compatible OAuth2 library works.

### What if my game has no backend?
If your game is frontend-only (HTML/JS without a server), use a PKCE client (`--public`) that doesn't require a `client_secret`. The flow works directly from the browser.

### Can I register my app but not use authentication?
**Yes.** Register your app with `requires_auth = false`. It will appear in the Vout catalog without needing OAuth2.

### Can I refresh the token from inside the portal's iframe?
**Don't count on it.** While embedded, your cookies are third-party and the browser may block them. The portal renews the token for you and resends it with another `VOUT_AUTH` before the previous one expires (see "Identity Inside the iFrame").

### How are first-party projects different from third-party ones?
Apps marked as `is_first_party = true` don't show the authorization prompt to the user. The OAuth2 flow is identical in both cases — the only difference is the user experience.

---

## Support

To register your application or resolve technical questions, contact the Vout team.
