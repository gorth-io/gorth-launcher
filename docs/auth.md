# Launcher authentication

The launcher identity and selected Minecraft account are separate. Only Gorth OIDC can create a launcher session. At this stage only Offline game profiles are enabled. Ely.by and Gorth game login/refresh/play are disabled; existing saved records are preserved. No Microsoft flow exists.

## Configuration

Set the VITE_SSO_* and VITE_APP_URL public client variables from `.env.example` before dev/build. OAuth configuration is consumed by main; tokens never enter the renderer. No client secret is used.

- `VITE_SSO_OAUTH_CLIENT_ID`: `gorth-launcher`.
- `VITE_SSO_CLIENT_URL`: SSO frontend origin, e.g. `http://localhost:3000`; issuer is `<origin>/auth` and discovery is `<origin>/auth/.well-known/openid-configuration`.
- `VITE_SSO_SERVER_URL`: SSO backend origin, e.g. `http://localhost:8080`; OAuth uses the frontend's existing `/auth` proxy.
- `VITE_APP_URL`: `http://localhost:5502`; registered redirect is `<origin>/auth/callback`.

Production UI uses an embedded, sandboxed WebContentsView in the existing launcher window. Main intercepts the exact registered callback before navigation and validates it directly; no external browser, popup or new window is used. A persistent Hono /auth/callback route also delivers HTTP redirects to the same PKCE transaction. Vite forwards domain routes to main over a private OS socket/named pipe in dev, without a second TCP port. Packaged Hono serves the renderer and domain routes on the configured app port. VITE_SSO_ACCESS_TOKEN/REFRESH_TOKEN/SESSION_APP and VITE_SSO_OAUTH_* transaction names are exported names, not credentials; desktop OAuth tokens remain in the encrypted vault and transaction state stays in main memory. SSO's own HttpOnly cookies live in a dedicated Electron session partition.

Gorth SSO needs a client registration with:

- public: true; token_endpoint_auth_method: none; require_pkce: true;
- grant_types: authorization_code, refresh_token; response_types: code;
- application_type: native; scopes: openid, profile, email, offline_access;
- redirect_uris: the exact configured loopback callback.

The SSO repository includes both desktop clients in `server/database/seeds/oauth-clients.json` and an explicit `pnpm --dir server db:seed:desktop-clients` command. It inserts missing clients without overwriting existing ones. On 2026-10-05 both clients were inserted and read back from the configured SSO database. No central SSO secrets belong in a desktop application. Database registration does not prove live user login.

## Provider contracts

Offline profiles validate 3–16 ASCII letters/digits/underscore and use the Java-compatible MD5 name UUID of `OfflinePlayer:<name>`. This is a local profile, never a launcher identity or an authenticated online session.

Login opens the existing SSO sign-in page inside the launcher; registration uses `prompt=create` like Chat and keeps the SSO registration/OTP/consent flow intact. Password reset and verification stay owned by SSO. The native view has no preload or Electron bridge, denies permissions/downloads, blocks foreign navigation, and always denies new-window requests. Allowed Gorth links remain in the same view. Single-use state and callback issuer are verified in main, with a three-minute login timeout and ten-minute registration timeout. PKCE S256 and signed ID-token verification remain required. Cancel or closing the parent destroys the auth view and aborts the transaction.

`AuthProvider` mounts once at renderer root. `useAuth()` exposes `account`, `username`, `authenticated`, `loading`, `locked`, `error`, `login`, `register`, `logout`, `refresh`, `unlock`, `cancel`, plus existing launcher `auth/run/busy/ready` APIs. `useUser()` exposes the verified public profile and loading/error/refresh helpers; `useAccount()` returns the public account. No hook returns an OAuth token. A single controller refreshes near-expiry unlocked sessions and on window focus. `AuthGuard` is opt-in so Offline play remains available without SSO.

The legacy Ely and Gorth game adapters remain in source for future work, but are not enabled in the UI or auth command service.

The optional Gorth game adapter currently expects the standard Yggdrasil contract:

- POST `<root>/authserver/authenticate` with agent, username, password, clientToken, requestUser.
- POST `<root>/authserver/refresh` with accessToken, clientToken, selectedProfile.
- response: accessToken, matching clientToken, selectedProfile { id, name }.

No such Gorth game backend was found in the inspected SSO repository. The adapter stays disabled without its root URL. Do not point it at SSO or treat SSO access tokens as Minecraft sessions. If Gorth game will use an SSO-to-game token exchange instead, that backend contract must replace this adapter.

## Storage and lifecycle

Main process stores `auth.v1.enc` under Electron userData using OS-backed Electron safeStorage and atomic writes with mode 0600. It fails closed if encryption is unavailable, including Linux basic_text. No passwords are persisted. IPC only returns allowlisted public profile fields; access, refresh, client and device tokens never reach the renderer.

