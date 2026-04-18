---
version: "1.0.0"
last_updated: "2026-04-18"
---

# Privacy Policy

> **The short version:** we collect only what the portal needs to work, we don't sell your data, we don't use advertising trackers, and **camera frames never leave your browser**. You can export all your data and delete your account from `Settings → Privacy` whenever you want.

## 1. Who's the data controller

- **Controller:** {{holder_name}}, natural person, {{domain}}.
- **Privacy contact:** {{contact_email}}
- **Data Protection Officer (DPO):** not applicable. This project does not reach the thresholds of Article 37 GDPR or Article 34 LOPDGDD that would require appointing a DPO.

If you have any question about your data, email {{contact_email}}. No bureaucratic forms — an email is enough.

## 2. What data we collect and why

We only store what we actually use. Here's the full table, derived from Vout's own database:

### 2.1. Account data

| Data | When we collect it | Why we need it | Legal basis |
|---|---|---|---|
| **Name**, **username**, **email**, **password** | Email sign-up | Identify and authenticate you, reach you for important account matters | Performance of a contract (art. 6.1.b GDPR) |
| **Email**, **name**, **avatar** (Google URL), **Google ID** | Google sign-up (Socialite) | Create your account in one click; save you another password | Consent (art. 6.1.a GDPR) |
| **`vout_id`** (unique UUID) | Auto-generated at sign-up | Public identifier that ecosystem apps see — we never expose your internal ID | Performance of a contract |
| **Bio** (up to 500 chars), **own avatar** (image up to 2 MB) | If you fill them in | Personalize your presence on the portal | Consent |
| **Email verified**, **2FA secrets** (encrypted), **"remember me" token** | Automatic on email verification / 2FA activation / "remember me" checkbox | Account security | Performance of a contract |

**Passwords** are stored hashed with bcrypt. **2FA secrets** are encrypted in the database. Nobody — not even the portal admin — can read them in plain text.

### 2.2. Preferences and activity inside the portal

| Data | Why we store it |
|---|---|
| Light/dark theme, sidebar state, mascot toggle, preferred language | Remember your preferences across sessions |
| Favorite games, saved games, play count, best score per game, last played at | Personalize your dashboard and show "Continue playing" |
| Gesture configs (profile name, sensitivity 1-10, key↔gesture mapping) | Save your facial-control calibration so you don't have to redo it every session |

**Legal basis:** performance of a contract (art. 6.1.b) or legitimate interest (art. 6.1.f) in improving your experience. You can revoke these preferences by deleting your account or changing them in `Settings`.

### 2.3. Session technical data

While you browse the portal, the server records:

- Your **IP address** (v4 or v6) and **user agent** (browser + OS), in the `sessions` table, to keep you logged in.
- Access events to `/auth/*` in the **server logs**, for 14 days, to detect abuse and issues.

This is the minimum required to operate a secure web service. **Legal basis:** legitimate interest (art. 6.1.f GDPR) in system security and integrity.

### 2.4. Data we do **NOT** collect

To be crystal clear, here's a list of things other portals ask for and we **don't**:

- ❌ **Date of birth** or exact age. We only ask you to declare you're at least 14 years old (Spanish digital consent age).
- ❌ **Gender**, **geographic location**, **phone number**.
- ❌ **Banking, card or payment data**. Vout charges for nothing.
- ❌ **Third-party analytics**: no Google Analytics, Meta Pixel, Hotjar, Mixpanel, GTM, or anything similar.
- ❌ **Biometric data**. Computer vision processes frames in your browser (see §6).

## 3. Data we share with third parties

There are some transfers, and we want you to know them all:

| Recipient | What they receive | Purpose | Legal basis |
|---|---|---|---|
| **Google** (when you use "Sign in with Google") | Google learns that you've authenticated to Vout. Vout receives from Google: `google_id`, email, name and avatar URL. We use the `openid profile email` scopes (the defaults — we don't ask for more). | SSO sign-in | Your consent when clicking the button |
| **Transactional email provider** | Your email and name | Send email verification, password reset, moderation notifications | Performance of a contract |
| **Ecosystem OAuth applications** you authorize | Only what the scope you approve permits: `user:read` → `vout_id`, name, username, avatar. `user:email` → also email. `games:read`/`games:write` → your history and scores. **Never shared** with apps: email without `user:email`, password, `google_id`, IP, or 2FA secrets. | So you can use your Vout identity in other apps (e.g., a game published by a third party) | Your explicit consent on the "Authorize application" screen |
| **Hosting provider** | All of the above, as processor | Host the database and servers | Processing agreement (art. 28 GDPR) |

