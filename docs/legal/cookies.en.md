---
version: "1.0.0"
last_updated: "2026-04-18"
---

# Cookie Policy

> **The short version:** Vout only uses technical cookies (so the portal works) and, if you browse as a guest, a single preference cookie to remember your theme between visits. **No advertising trackers, no third-party analytics.** If you’re signed in, your preferences live in your account, not in cookies. You can review your decision anytime from the **“Manage cookies”** link in the footer.

## 1. What a cookie is — and what counts as one

A cookie is a small file your browser stores to remember information across visits (for example, that you’re already logged in). Similar technologies such as `localStorage` and `sessionStorage` are legally treated the same way and are also covered by this page.

## 2. Cookies we use

| Name | Type | Purpose | Duration |
|---|---|---|---|
| `vout-session` | Technical | Keep your session logged in | 120 minutes of inactivity |
| `XSRF-TOKEN` | Technical | CSRF form protection | Session |
| `remember_web_*` | Technical | Keep you signed in if you ticked “remember me” | 5 years |
| `appearance` | Preference (guests) / Technical (signed in) | Remember your theme (light / dark / system). When you’re signed in it mirrors your account preference. | 1 year |
| `appearance` (localStorage) | Same as above | Local theme mirror to prevent flash on load | Until you clear your browser |
| `sidebar_state` | Technical | Remember whether your admin-panel sidebar is open or closed. Only appears after signing in as an admin and is required so the UI returns to the layout you chose. | 7 days |
| `vout-cookie-consent` | Technical | Remember your decision about preference cookies | 12 months |

All of them are **first-party**. The **technical** ones are required for the portal to work (or, in the case of `sidebar_state` and the signed-in `appearance`, so the UI reflects preferences you already saved deliberately). They are exempt from prior consent under Article 22.2 LSSI-CE. The only true **preference cookie** is `appearance` while you browse as a guest: it’s only written if you accept it and it’s wiped if you reject it.

## 3. How to manage them in Vout

- **If you browse as a guest:** the first time you visit you’ll see a notice at the bottom with three equal-weight buttons: **Accept**, **Reject** and **Preferences**. Your choice is stored for 12 months. The theme toggle (light / dark / system) is available from the theme button in the top-right corner of any page: if you accepted cookies it’s remembered; otherwise it only lasts the current session.
- **If you’re signed in:** we don’t show the banner because no preference cookies are left to manage (your theme lives in your account and `sidebar_state` is functional admin UI state). You can change your theme at any time from **Settings → Appearance** and it will be saved to your profile, not to a cookie.
- **Reopen the panel:** the “Manage cookies” link in the footer always lets you review the inventory and, as a guest, change your decision whenever you want.
- **Version changes:** if we update this policy or add new cookies, we’ll ask you again.

You can also delete or block them from your browser settings, or browse in private/incognito mode so nothing is stored.

## 4. What happens if you reject them

- **Technical cookies** stay active because without them you couldn’t log in or browse securely.
- The **preference cookie `appearance`** stops being written and we delete any that was already stored. As a guest, you can still change the theme in the current session but we’ll forget your choice once you close the browser. This doesn’t affect your account (if you sign up or sign in, the theme moves to your profile) or your in-game progress.

## 5. Sharing with third parties

Today Vout does **not share** any cookies or cookie data with third parties. If we add services in the future that require it (for example, a self-hosted analytics tool), they will remain blocked until you give consent via the banner.

## 6. Changes to this policy

If we add, remove or change the use of any cookie, we’ll update the date on this page and the banner will reopen on your next visit so you can confirm your choice.

## 7. Contact

For any cookie-related questions, write to us at {{contact_email}}.