Startup snapshots do not decrypt the vault. Use Unlock saved session or Sign in deliberately; macOS can ask for Keychain permission at that point. Denied access preserves the vault and allows retry. Unlock refreshes an expired Gorth session when its refresh token and configuration match. UserInfo subject must match the verified ID token. Signing out clears local credentials and this app's isolated SSO browser storage, then attempts token revocation; other desktop/web app sessions remain untouched. Network failure does not restore the local session.

The Vanilla launch engine calls `resolveGameSession()` before spawning Temurin 17. Only Offline profiles are accepted in this stage. Gorth SSO tokens are never used as Minecraft credentials.

The initial window is shown independently of renderer readiness. Failed initial Vite loads are caught and retried up to three times, rather than leaving a hidden window that requires CLI rs.

## Verification

`pnpm test:auth` tests offline UUIDs, input/config validation, token rotation, local mocked Gorth OIDC including bad state/signature/issuer/audience/nonce/expiry/hash/userinfo subject, revocation, refresh consistency, cancellation, and vault/IPC safety. Legacy Ely/Yggdrasil adapter tests remain, but their product entry points are disabled. Mock tests do not prove live provider registration or login. Real Gorth accounts and configured clients are needed for end-to-end verification.

`pnpm test:auth:embedded` runs hidden Electron windows using temporary app data against local SSO 3000/8080. It verifies that both live login/signup forms render, checks sandbox/no bridge, denies popup creation, and tests cancellation/cleanup without credentials or creating accounts. Live form tests and mocked code exchange passed on 2026-10-05. A real user's password/OTP submission is not automated by these tests.

## Hono routes and local profile cache

HTTP boundaries are organized as `routes -> controllers -> services`.
`GET /auth/callback` validates the exact origin/path and the active transaction's
state/issuer, consumes it once, and exchanges the authorization code only in main.
No request logger prints callback URLs. `GET /health` exposes only an OK status.
`GET /user/profile` requires a per-run desktop capability and an unlocked, valid
SSO session; the subject is resolved from main state, not a supplied ID.
Foreign Host/Origin requests are rejected. Public identity caching never grants
authentication or access to another cached account.
The narrow preload API `window.electronAPI.auth.profile()` returns this public
cache (or null without a valid session); its per-run capability remains inside
the isolated preload world.

`database/schema.ts` defines `user_profiles` with `sso_user_id` as its primary
key, plus name, username, email, image, email verification, creation/sync times.
Verified login and refresh upsert only these public identity fields, preserving
creation time across email/username changes. Logout retains the profile cache
but removes authentication; no password, OTP, access/refresh/ID token is saved
in this table. Tokens remain in the existing safeStorage-encrypted vault.
The additive SQLite migration preserves existing data and runs on startup.

`services/desktop-server.ts` starts/stops Hono with Electron. Vite and Hono share
one public HTTP origin per app (Browser 5501, Launcher 5502). In dev there is an
internal OS IPC endpoint, not another HTTP port; main alone owns database/vault
access. Packaged Hono binds loopback and serves only built renderer assets.
An occupied public port fails startup rather than silently changing the callback.
Filesystem, process and SQLite APIs still use Electron's Node runtime; Hono
replaces HTTP request handling, not those privileged platform capabilities.

Verification:

- `pnpm test:auth`: signed mock OIDC/PKCE/HTTP callback, vault/IPC and native view guards.
- `pnpm test:server`: additive cache writes, identity-key updates, existing-data preservation, route access guards and callback replay.
- `pnpm test:server:native`: temporary-profile Electron smoke test of packaged assets/API, sandboxed profile access, logged-out cache behavior and same-port Vite/Hono routing.
- `pnpm test:auth:embedded`: live local SSO forms, sandbox, no popups and cancellation.

Actual account credentials, OTP mail delivery and a completed real-user SSO login
remain manual verification; these tests do not create a central SSO user.

## Auth tab and completion

Launcher opens the sandboxed SSO webview within the existing window, with a read-only address bar and return/reload controls. No popup or external browser is created.

Normal login does not send `prompt=login`: a valid SSO session can resume
authorization instead of looping between the auto-resuming login form and
forced authorization. Registration still sends `prompt=create`.

`gorth://auth` is an internal completion page, not the registered OAuth callback.
The exact HTTP callback on the app port stays unchanged. A successful screen is
marked only after token validation, profile synchronization and encrypted vault
storage; receiving an authorization code alone is not success. Native view URLs
sent to the UI exclude all query parameters, so codes/state do not enter tab
persistence. Cancellation and failed validation never set the completion marker.

After verified completion, the auth webview displays `gorth://auth` for 500 ms,
then closes and opens the account/profile page (`gorth://settings/profile`,
the renderer's existing `accounts` page). Back cancels an active transaction
and opens this same page. The auth addressbar is h-14, input/buttons h-9, and
back is icon-only with an accessible label.

Renderer regression: run `pnpm exec vite build`, then `pnpm test:auth:ui`.
The test uses a credential-free Electron renderer fixture to check bar/input
dimensions, back navigation, successful automatic return, failure staying put,
and no popup.
