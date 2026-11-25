# Vout Integration Guide

> **Version:** 1.2 · **Last updated:** November 2026
> **Protocols:** OAuth 2.0 (Authorization Code + PKCE), RS256 JWTs and the portal's `postMessage` protocol

This guide is the complete reference for connecting a game or a website to Vout. It is written so that a person, or an AI agent, can follow it without having to ask anyone: everything Vout offers today is here, and anything that doesn't exist yet is said so.

---

## What Vout gives you

1. **Accounts you don't have to build.** Your players sign in with their Vout account (or with Google through Vout). You don't handle passwords, account recovery or email verification. You get a stable identifier, `vout_id`, to store their progress in your database.
2. **A spot in the portal's catalog.** Your game loads inside the portal in an iframe, stays on your server and anyone visiting Vout can play it.
3. **No double sign-in.** If the player is already signed in to Vout, your game recognizes them as soon as it loads inside the portal: Vout hands the identity to the iframe. It's the same account they use on your site with "Sign in with Vout", so their progress is the same in both places.
4. **Gesture control.** The portal analyzes the camera in the player's browser and sends your game keys, clicks or events. You don't touch the camera and you don't need any computer vision.

You can use just one part. A game without accounts can be in the catalog and receive gestures without implementing OAuth.

---

## Before you start

- **The domain in the examples.** `https://vout.example.com` stands for the address of the Vout instance you integrate with. Replace it with the real one: the one you see in the portal's address bar. Always use it with the same scheme and no trailing slash, because it is the tokens' `iss` and the exact origin of the iframe messages.
- **Everything happens in your dashboard.** Creating apps, seeing credentials, regenerating the secret and submitting games are things you do yourself at `/developers/dashboard`, with a Vout account whose email is confirmed. The only thing that goes through the Vout team is reviewing each game before it appears in the catalog.
- **Vocabulary.**
  - **App:** your project registered in Vout (name, URL, allowed origins and, if it uses accounts, an OAuth client).
  - **Allowed origin:** scheme + host + port your app runs on, for example `https://mygame.com` or `http://localhost:8090`. The portal only accepts messages from your iframe if they come from one of them, and your redirect URLs and your game's URL must be inside them.
  - **Game:** a catalog entry pointing to a URL of your app (`embed_url`).

---

## Quick reference

**Endpoints**

| Method and path | Purpose |
| :--- | :--- |
| `GET /oauth/authorize` | Start of the OAuth sign-in (Authorization Code + PKCE). |
| `POST /oauth/token` | Exchange the `code` for tokens, or renew with `refresh_token`. |
| `GET /api/v1/user/me` | Profile of the token's player (`Authorization: Bearer …`). |
| `GET /oauth/jwks` | Public keys to verify the JWTs (RS256, with `kid`). |
| `GET /.well-known/openid-configuration` | Discovery: endpoints, scopes and algorithms. |
| `GET /sdk/vout-game.js` | Optional SDK for games inside the portal. |

**Fixed values**

| What | Value |
| :--- | :--- |
| Access token lifetime | 60 minutes (`expires_in: 3600`) |
| Refresh token lifetime | 30 days |
| Signing algorithm | RS256, with `kid` in the header |
| `iss` | The instance URL, no trailing slash |
| `aud` | Your `client_id` |
| Player identifier | The `vout_id` claim (UUID). Don't use `sub`. |
| Scopes you can request | `user:read` (default) and `user:email` |
| PKCE method | `S256` |

**Iframe messages** (details in "Identity Inside the iFrame")

| Direction | Type |
| :--- | :--- |
| game → portal | `READY`, `EXIT`, `GAME_STATE` (reserved) |
| portal → game | `VOUT_AUTH`, `VOUT_GUEST`, `VOUT_SESSION_END`, `VOUT_KEY`, `VOUT_POINTER`, `VOUT_CURSOR`, `VOUT_ACTION`, `VOUT_ACTION_END` |

---

## Choose your integration

