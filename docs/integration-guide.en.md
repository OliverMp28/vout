# Integration Guide: Vout User Ecosystem

> **Version:** 1.0  
> **Protocol:** OAuth 2.0 (Authorization Code + PKCE)  
> **Last updated:** March 2026

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

> **Note:** The protocol is **exactly the same** for first-party and third-party projects. The only difference is that Vout's own projects (`is_first_party = true`) don't show an authorization prompt — the session starts transparently.

---

## Protocol: OAuth2 Authorization Code + PKCE

Vout implements the **OAuth 2.0** standard with the **PKCE** extension (Proof Key for Code Exchange), the recommended flow for modern web applications.

### What does this mean for you?

You can use **any OAuth2 library** in your preferred language to integrate:

| Language / Framework | Suggested library |
| :--- | :--- |
| PHP (Laravel) | `laravel/socialite` with a [custom provider](https://socialiteproviders.com/) |
| PHP (generic) | `league/oauth2-client` |
| JavaScript / Node.js | `openid-client`, `next-auth`, or `passport` (npm) |
| Python | `authlib`, `requests-oauthlib` |
| Any other | Any compatible OAuth2/OIDC client |

You don't need a Vout-specific library. **If your tool speaks OAuth2, it works with Vout.**

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

Vout's Access Tokens are **JWTs signed with RS256**. This means your server can validate tokens **without querying Vout's database**, using the public key. Useful for microservices, high-QPS APIs, or backend-heavy games that don't want a round-trip to `/api/v1/user/me` on every request.

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

| Claim | Description |
| :--- | :--- |
| `iss` | Vout IdP URL (you must validate it matches your instance) |
| `sub` | Internal user ID in Vout (don't use to identify across apps — use `vout_id` from `/api/v1/user/me`) |
| `aud` | Your `client_id` (you must validate it matches yours) |
| `exp` | Expiration timestamp |
| `iat` | Issued-at timestamp |
| `nbf` | "Not before" — token isn't valid before this timestamp |
| `jti` | Unique token ID (useful for local revocation, blacklists, etc.) |
| `scopes` | Array of authorized scopes |

The JWT header includes `kid` pointing to the JWKS key:

```json
{ "typ": "JWT", "alg": "RS256", "kid": "Vw5D5w1BbAXKmaCCqc6m2MpffbXnTqaX7ye5BaNjB5U" }
```

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

Each Vout user has a **unique UUID** called `vout_id`. This is the **only identifier** you should store in your database to link the user.

**Never** use the auto-incremental ID — for security reasons, Vout does not expose it externally.

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

## Frequently Asked Questions

### Do I need a Vout-specific library?
**No.** Vout uses standard OAuth2. Any compatible OAuth2 library works.

### What if my game has no backend?
If your game is frontend-only (HTML/JS without a server), use a PKCE client (`--public`) that doesn't require a `client_secret`. The flow works directly from the browser.

### Can I register my app but not use authentication?
**Yes.** Register your app with `requires_auth = false`. It will appear in the Vout catalog without needing OAuth2.

### How are first-party projects different from third-party ones?
Apps marked as `is_first_party = true` don't show the authorization prompt to the user. The OAuth2 flow is identical in both cases — the only difference is the user experience.

---

## Support

To register your application or resolve technical questions, contact the Vout team.
