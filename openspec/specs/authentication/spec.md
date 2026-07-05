# Authentication Specification

## Purpose
Provides identity and access control for the Innovation Incubator portal. Users authenticate either with a local email + password account or via an external OIDC identity provider (SSO). Successful authentication issues a server-side session tracked by an opaque cookie, and every request is resolved to a `locals.user` (role `user` or `admin`) used to gate pages, admin routes, and workspace proxying.

## Requirements

### Requirement: Local user registration
The system SHALL allow anonymous visitors to self-register a local account with email, name, and password. Passwords MUST be at least 8 characters, MUST match a confirmation field, and MUST be stored only as a bcrypt hash (cost 12); email MUST be unique (stored lowercased). On success the system SHALL create a session and set the `session` cookie. Already-authenticated visitors SHALL be redirected away from the registration page.

#### Scenario: Successful registration
- GIVEN an anonymous visitor on `/auth/register`
- WHEN they submit a unique email, a name, and a password of at least 8 characters that matches the confirmation
- THEN a user record is created with `authProvider = 'local'` and a bcrypt password hash
- AND a session is created and the `session` cookie is set (httpOnly, sameSite=lax, 30-day maxAge)
- AND the visitor is redirected to `/`

#### Scenario: Validation failures
- GIVEN a registration submission
- WHEN a required field is missing, the password is shorter than 8 characters, the passwords do not match, or an account with the email already exists
- THEN the system returns a 400 failure with an explanatory error message and does not create a user

#### Scenario: Already logged in
- GIVEN a request with a valid session
- WHEN the user loads `/auth/register`
- THEN they are redirected to `/`

### Requirement: Local email + password login
The system SHALL authenticate local users by verifying the submitted password against the stored bcrypt hash for the lowercased email. On success it SHALL update `lastLoginAt`, create a session, and set the `session` cookie. Invalid credentials SHALL return a 401 failure without revealing whether the email exists.

#### Scenario: Valid credentials
- GIVEN a registered local user
- WHEN they submit the correct email and password on `/auth/login`
- THEN `lastLoginAt` is updated, a session is created, the `session` cookie is set, and they are redirected to `/`

#### Scenario: Invalid credentials
- GIVEN a login submission
- WHEN the email is unknown, the account has no password hash, or the password is incorrect
- THEN the system returns a 401 failure with "Invalid email or password" and no session is created

### Requirement: OIDC single sign-on login
The system SHALL support login via an external OIDC provider using the Authorization Code flow with PKCE (S256) and scopes `openid profile email`, when OIDC is configured (issuer and client ID present, from DB settings or environment; client secret optional for public clients). The `/auth/oidc` endpoint SHALL begin the flow by storing `state` and `code_verifier` in short-lived cookies and redirecting to the provider's authorization endpoint.

#### Scenario: Starting the SSO flow
- GIVEN OIDC is configured
- WHEN a visitor navigates to `/auth/oidc`
- THEN the system generates state and a PKCE code verifier, stores them in `oidc_state` and `oidc_code_verifier` cookies (httpOnly, secure, sameSite=lax, 10-minute maxAge), and redirects to the provider authorization URL

#### Scenario: SSO not configured
- GIVEN OIDC is not configured
- WHEN a visitor navigates to `/auth/oidc` (or the callback)
- THEN they are redirected to `/auth/login?error=oidc_not_configured`

### Requirement: OIDC callback and account linking
The `/auth/callback` endpoint SHALL validate the returned `state` against the stored cookie, exchange the authorization code (with the stored code verifier) for tokens, and fetch the userinfo. It SHALL locate an existing user by OIDC subject, else link by matching email, else create a new user with `authProvider = 'oidc'`. The provider's access token, refresh token, and id token SHALL be stored on the session. The endpoint SHALL set the `session` cookie and return a same-site HTML landing page that navigates client-side (rather than a direct 302) so the SameSite=Lax cookie is sent.

#### Scenario: State mismatch
- GIVEN a callback request
- WHEN the `state` parameter is missing or does not match the stored `oidc_state` cookie
- THEN the system redirects to `/auth/login?error=invalid_state` and no session is created

#### Scenario: New SSO user
- GIVEN a valid callback with no existing user for the OIDC subject or email
- WHEN the code is exchanged and userinfo retrieved
- THEN a new user is created with `authProvider = 'oidc'` and `oidcSubject` set, a session is created storing the OIDC tokens, and the response navigates the browser to `/?welcome=true`