| What you want | Register | Implement |
| :--- | :--- | :--- |
| **A. Your game in the catalog, no accounts** | An app **without** Vout accounts and a game in "No account" mode. | The headers that let the portal embed you (see "Embedding Your Game"). For gestures, the SDK. |
| **B. Your game in the catalog, recognizing the player** | An app **with** Vout accounts and a game in "Optional account" or "Account required" mode. | Receive `VOUT_AUTH` / `VOUT_GUEST` in the iframe and verify the token on your backend. |
| **C. "Sign in with Vout" on your own site** | An app **with** Vout accounts. | The OAuth 2.0 + PKCE flow on your backend. |
| **B + C together** | The same app. | Both. The player has the same `vout_id` on your site and inside the portal, so their progress is one. |

> The protocol is the same for Vout's own projects and for third parties. The only difference is that a Vout app (`is_first_party`, only the Vout team can set it) doesn't show the permissions screen.

---

## Step by step in your dashboard

### 1. Create your account

Sign up to Vout and confirm your email. The developer dashboard is at `/developers/dashboard`.

### 2. Register your app

Under "New app" you fill in:

| Field | Notes |
| :--- | :--- |
| Name | Players see it on the permissions screen. Unique among your apps. |
| App URL | Your project's home page. |
| Allowed origins | 1 to 10, scheme + host + port only (no path). Include your development one if you'll test locally. |
| Uses Vout accounts? | If not, no OAuth client is created (case A). You can turn it on later. |
| Client type | **Confidential** if your server does the code exchange (you get a `client_secret`). **Public** if you can't keep a secret: there is no `client_secret` and PKCE is mandatory. |
| Redirect URLs | 1 to 5. They must be inside your allowed origins. Vout only redirects to one of them, compared exactly. |

### 3. Store your credentials

When you create the app you see the `client_id` (a UUID) and, if it's confidential, the `client_secret`. **The secret is shown only once**: Vout doesn't store it in plain text. If you lose it, generate a new one from the app's page; the old one stops working immediately.

Store it like any secret: in your server's environment variables, never in browser code or in the repository.

### 4. Submit your game

Under "Games" → "Submit game":

| Field | Notes |
| :--- | :--- |
| Name and description | Description between 20 and 2000 characters. |
| App | One of your active apps. |
| Game URL (`embed_url`) | The page loaded in the iframe. It must be inside the app's allowed origins. |
| Categories | 1 to 5. |
| Face control | Whether your game receives gesture controls (see "Declare whether your game supports gestures"). |
| Vout account | No account, optional or required (see "Playing without an account"). Required by default. |
| Cover, release date and repository | Optional. Without a cover, the catalog generates one from the name. |

The game stays **in review** and doesn't appear in the catalog until the Vout team approves it. If it's rejected, you see the reason in your dashboard; once you fix it, it goes back to review.

---

## Protocol: OAuth2 Authorization Code + PKCE

Vout implements **OAuth 2.0** with **PKCE** (Proof Key for Code Exchange), today's recommended flow for web applications. There is no implicit or password flow.

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

> **From your server, not the browser.** Today Vout only accepts browser requests (CORS) from its own domain. Do the code exchange (`/oauth/token`) and the calls to `/api/v1/user/me` from your backend. A site with no backend can't complete the OAuth flow yet; inside the portal it does receive the identity over `postMessage`.

---

## Step-by-Step Flow

### Step 1: Have your credentials at hand

