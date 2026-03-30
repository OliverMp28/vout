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

## Stateless Token Validation (Advanced)

Vout's Access Tokens are **JWTs signed with RS256**. This means your server can validate tokens **without querying Vout's database**, using the public key.

### Public Keys Endpoint (JWKS)
```
GET https://vout.example.com/oauth/token/keys
```

Returns the public keys in JWKS format. Your JWT library can use them to verify signatures.

### Data Inside the Token (Claims)

| Claim | Description |
| :--- | :--- |
| `sub` | Internal user ID (don't use externally) |
| `aud` | Your `client_id` |
| `iss` | Vout IdP URL |
| `exp` | Expiration timestamp |
| `scopes` | Array of authorized scopes |

### Validation example with `lcobucci/jwt` (PHP)

```php
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;

$config = Configuration::forSymmetricSigner(
    new Sha256(),
    InMemory::file('/path/to/vout-public-key.pem')
);

$token = $config->parser()->parse($accessToken);

// Validate signature, issuer, audience, and expiration
$constraints = [
    new \Lcobucci\JWT\Validation\Constraint\SignedWith($config->signer(), $config->signingKey()),
    new \Lcobucci\JWT\Validation\Constraint\IssuedBy('https://vout.example.com'),
    new \Lcobucci\JWT\Validation\Constraint\PermittedFor('YOUR_CLIENT_ID'),
    new \Lcobucci\JWT\Validation\Constraint\StrictValidAt(new \DateTimeImmutable()),
];
```

> **Recommendation:** If your app has a backend, it's simpler to use the `/api/v1/user/me` endpoint than to validate the JWT directly. Stateless validation is useful for optimizing performance when you have many requests.

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