#### Scenario: Linking an existing email
- GIVEN a userinfo email that matches an existing account without an OIDC subject
- WHEN the callback completes
- THEN the existing account's `oidcSubject` is set (and avatar backfilled if absent), a session is created, and the browser navigates to `/`

### Requirement: Cookie-based sliding sessions
The system SHALL identify authenticated requests by validating the opaque `session` cookie against the sessions table on every request. Sessions SHALL have a 30-day absolute expiry, SHALL be renewed (expiry extended, `lastActiveAt` bumped) at most once per 10 minutes per session, and SHALL be treated as expired if idle beyond 7 days. Invalid or expired sessions SHALL be cleared from the cookie and not populate `locals.user`.

#### Scenario: Valid session resolves the user
- GIVEN a request carrying a valid, unexpired `session` cookie
- WHEN the request is handled
- THEN `locals.user` is populated with the user's id, email, name, avatar, role, and department, and the session expiry is renewed if the throttle window has elapsed

#### Scenario: Expired or invalid session
- GIVEN a request whose `session` cookie is unknown or past its expiry
- WHEN the session is validated
- THEN the expired session row is deleted, the `session` cookie is cleared, and `locals.user` remains unset

#### Scenario: Idle timeout on renewal
- GIVEN a session whose `lastActiveAt` is older than 7 days
- WHEN renewal is attempted
- THEN the session is deleted instead of being extended

### Requirement: Logout with OIDC RP-initiated logout
The system SHALL support logout via GET or POST to `/auth/logout`. It SHALL delete the server-side session and clear the `session` cookie. When OIDC is configured and the provider exposes an `end_session_endpoint`, it SHALL redirect to that endpoint with `post_logout_redirect_uri` and, when available, `id_token_hint` set to the id token captured before session deletion; otherwise it SHALL redirect to `/auth/login`.

#### Scenario: Local logout
- GIVEN a logged-in user without OIDC configured
- WHEN they log out
- THEN their session is deleted, the cookie is cleared, and they are redirected to `/auth/login`

#### Scenario: OIDC RP-initiated logout
- GIVEN a logged-in OIDC user with a stored id token and a provider that exposes `end_session_endpoint`
- WHEN they log out
- THEN the session is deleted and the user is redirected to the provider's end-session endpoint with `post_logout_redirect_uri` pointing at `/auth/login` and `id_token_hint` set to the stored id token
- AND if the end-session redirect cannot be built, the system falls back to redirecting to `/auth/login`

### Requirement: Role-based admin route gating
The system SHALL assign each user a role of `user` (default) or `admin`. Access to `/admin` and its sub-routes SHALL require an authenticated user whose role is `admin`; unauthenticated visitors SHALL be redirected to `/auth/login` and non-admin users SHALL be redirected to `/`. An initial admin MAY be provisioned at startup from `INIT_ADMIN_EMAIL` / `INIT_ADMIN_PASSWORD` only when no admin already exists.

#### Scenario: Admin access granted
- GIVEN an authenticated user with role `admin`
- WHEN they load any `/admin` route
- THEN the admin layout loads and exposes deploy build metadata to the sidebar

#### Scenario: Non-admin blocked
- GIVEN an authenticated user with role `user`
- WHEN they load an `/admin` route
- THEN they are redirected to `/`

#### Scenario: Anonymous blocked
- GIVEN a request with no valid session
- WHEN it targets an `/admin` route
- THEN it is redirected to `/auth/login`

#### Scenario: Bootstrap admin
- GIVEN `INIT_ADMIN_EMAIL` and `INIT_ADMIN_PASSWORD` are set and no admin user exists
- WHEN the application starts
- THEN an admin user is created with those credentials (skipped if any admin already exists)

### Requirement: Per-user department preference
The system SHALL persist an optional department preference on each user, drawn from the fixed set of departments (`rd`, `production`, `hr`, `legal`, `finance`, `it`, `purchasing`, `quality`, `logistics`, `general`). Users SHALL be able to set or clear this preference; clearing it (empty or invalid value) means "show all". The preference SHALL be exposed on `locals.user` for dashboard filtering.

#### Scenario: Setting a department
- GIVEN an authenticated user
- WHEN they submit the `setDepartment` action with a valid department key
- THEN the user's `department` column is updated to that value and they are redirected to `/`

#### Scenario: Clearing the department
- GIVEN an authenticated user with a saved department
- WHEN they submit an empty or unrecognized department value
- THEN the stored preference is set to null (show all)