From your dashboard (see "Step by step in your dashboard"):
- **`client_id`**: your app's public identifier (UUID).
- **`client_secret`**: only if your client is confidential.
- **`redirect_uri`**: one of the redirect URLs you registered, written exactly the same.

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
- If the user isn't signed in to Vout, they sign in (or sign up) first and then the flow continues.
- If they deny access, they come back to your `redirect_uri` with `?error=access_denied&state=...`. Always check that `state` is the one you sent.

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
        "name": "Ada",
        "username": "ada_plays",
        "avatar": "https://vout.example.com/storage/avatars/ada.jpg",
        "email": "ada@example.com"
    }
}
```

- `email` only appears if the token has the `user:email` scope.
- `avatar` is an absolute URL, or `null` if the player has no picture.
- `name` and `username` can change: always link the player by `vout_id`.
- With no token, or with an expired or revoked one, the response is `401`.

---

## Available Scopes

Scopes control which player data Vout shares with your app. Vout doesn't store your game's progress (levels, inventory, high scores): that lives in your database, keyed by `vout_id`.

| Scope | What it gives | Status |
| :--- | :--- | :--- |
| `user:read` | `vout_id`, `name`, `username`, `avatar` | Available. It's the default if you request none. |
| `user:email` | Also `email` in `/api/v1/user/me` | Available. |
| `games:read` | The player's history and stats in the portal | **Reserved.** There are no endpoints using it yet: don't request it. |
| `games:write` | Publishing high scores or favorites to the portal | **Reserved.** Same as above. |
| `game:play` | Portal token for games without an OAuth client | Internal: the portal itself issues it (see "Which token you get"). It isn't requested at `/oauth/authorize`. |

Only ask for what you need: the permissions screen shows it as is, and a player trusts an app that asks for little. If you later request a new scope, Vout asks the player again only about that one.

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

- Removes your app's authorization for that player.
- Revokes every access and refresh token your app holds for that player. Your next refresh fails with `invalid_grant` and `/api/v1/user/me` answers `401`.
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
&client_secret=YOUR_CLIENT_SECRET    (only if your client is confidential)
&scope=user:read
```

Refresh Tokens are valid for **30 days**. Each renewal gives you a new refresh token and the previous one stops working: always keep the latest. If renewal fails with `invalid_grant` (expired or revoked), send the player to `/oauth/authorize` again.

---

## External Identifier: `vout_id`

Each Vout user has a **unique UUID** called `vout_id`. It's the identifier you should store in your database to link the user.

You can obtain it from two places, and both return exactly the same value:

1. Inside the JWT, as the `vout_id` claim. No network in the middle, so it's instant.
2. From `GET /api/v1/user/me`, in the `vout_id` field. It also includes name, avatar, and email.

For the `JWT → local user` lookup, read the claim from the JWT and you save the call. Reserve `/me` for when you need fresh profile data (updated avatar, email, etc.).

Don't link by `sub` (an internal identifier whose format may change), nor by `email` or `username` (the player can change them).

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
Content-Security-Policy: frame-ancestors 'self' https://vout.example.com
```

`frame-ancestors` lists the **origins of the portal that will embed your game**, not your own. Replace `https://vout.example.com` with the portal's real domain (the one in the address bar). If the portal is also served with `www.`, add both. Your game can run on `localhost`, staging, or production — that does not affect this header. What matters is **where** the embedding iframe is loaded from: that's the origin you must authorize.

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
        "frame-ancestors 'self' https://vout.example.com",
    );
    return $response;
}
```

**Express / Node with Helmet** — Helmet enables `frameguard` by default. Disable it and configure CSP:

```js
app.use(helmet({ frameguard: false }));
app.use(helmet.contentSecurityPolicy({
    directives: {
        frameAncestors: ["'self'", 'https://vout.example.com'],
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
            value: "frame-ancestors 'self' https://vout.example.com",
        }],
    }];
}
```

**nginx** — in the game's `server` block:

```
add_header Content-Security-Policy "frame-ancestors 'self' https://vout.example.com" always;
# Remove any previous line setting X-Frame-Options.
```

**Apache** — in `.htaccess` or vhost:

```
Header always unset X-Frame-Options
Header always set Content-Security-Policy "frame-ancestors 'self' https://vout.example.com"
```

### Verify before publishing

```bash
curl -I https://your-game.com/ | grep -iE "x-frame|content-security"
```

- If you see `X-Frame-Options: SAMEORIGIN` or `DENY` → your game won't embed in Vout.
- If you see `Content-Security-Policy: frame-ancestors 'self' https://vout.example.com` → you're all set.

Without this header configured correctly, the portal's iframe will show a blank box, and your players won't be able to open your game from Vout. Check both environments (development and production) before submitting the game.

---

## Identity Inside the iFrame (`postMessage` handshake)

