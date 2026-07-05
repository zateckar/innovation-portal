# API Tokens Specification

## Purpose
Provides per-user personal access tokens so external tooling (CI, terminals, AI agents) can call the portal for long-running operations such as deploys without a browser session. Tokens are bearer credentials: the raw value is shown exactly once at creation, only a SHA-256 hash and a short display preview are persisted, and a valid token authenticates a request by resolving to the owning user in `locals.user`.

## Requirements

### Requirement: Token creation with one-time raw reveal
The system SHALL let an authenticated user create a named token via `POST /api/account/tokens`. The raw token SHALL be generated with the `ircap_` prefix followed by 256 bits of base64url-encoded entropy, returned to the caller exactly once. The system SHALL persist only the SHA-256 hash (hex), an 8-character preview, the name (trimmed, capped at 120 chars), the scopes JSON, and an expiry; it SHALL NOT store the raw token. A name is required.

#### Scenario: Create a token
- GIVEN an authenticated user
- WHEN they POST a non-empty `name` (optionally `ttlDays` and `scopes`)
- THEN the system stores a new `api_tokens` row with the SHA-256 hash and an 8-char preview, and returns the raw token, id, preview, scopes, `expiresAt`, and `createdAt` in the response body once
- AND the creation is recorded in the audit log as `api_token.create`

#### Scenario: Missing name rejected
- GIVEN an authenticated user
- WHEN they POST with an empty or whitespace-only name
- THEN the system returns a 400 error and no token is created

#### Scenario: Unauthenticated create rejected
- GIVEN a request with no authenticated user
- WHEN it POSTs to `/api/account/tokens`
- THEN the system returns 401 Unauthorized

### Requirement: Token expiry policy
The system SHALL apply an expiry to every token. The TTL SHALL default to 365 days, SHALL be clamped to a minimum of 1 day, and SHALL be capped at 5 years (1825 days). A token whose `expiresAt` is in the past SHALL be treated as invalid for authentication, with no separate "expired" state stored.

#### Scenario: Default lifetime
- GIVEN a create request without `ttlDays`
- WHEN the token is created
- THEN `expiresAt` is set 365 days in the future

#### Scenario: TTL clamping
- GIVEN a create request with `ttlDays` above 1825 or below 1
- WHEN the token is created
- THEN the effective lifetime is clamped to the 1..1825 day range

### Requirement: Token scopes
The system SHALL store a scopes list on each token as a JSON array, defaulting to `['deploy']` when none are supplied. Scopes SHALL be surfaced on listing and creation. The system does not currently enforce scopes at authentication time; the field exists for future scoped-token behavior.

#### Scenario: Default scope
- GIVEN a create request with no `scopes`
- WHEN the token is created
- THEN its scopes are stored as `["deploy"]`

#### Scenario: Custom scopes
- GIVEN a create request with a `scopes` array of strings
- WHEN the token is created
- THEN those scopes are persisted and returned

### Requirement: Listing tokens
The system SHALL let an authenticated user list their own tokens via `GET /api/account/tokens` and on the `/account/tokens` page. Listings SHALL include name, preview, scopes, `expiresAt`, `lastUsedAt`, `createdAt`, and `revokedAt`, ordered newest-first. Listings SHALL NEVER include the raw token or its hash.

#### Scenario: List own tokens
- GIVEN an authenticated user with existing tokens
- WHEN they load `/account/tokens` or GET `/api/account/tokens`
- THEN they receive their tokens (preview only, no raw value or hash), sorted by creation time descending

#### Scenario: Status derivation in the UI
- GIVEN a listed token
- WHEN the page renders its status
- THEN it shows "Revoked" if `revokedAt` is set, "Expired" if `expiresAt` has passed, otherwise "Active"

### Requirement: Token revocation
The system SHALL let a user revoke their own token via `DELETE /api/account/tokens` with a `tokenId`, setting `revokedAt`. An admin MAY revoke another user's token by supplying `targetUserId`. Revocation SHALL only affect tokens not already revoked, and SHALL return 404 when the token does not exist, is already revoked, or is not owned by the caller (for non-admins).

#### Scenario: Revoke own token
- GIVEN an authenticated user owning an active token
- WHEN they DELETE with that `tokenId`
- THEN `revokedAt` is set, the response indicates success, and the action is audited as `api_token.revoke`

#### Scenario: Admin revokes another user's token
- GIVEN an admin user and a `targetUserId` referencing an existing user
- WHEN the admin DELETEs the token with that `targetUserId`
- THEN the token is revoked and the action is audited as `api_token.revoke_by_admin`

#### Scenario: Non-existent or already-revoked token
- GIVEN a DELETE with a `tokenId` that is unknown, already revoked, or not owned by the caller
- WHEN the request is handled
- THEN the system returns 404 "Token not found or already revoked"

### Requirement: Last-used tracking
The system SHALL record the time a token is used to authenticate a request by updating `lastUsedAt` on a successful validation. This update SHALL be best-effort (fire-and-forget) so it never blocks the request that triggered it.

#### Scenario: Bump on successful use
- GIVEN a valid, non-revoked, non-expired token
- WHEN it is used to authenticate a request
- THEN `lastUsedAt` is updated to the current time without blocking the request

### Requirement: Bearer-token request authentication
The system SHALL authenticate API requests presenting an `Authorization: Bearer <token>` header (case-insensitive). Validation SHALL reject any value not prefixed with `ircap_`, look the token up by SHA-256 hash, and reject it if unknown, revoked, or expired. On success the owning user SHALL be loaded and populated into `event.locals.user`, so bearer callers use the same downstream code path as session-cookie callers (e.g. catalog deploy).

#### Scenario: Valid bearer token authenticates
- GIVEN a request with `Authorization: Bearer ircap_...` for an active token
- WHEN the token is validated
- THEN the owning user is resolved and set as `locals.user`, and the request proceeds as that user

#### Scenario: Invalid or malformed token rejected
- GIVEN a request whose bearer value is missing the `ircap_` prefix, or whose token is unknown, revoked, or expired
- WHEN validation runs
- THEN no user is resolved and the request is treated as unauthenticated
