# Observability Specification

## Purpose
The system records every privileged/admin write to a persistent audit log and
routes all server output through a structured file logger with a
runtime-configurable log level. Admins can browse the audit trail and tail the
server log from the admin UI, and a health-check endpoint reports database
connectivity. This capability covers audit writes, the audit viewer, structured
logging with level control, the logs viewer, and the health check.

## Requirements

### Requirement: Privileged writes recorded to the audit log
The system SHALL record every privileged/admin write to the `activity_log` table
(exposed in code as `auditLog`) via `audit()` / `auditAsync()`. Each row MUST
capture the acting user's id and denormalised `actorEmail`, an `action` string,
optional `targetType` and `targetId`, optional JSON `metadata`, and the request
context `ip`, `userAgent`, and `reqId`. Denormalising the actor email means the
trail survives a user deletion. Recorded actions MUST include at least
`user.create`, `user.role.change`, `user.delete`, `user.password.reset`,
`settings.update`, `idea.force_publish`, `api_token.create`, `deployment.create`,
and `deployment.delete`.

#### Scenario: Admin role change is audited
- GIVEN an admin changes another user's role
- WHEN the action succeeds
- THEN an `activity_log` row is written with action `user.role.change`, the actor's id and email, the target user id, and request ip/userAgent/reqId

#### Scenario: Actor email survives user deletion
- GIVEN an audit row whose acting user is later deleted
- WHEN the user row is removed (user_id set null)
- THEN the row's denormalised `actorEmail` still identifies who performed the action

### Requirement: Audit writes are non-blocking and fault-tolerant
The system SHALL treat audit writes as fire-and-forget so a failed write never
fails the user action. `auditAsync()` MUST run the insert on its own promise and
swallow rejections, and `audit()` MUST catch insert errors, emit a `log.warn`,
and return null rather than throwing. IP detection MUST prefer
`getClientAddress()` and fall back to the first hop of `x-forwarded-for` (then
`x-real-ip`); the email, ip, user agent, and reqId MUST be length-capped before
storage.

#### Scenario: Audit write failure does not fail the action
- GIVEN the audit insert throws (e.g. database error)
- WHEN `audit()` handles it
- THEN it logs a warning, returns null, and the originating user action still reports success

#### Scenario: Client IP resolved behind a proxy
- GIVEN a request carrying `x-forwarded-for` with multiple hops and no direct client address
- WHEN the audit row is built
- THEN the first (client) hop is stored as the `ip`, truncated to the maximum length

### Requirement: Admin audit viewer
The system SHALL provide an admin-only audit viewer at `/admin/audit` that loads
the most recent rows (capped at 200) ordered by `createdAt` descending. The
loader MUST reject non-admins with 403, MUST support filtering by actor (matched
against `actorEmail` or `userId`), by `action`, and by exact `targetType`, and
MUST parse each row's JSON `metadata` for display.

#### Scenario: Non-admin blocked from audit viewer
- GIVEN a non-admin user requests `/admin/audit`
- WHEN the loader runs
- THEN it throws 403 "Admins only"

#### Scenario: Filtering by actor and action
- GIVEN an admin applies an actor substring and an action filter
- WHEN the loader queries the audit log
- THEN only matching rows (up to 200, newest first) are returned with parsed metadata

### Requirement: Structured server logging to file
The system SHALL write all server output to a rotating log file. `patchConsole()`
MUST be called once at startup so `console.log/info/warn/error/debug` are also
written to the log file at levels INFO/INFO/WARN/ERROR/DEBUG respectively. The
log path MUST default to `data/logs/server.log` (overridable by the `LOG_FILE`
env var), each line MUST be prefixed with an ISO timestamp and `[LEVEL]`, and the
file MUST rotate daily keeping `LOG_ROTATION_KEEP_DAYS` (default 7) rotated
files. A structured `log.{debug,info,warn,error}` helper MUST attach the
per-request `reqId` (from AsyncLocalStorage) and optional JSON fields.

#### Scenario: Console output persisted to the log file
- GIVEN the console has been patched at startup
- WHEN code calls `console.error(...)`
- THEN the message is written to the log file as an `[ERROR]` line with an ISO timestamp

#### Scenario: Daily rotation with retention
- GIVEN the current date differs from the last-written log date
- WHEN the next line is written
- THEN the existing file is rotated to a dated name and rotated files beyond the retention count are deleted

### Requirement: Runtime-configurable log level
The system SHALL support a runtime log level of DEBUG, INFO, WARN, or ERROR.
Messages below the current minimum level MUST be suppressed. The initial level
MUST come from the `LOG_LEVEL` env var (falling back to INFO for an invalid
value) and MUST be overridden at startup by `settings.logLevel` when present.
Saving settings MUST persist a validated `logLevel` and call `setLogLevel()` so
the change takes effect immediately without a restart.

#### Scenario: Level loaded from settings at startup
- GIVEN `settings.logLevel` is `WARN`
- WHEN startup initialization loads it
- THEN `setLogLevel('WARN')` is applied and INFO/DEBUG lines are suppressed

#### Scenario: Level changed from the admin UI
- GIVEN an admin saves the settings form with a new log level
- WHEN the settings action runs
- THEN the level is persisted and `setLogLevel()` updates the active level immediately

### Requirement: Admin logs viewer
The system SHALL provide an admin logs viewer at `/admin/logs` that reads only
the tail of the current log file (up to 512 KB), dropping any partial first line.
It MUST return the last N lines (default 500, max 5000) newest-first, MUST
support a level filter of `all`/`debug`/`info`/`warn`/`error` (validated against a
whitelist, filtering by the `[LEVEL]` marker), MUST report the active log level
and the configured (non-absolute) log file path, and MUST list available rotated
log files for navigation.

#### Scenario: Tailing the log file
- GIVEN a large server log file exists
- WHEN the logs page loads with default parameters
- THEN only the last portion of the file is read and the last 500 lines are returned newest-first

#### Scenario: Filtering by level
- GIVEN the viewer is requested with `level=error`
- WHEN the loader filters lines
- THEN only lines containing `[ERROR]` are returned

### Requirement: Health check endpoint
The system SHALL expose `GET /api/health` that verifies database connectivity by
executing `SELECT 1`. It MUST return `{ status: 'healthy', database: 'connected' }`
with 200 on success and `{ status: 'unhealthy', database: 'disconnected' }` with
503 on failure. Build metadata (git sha, branch, dirty flag) MUST be included
only for authenticated admin callers, so unauthenticated liveness probes receive
just the status.

#### Scenario: Healthy database probe
- GIVEN the database is reachable
- WHEN an unauthenticated client calls `/api/health`
- THEN it returns 200 with status `healthy` and no build metadata

#### Scenario: Admin sees build metadata
- GIVEN an authenticated admin calls `/api/health`
- WHEN the response is built
- THEN the body additionally includes the build info (sha/branch/dirty)