When a user opens your game from the portal, they are already signed in to Vout. Sending them to `/oauth/authorize` would make them repeat something they already did, so the portal hands your game an access token directly, over `postMessage`. Never in the URL.

If your game can be played without an account, people playing without one don't reach you with an identity: the portal replies with `VOUT_GUEST` (see "Playing without an account").

That token is a regular Vout access token: same format, same signature and same claims as the ones from `/oauth/token`. You validate it with the code you already have (see "Stateless Token Validation").

### The fastest way: the SDK

Vout publishes a script that does everything in this section for you. Load it, tell it the portal origin, and you are done:

```html
<script src="https://vout.example.com/sdk/vout-game.js"></script>
<script>
    const vout = VoutGame.connect({
        portalOrigin: 'https://vout.example.com',

        // Identity: arrives on connect and on every token renewal.
        onAuth(session) {
            // session = { token, expiresAt, voutId, username }
            // Send session.token to your backend and validate it there.
        },

        // Playing without an account (only if your game allows it): no identity.
        onGuest() {},

        // No more renewals are coming: drop the identity.
        onSessionEnd(reason) {},
    });

    // For your "Exit" button:
    // vout.exit();
</script>
```

With that, your game already works with face control. The keys and mouse the player drives with their face reach your page as regular keyboard and mouse events (`keydown`, `keyup`, `mousedown`, `click`…), so **your existing controls code works untouched**. A held gesture is a held key: if holding jump makes it higher in your game, it does with the face too.

The SDK also does what the browser would do with a real key and a code-created event doesn't: Enter and Space press the focused button, Tab moves to the next control and Escape closes an open `<dialog>`. That way a menu built in HTML can be navigated with gestures. Arrow keys don't move focus: if your menu is navigated with arrows, you handle that. Before each key the portal gives focus to your iframe: some browsers ignore `focus()` calls made by a cross-origin iframe that doesn't have focus, and without it Tab wouldn't move anything.

| Option | What for |
| :--- | :--- |
| `portalOrigin` | Required. The exact origin of the portal. |
| `onAuth(session)` | Identity and token. Called on connect and on every renewal. |
| `onGuest()` | Playing without an account: called once on connect, instead of `onAuth`. |
| `onSessionEnd(reason)` | The portal will no longer renew the token. |
| `suggestedPreset` | Gesture preset your game recommends (see "Face control"). |
| `simulateInput` | `true` by default. Set it to `false` if you prefer to handle keys and mouse yourself with `onKey` and `onPointer`. |
| `onAction(event, at)` / `onActionEnd(event, at)` | Game events (`JUMP`, `DUCK`…), if you use them. |
| `onKey(key)` / `onPointer(pointer)` / `onCursor(x, y)` | The raw input, in case you want something custom. |

What it returns: `vout.embedded` (whether you are inside the portal), `vout.session` (the latest session, or `null`), `vout.guest` (whether they play without an account), `vout.debug` (see "Debugging the integration"), `vout.exit()` and `vout.disconnect()`.

Outside the portal, `VoutGame.connect()` does nothing and `vout.embedded` is `false`. You can always call it and use your regular OAuth flow when you are not embedded.

The file has no dependencies. If you prefer not to load code from another domain, copy it into your project.

The rest of this section explains what happens underneath. Read it if you want to implement the protocol by hand or understand the limits.

### The messages

