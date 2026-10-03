# Launcher authentication

The launcher identity and selected Minecraft account are separate. Only Gorth OIDC can create a launcher session. At this stage only Offline game profiles are enabled. Ely.by and Gorth game login/refresh/play are disabled; existing saved records are preserved. No Microsoft flow exists.

## Configuration

Set the three GORTH_SSO_* public client variables from `.env.example` in the shell or local Vite environment before dev/build. Vite embeds only these allowlisted values into main, never the renderer. No client secret is used.

- `VITE_GORTH_SSO_ISSUER`: exact issuer reported by Gorth discovery at `/.well-known/openid-configuration`.
- `VITE_GORTH_SSO_CLIENT_ID`: public desktop OAuth client, default `gorth-launcher`.
- `VITE_GORTH_SSO_REDIRECT_URI`: exact registered URI, default `http://127.0.0.1:43821/auth/callback`.

Gorth SSO needs a client registration with:

- public: true; token_endpoint_auth_method: none; require_pkce: true;
- grant_types: authorization_code, refresh_token; response_types: code;
- application_type: native; scopes: openid, profile, email, offline_access;
- redirect_uris: the exact configured loopback callback.

The SSO repository includes both desktop clients in `server/database/seeds/oauth-clients.json` and an explicit `pnpm --dir server db:seed:desktop-clients` command. An administrator must run it against the intended database; it inserts missing clients without overwriting existing ones. This change has not executed that command or modified a remote database. No central SSO secrets belong in a desktop application.

## Provider contracts

Offline profiles validate 3–16 ASCII letters/digits/underscore and use the Java-compatible MD5 name UUID of `OfflinePlayer:<name>`. This is a local profile, never a launcher identity or an authenticated online session.

Gorth launcher opens the system browser. A loopback listener validates single-use state, callback issuer when supplied, and times out after three minutes. Authorization-code exchange uses PKCE S256. ID tokens are verified with same-origin discovery/JWKS, signature, issuer, audience, expiry, nonce, authorized-party and access-token/code hashes when supplied. Refresh preserves the verified subject. This follows the chat app protocol, using an OS-encrypted vault instead of server cookies.

The legacy Ely and Gorth game adapters remain in source for future work, but are not enabled in the UI or auth command service.

The optional Gorth game adapter currently expects the standard Yggdrasil contract:

- POST `<root>/authserver/authenticate` with agent, username, password, clientToken, requestUser.
- POST `<root>/authserver/refresh` with accessToken, clientToken, selectedProfile.
- response: accessToken, matching clientToken, selectedProfile { id, name }.

No such Gorth game backend was found in the inspected SSO repository. The adapter stays disabled without its root URL. Do not point it at SSO or treat SSO access tokens as Minecraft sessions. If Gorth game will use an SSO-to-game token exchange instead, that backend contract must replace this adapter.

## Storage and lifecycle

Main process stores `auth.v1.enc` under Electron userData using OS-backed Electron safeStorage and atomic writes with mode 0600. It fails closed if encryption is unavailable, including Linux basic_text. No passwords are persisted. IPC only returns allowlisted public profile fields; access, refresh, client and device tokens never reach the renderer.

Startup snapshots do not decrypt the vault. Use Unlock saved session or Sign in deliberately; macOS can ask for Keychain permission at that point. Denied access preserves the vault and allows retry. Unlock refreshes an expired Gorth session when its refresh token and configuration match; refresh is also available in Accounts. UserInfo subject must match the verified ID token before its profile is accepted. Invalid grants clear the affected token state. Signing out clears local credentials first and attempts revocation of this app's access and refresh tokens. A network failure reports a warning without restoring the local session. This does not end the provider's browser SSO session.

The Vanilla launch engine calls `resolveGameSession()` before spawning Temurin 17. Only Offline profiles are accepted in this stage. Gorth SSO tokens are never used as Minecraft credentials.

The initial window is shown independently of renderer readiness. Failed initial Vite loads are caught and retried up to three times, rather than leaving a hidden window that requires CLI rs.

## Verification

`pnpm test:auth` tests offline UUIDs, input/config validation, token rotation, local mocked Gorth OIDC including bad state/signature/issuer/audience/nonce/expiry/hash/userinfo subject, revocation, refresh consistency, cancellation, and vault/IPC safety. Legacy Ely/Yggdrasil adapter tests remain, but their product entry points are disabled. Mock tests do not prove live provider registration or login. Real Gorth accounts and configured clients are needed for end-to-end verification.