We never sell or share your data for third-party marketing or advertising.

### 3.1. International transfers

Google LLC operates in the United States but complies with the EU Standard Contractual Clauses and the EU–US Data Privacy Framework (DPF). This allows lawful transfer.

Our hosting provider is located in the EU or in countries with an adequacy decision. If we ever move to a provider outside those zones, we'll update this section and notify you.

## 4. How long we keep your data

| Data | Retention |
|---|---|
| Account data while active | Indefinite, until you delete it or we close it for abuse |
| Account data after deletion | Purged immediately. Games you submitted as a developer stay published but unlinked from you (anonymized) |
| Session cookies | 120 minutes of inactivity |
| "Remember me" cookie | 5 years if you tick the option |
| Server logs | 14 days |
| Audit logs (admin actions) | 180 days |

## 5. Your rights — and how to exercise them

The GDPR gives you **strong rights** over your data. With Vout you exercise them like this:

| Right | What it means | How to do it |
|---|---|---|
| **Access** | Know what data we hold about you | Email {{contact_email}} or download it from `Settings → Privacy → Export my data` (returns a JSON with everything) |
| **Portability** | Download your data in a structured, machine-readable format | The same JSON export satisfies art. 20 GDPR |
| **Rectification** | Correct wrong data | Update your profile from `Settings → Profile` or email us |
| **Erasure / "right to be forgotten"** | Delete your data | `Settings → Privacy → Delete my account` or email {{contact_email}}. The action is immediate and irreversible |
| **Objection** to processing | Stop processing your data in certain cases | Email {{contact_email}} explaining your situation |
| **Restriction** of processing | Freeze use of your data while we review something | Same — via email |
| **Withdraw consent** | Revoke consent previously given (e.g., connecting Google) | Unlink from `Settings` or ask by email |

If you feel we're not respecting these rights, you can file a complaint with the **Spanish Data Protection Agency (AEPD)**: [www.aepd.es](https://www.aepd.es/). But please reach out to us first — we can almost certainly sort it out.

## 6. Computer vision (MediaPipe): what we do and what we do NOT do

This is one of the most sensitive points and we want it **crystal clear**.

When you activate facial gesture controls:

- Your **camera is only turned on** if you press the "Activate" button. Without that explicit click, we don't touch the hardware.
- Image analysis is done by **MediaPipe FaceLandmarker in your browser**, inside an isolated Web Worker. **Video frames never leave your device.**
- What we save in our database is **only numeric configuration**: a profile name, a sensitivity value (1-10), and a JSON mapping "this gesture triggers this key". **No biometric vectors, no landmarks, no images, no facial templates.**
- When you close the tab or leave the game, the camera stream stops immediately.

This aligns with the **GDPR minimization principle (art. 5.1.c)** and the AEPD guidelines on biometrics (**local/edge computing**). We do not process art. 9 GDPR biometric data because we neither store nor centrally process any trait that uniquely identifies a person.

You can disable the feature anytime at `Settings → Appearance → Gesture controls`. Doing so disables the worker, and we won't request camera access again until you enable it.

## 7. Minors

Vout requires you to be **at least 14 years old** to create an account (Article 7 LOPDGDD — Spanish digital consent age). If we find an account belongs to someone under 14, we'll delete it without prior notice.

Catalog games are playable **without an account** at any age. The age requirement applies only to sign-up and progress sync.

## 8. Security

We apply reasonable technical measures for a project of this size:

- Passwords hashed with bcrypt, not in plain text.
- `HttpOnly` and `SameSite=lax` cookies to protect them from JS access.
- Optional TOTP 2FA.
- CSRF protection on every form and endpoint.
- OAuth tokens signed with RS256 and short TTL (60 minutes).
- HTTPS in production.
- Strict origin validation (CORS) on the ecosystem APIs.

No system is 100% invulnerable. If you find a security issue, please email us before making it public at {{contact_email}} — we'd rather fix it fast and credit you in the repo.

## 9. Changes to this policy

If we change something substantial (e.g., adding a new data type, a new recipient, or changing retention), we'll update the date above and ask you to accept the new version next time you sign in. Minor changes (typos, rewording) only update the date.

## 10. Contact

For any question about your data: **{{contact_email}}**.