| Direction | Message | When |
| :--- | :--- | :--- |
| game → portal | `{ type: 'READY', suggestedPreset?: string }` | Your game can receive the identity. Repeat it until `VOUT_AUTH` or `VOUT_GUEST` arrives. |
| portal → game | `{ type: 'VOUT_AUTH', token, expiresAt, voutId, username }` | In response to every valid `READY`, and again each time the portal renews the token. |
| portal → game | `{ type: 'VOUT_GUEST' }` | In response to every valid `READY` when there is no identity to give you: someone is playing without an account. It never carries player data. |
| portal → game | `{ type: 'VOUT_SESSION_END', reason }` | No more renewals are coming. `reason` is `'signed_out'`, `'revoked'` or `'unavailable'`. |
| portal → game | `{ type: 'VOUT_ACTION', event: string, at: number }` | An action starts: a user gesture mapped to a game event (face control). |
| portal → game | `{ type: 'VOUT_ACTION_END', event: string, at: number }` | That action ends: the user stopped making the gesture. |
| portal → game | `{ type: 'VOUT_KEY', code, key, state: 'down' \| 'up', at }` | The user presses or releases a key with a gesture. `code` and `key` are those of `KeyboardEvent`. |
| portal → game | `{ type: 'VOUT_POINTER', button: 'left' \| 'right', state: 'down' \| 'up', at }` | The user presses or releases a mouse button with a gesture. Apply it where the cursor is. |
| portal → game | `{ type: 'VOUT_CURSOR', x: number, y: number }` | Head-movement cursor. Coordinates from 0 to 1, relative to your iframe. |
| game → portal | `{ type: 'EXIT' }` | The user wants to leave. The portal takes them to the catalog. |
| game → portal | `{ type: 'GAME_STATE', state: 'playing' \| 'paused' \| 'ended', score?: number }` | Reserved. The portal accepts it but does nothing with it yet. |

`expiresAt` is the token expiry in Unix seconds (the same value as its `exp` claim). `at` is in Unix milliseconds.

Ignore any `type` you don't know. The protocol may grow and your game shouldn't break because of it.

### How it happens

1. The portal loads your `embed_url` as is, with no parameters.
2. Your game sends `READY` to `window.parent`.
3. The portal checks two things: that `event.origin` is one of your app's `allowed_origins` (exact match on scheme, host and port) and that the message comes from the iframe it created. If anything is off, it drops the message without replying.
4. The portal replies with `VOUT_AUTH`, addressed to that origin only. If there is no identity to give you (see "Playing without an account"), it replies with `VOUT_GUEST`.
5. About 5 minutes before the token expires, the portal requests a new one and sends you another `VOUT_AUTH`. Always keep the latest.

Your iframe stays hidden until the handshake completes. It is hidden through opacity, not `display: none`: it has its real size from the very start, so you can measure the window and start your game loop as usual.

If you don't send `READY` within 8 seconds of your page loading, the user sees a "The game is not responding" notice with a retry button. A late `READY` still works and clears the notice by itself. Even so, send it as soon as your script starts: `READY` means "I can receive the identity", not "I finished loading all my assets".

### Which token you get

| | App with Vout accounts (with an OAuth client) | App without Vout accounts |
| :--- | :--- | :--- |
| `aud` | Your `client_id` | An internal portal client |
| `scopes` | `["user:read"]` | `["game:play"]` |
| Lifetime | 60 minutes | 60 minutes |
| Asks for consent | Only if your app is third-party and the user hasn't authorized it yet | No |

If the game is in "No account" mode, or the player has no identity to give you, there is no token: you get `VOUT_GUEST` (see "Playing without an account").

If your app has an OAuth client, the token is issued for you: validate `aud` against your `client_id` just like in the direct flow, and you can use it as a Bearer token against `/api/v1/user/me`.

If your game is catalog-only, the token is not issued for you. At most, use it to greet the player by name. If you need an identity you can rely on (saving progress, leaderboards), turn on Vout accounts for your app (request the credentials from its page).

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

The browser doesn't let the portal simulate keys or clicks inside an iframe from another origin. So the portal doesn't press the key: it tells your game which one to press, with a message, and your page creates the event.

| The user mapped the gesture to… | Your game receives | With the SDK |
| :--- | :--- | :--- |
| A key | `VOUT_KEY` on press and on release | Real `keydown` and `keyup` events |
| A mouse button | `VOUT_POINTER` on press and on release | Real `mousedown`, `mouseup` and `click` events (and the pointer ones) at the cursor position |
| The cursor with the head | `VOUT_CURSOR` | `mousemove` and `pointermove` events |
| A game event | `VOUT_ACTION` and `VOUT_ACTION_END` | Your `onAction` and `onActionEnd` callbacks |

The important part: **every user has their own mapping**, and they bring it to every game. Most use keys (Space to jump, arrows to move). If your game is already played with the keyboard and you turn `VOUT_KEY` into keyboard events, it works with any user's mapping without you doing anything else.

The presets Vout offers:

| Preset | What it emits |
| :--- | :--- |
| `platformer` | Keys: Space, arrows, Z, X, C |
| `shooter` | Keys, left click and head cursor |
| `accessible` | Keys: Space, Enter, arrows, Escape |
| `runner` | Game events `JUMP`, `DUCK` and `PAUSE` |

If your game has actions of its own that don't fit a key, you can recommend a preset by sending `suggestedPreset` in your `READY` (for example `'runner'`). The portal asks the user once, in the face control panel, whether they use your game's controls or their own, and remembers the answer for your game (without touching their saved configuration). If you change the suggested preset, they're asked again. Someone trying face control without having set it up uses yours directly. It is a suggestion: the user can keep their own controls, so don't rely on it alone.

#### If you convert keys by hand

Without the SDK, this is the minimum for a portal key to reach your keyboard code:

```js
function onVoutKey(message) {
    const event = new KeyboardEvent(message.state === 'down' ? 'keydown' : 'keyup', {
        key: message.key,
        code: message.code,
        bubbles: true,
        cancelable: true,
    });
    (document.activeElement || document.body).dispatchEvent(event);
}
```

Three things the SDK already handles and you will need to take care of:

- **`keyCode`.** An event created this way has `keyCode` set to 0. If your game or your engine (Phaser, for example) reads `event.keyCode`, define it with `Object.defineProperty`.
- **Very short presses.** A gesture in "tap" mode arrives as key down and key up back to back. If you poll key state once per frame, hold the key for a minimum time (the SDK uses 80 ms).
- **Where you listen.** The event is dispatched on the focused element and bubbles up to `document` and `window`. If you listen on a `<canvas>` that doesn't have focus, it won't reach you.

These events don't count as a real user action for the browser (`isTrusted` is `false`). They work for your game logic, but not for things that require a real gesture: going fullscreen, unlocking audio or copying to the clipboard.

The portal draws the cursor: a reticle on top of your game, at the same position it sends you through `VOUT_CURSOR`. You don't need to draw another one; highlighting what is underneath helps.

#### Taps and held actions

A held gesture is a held action. Everything the user does with a gesture has a start and an end:

| Gesture mapping | When the gesture starts | When it ends |
| :--- | :--- | :--- |
| Key in hold mode | `VOUT_KEY` with `state: 'down'` | `VOUT_KEY` with `state: 'up'` |
| Key in tap mode | `VOUT_KEY` `down` and `up` back to back | Nothing |
| Mouse button | `VOUT_POINTER` with `state: 'down'` | `VOUT_POINTER` with `state: 'up'` |
| Game event | `VOUT_ACTION` | `VOUT_ACTION_END` |

If your game tells a tap from a long press (short or high jump, crouching while held, gliding), treat Vout's input just like a keyboard's. Three details worth knowing:

- **How long the end takes to arrive.** With the head (up, down, sideways) it is immediate. With a facial gesture (eyebrows, mouth) it arrives one or two tenths of a second after the user relaxes it: the time the signal takes to drop plus a short margin so that one bad frame is not mistaken for a release.
- **A gesture is slower than a finger.** The fastest tap a person makes with their eyebrows or mouth lasts between 0.2 and 0.4 seconds. If your threshold between "tap" and "hold" was designed for a keyboard (0.1 seconds, for example), every gesture will look held to you. For Vout's input a longer threshold works better.
- **Two gestures can hold the same action.** In the `runner` preset, both raising the eyebrows and tilting the head up emit `JUMP`. You may receive two `VOUT_ACTION` in a row for the same event; `VOUT_ACTION_END` arrives only once, when the user releases the last one.

Two gestures in a row are two actions: as soon as the user releases, the next gesture starts from scratch, with no waiting.

The portal always releases what it presses. If the user turns the camera off, switches tabs, changes preset or leaves the camera frame with something held, you receive its end. If the face stops being seen, the end arrives after a quarter of a second.

#### When the gesture happened

`at` tells you when it really happened, in Unix milliseconds of the browser clock (the same as your `Date.now()`, because the portal and your game run on the same machine). Between the gesture and the message there is the time it takes to analyze the image; with `at` you can subtract it, which is useful in a rhythm game.

- In `VOUT_ACTION`, `at` is the instant of the camera image in which the portal saw the gesture start.
- In `VOUT_ACTION_END`, it is the best estimate of when it ended: the image in which the head left the zone, or the last one in which the facial gesture was seen.

Treat it as a hint and bound it: if `at` is in the future or more than a couple of seconds in the past, use the moment the message reached you.

The user can also map a gesture to an event with any name they like, and it reaches you as is in `event`. Treat it as text you don't control: compare it against your list of actions and drop the rest.

### Declare whether your game supports gestures

The portal can't check whether your game understands the messages above: your page lives on another origin. That's why, when you submit the game (or edit it in your dashboard), you declare one of these three levels under "Face control". The Vout team reviews it when approving the game.

| Level | When to choose it | What the portal does |
| :--- | :--- | :--- |
| **Doesn't receive Vout's controls** (default) | Your game doesn't use the SDK or convert `VOUT_KEY` / `VOUT_POINTER`. | It doesn't offer the camera in your game. |
| **Compatible** | You use the SDK (or convert the messages by hand) and your game can be played with keyboard or mouse. | It offers the camera with each user's own controls, may switch it on automatically for users who allowed it, and shows the "Supports gestures" badge. |
| **Made for gestures** | On top of that, it plays well with gestures alone: few actions, no split-second precision, and tolerant of a small delay. | The same, with the "Made for gestures" badge. People who play with the camera find it with the catalog filter. |

Be conservative: declaring "Compatible" when it isn't leaves someone who plays hands-free with a camera switched on that does nothing. If in doubt, try your game with the portal's face control before submitting it.

### Playing without an account

When you submit the game (or edit it in your dashboard) you choose who can play under "Vout account". The Vout team reviews it, like face control.

| Mode | Who plays | What your game receives |
| :--- | :--- | :--- |
| **No account** | Anyone, without signing in. | Always `VOUT_GUEST`, even if the player is signed in to Vout. Never their identity, and a third-party app doesn't ask for consent. |
| **Optional account** | Anyone, without signing in. | `VOUT_AUTH` if the player signed in with a confirmed account and authorized you. Otherwise, `VOUT_GUEST`. |
| **Account required** (default) | Only people signed in with a confirmed account. Everyone else is asked to sign in before your iframe loads. | Always `VOUT_AUTH`. |

Pick "No account" if your game stores nothing per player: that way you don't receive data you don't use. Pick "Optional account" if you save progress but want anyone to try it in one click.

With "Optional account", `VOUT_GUEST` arrives in three cases: the player isn't signed in, hasn't confirmed their email yet or, for a third-party app, chose "Play without sharing my account" on the permissions screen. The portal tells them why the game doesn't recognize them and offers to fix it. If they sign in, they come back to a fresh load of your iframe, which receives `VOUT_AUTH`: within one load a guest never turns into a signed-in player.

With a guest:

- Gesture controls arrive just the same (`VOUT_KEY`, `VOUT_ACTION`…), with the default controls or the ones your game suggests. Vout stores nothing about the guest.
- There is no token and no renewals, so no `VOUT_SESSION_END` either.
- If you want to keep their progress, do it in your game (for example, in `localStorage`). Vout doesn't merge what they played as a guest into the account they create later: if you want that, offer it yourself when `VOUT_AUTH` arrives.

### Minimal example without the SDK

```js
// The portal origin, fixed in your configuration. Never derive it from the message.
const VOUT_ORIGIN = 'https://vout.example.com';

let session = null;
// The portal already answered READY (with VOUT_AUTH or VOUT_GUEST).
let connected = false;

window.addEventListener('message', (event) => {
    if (event.origin !== VOUT_ORIGIN || event.source !== window.parent) return;

    const message = event.data;
    if (!message || typeof message.type !== 'string') return;

    switch (message.type) {
        case 'VOUT_AUTH':
            // Arrives after READY and on every renewal: keep the latest.
            connected = true;
            session = { token: message.token, expiresAt: message.expiresAt };
            // Send it to your backend and validate it there (signature, iss, aud, exp).
            break;
        case 'VOUT_GUEST':
            // Playing without an account: no identity (see "Playing without an account").
            connected = true;
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
        case 'VOUT_KEY':
            // A key from the user's mapping: turn it into a real event.
            onVoutKey(message);
            break;
        // VOUT_POINTER, VOUT_CURSOR and any unknown type: ignore them if you don't use them.
    }
});

// Repeat READY until the portal answers, in case it wasn't listening yet.
(function announce() {
    if (connected) return;
    window.parent.postMessage({ type: 'READY', suggestedPreset: 'runner' }, VOUT_ORIGIN);
    setTimeout(announce, 500);
})();

function exitToPortal() {
    window.parent.postMessage({ type: 'EXIT' }, VOUT_ORIGIN);
}
```

To know whether you are embedded, check `window.parent !== window`. Outside the portal, use the regular OAuth flow.

### Debugging the integration

Open your game in the portal adding `?voutdebug=1` to the address (for example `/play/your-game?voutdebug=1`). The portal doesn't change your iframe URL: it tells you inside `VOUT_AUTH` (or `VOUT_GUEST`), with the `debug: true` field. Use it to turn on your own debug mode.

With the SDK, `vout.debug` is `true` and every portal message is written to the console (without the token).

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
**No.** Vout uses standard OAuth2. Any compatible OAuth2 library works. For a game embedded in the portal there is an optional SDK (`/sdk/vout-game.js`) that saves you from implementing the iframe protocol.

### What if my game has no backend?
Inside the portal it can know who is playing (`VOUT_AUTH` carries `voutId` and `username`) and receive gestures, but without a server it can't verify the token or store anything under the player's name. Outside the portal, "Sign in with Vout" needs a backend today: Vout doesn't yet accept the code exchange from a browser on another domain (CORS). If your game stores nothing per player, publish it in "No account" mode.

### Can I register my app but not use authentication?
**Yes.** When you create the app, say it doesn't use Vout accounts: no OAuth client is created. Your game can be in the catalog ("No account" mode) and still receive gestures. If you want accounts later, request the credentials from the app's page.

### Can I test locally?
**Yes.** Add your local origin (for example `http://localhost:8090`) to the allowed origins and a local redirect URL. Keep in mind what "Watch out locally" says about cookies inside the iframe.

### What if I change domains?
Add the new origin and its redirect URLs to the app, and update your game's URL from your dashboard. Keep the old one until it's no longer used.

### Can I refresh the token from inside the portal's iframe?
**Don't count on it.** While embedded, your cookies are third-party and the browser may block them. The portal renews the token for you and resends it with another `VOUT_AUTH` before the previous one expires (see "Identity Inside the iFrame").

### How are first-party projects different from third-party ones?
Apps marked as `is_first_party = true` don't show the authorization prompt to the user. Only the Vout team can mark an app that way. The OAuth2 flow is identical in both cases — the only difference is the user experience.

---

## Pre-publish checklist

- [ ] Your app's allowed origins are exactly your game's (scheme, host and port), production included.
- [ ] Your server lets the portal embed you (`frame-ancestors`) and doesn't send `X-Frame-Options`.
- [ ] Your game sends `READY` as soon as it starts and accepts `VOUT_AUTH` and `VOUT_GUEST` (or uses the SDK).
- [ ] When receiving messages you check `event.origin` and `event.source`; when sending, you pass the portal's origin, never `'*'`.
- [ ] Your backend verifies every token: signature against the JWKS, `iss`, `aud` equal to your `client_id`, and `exp`.
- [ ] You store each player by `vout_id`, not by `sub`, `email` or `username`.
- [ ] The `client_secret` only lives on your server.
- [ ] The account mode and face-control level you declare are the real ones.

---

## Support

Everything in this guide is done from your dashboard, without asking anyone. The only things that depend on the Vout team are reviewing games and marking an app as one of Vout's own.
