# Autonomous Build Specification

## Purpose
The autonomous-build capability turns an idea whose specification is complete into a working, runnable application without human coding. A build claims a workspace for the idea, then drives it through a multi-phase pipeline — either an INTERNAL local builder subprocess or the EXTERNAL "Mamina" cloud build service. Built versions are served to authenticated users by starting a per-version SSR child process and reverse-proxying to it. Supporting endpoints expose logs, status, incremental progress, cancellation, rebuild, and clarification corrections, and a watchdog reconciles builds that stall or die.

## Requirements

### Requirement: Trigger a build from a completed spec
The system SHALL start an autonomous build only when the idea's `specStatus` is `completed` and it has a `specDocument`; otherwise it SHALL reject with HTTP 400. On start it SHALL atomically claim a freshly generated workspace UUID onto the idea's `workspaceUuid` column (`UPDATE ... WHERE id=? AND workspaceUuid IS NULL`), create `workspaces/<uuid>/` with `SPECIFICATION.md`, a `versions/` directory, and an initial `metadata.json`. Both the internal (`POST /api/ideas/{id}/build`) and external (`POST /api/ideas/{id}/build-external`) endpoints SHALL require an authenticated user.

#### Scenario: Build a completed idea
- GIVEN an authenticated user and an idea with `specStatus = 'completed'` and a spec document
- WHEN they POST to `/api/ideas/{id}/build`
- THEN the server generates a UUID, sets it on `ideas.workspaceUuid`, writes the workspace files with `status: 'building'`, spawns the builder, and returns `{ status: 'building', uuid }`

#### Scenario: Spec not finished
- GIVEN an idea whose `specStatus` is not `completed` or which has no `specDocument`
- WHEN a build is requested
- THEN the server responds 400 "Specification is not completed yet"

#### Scenario: Concurrent trigger race
- GIVEN two build POSTs for the same idea arriving together
- WHEN the second UPDATE claims 0 rows because `workspaceUuid` is already set
- THEN the second request re-reads the winning UUID and returns `already_building` instead of creating a duplicate workspace

#### Scenario: Recover an orphaned or failed prior build
- GIVEN an idea already linked to a workspace whose metadata is missing, in `error`, or in an active phase with a dead build PID
- WHEN a new build is requested
- THEN the server clears the stale `workspaceUuid` link and claims a fresh workspace, allowing the retry

### Requirement: Internal build pipeline phases and statuses
The internal builder (`scripts/builder.ts`, spawned via `spawnBuilder`) SHALL advance the workspace `metadata.status` through the phase vocabulary: `building` → `planning` → `reviewing` → `building` → `testing` → `deploying` → `deployed`, and SHALL set `status: 'error'` with an `error` message on failure. It SHALL run scaffolding, AI clarification, planning, implementation, testing, and a deploy-and-verify step that boots the built app and feeds runtime errors back into a fix loop before marking `deployed`.

#### Scenario: Successful pipeline reaches deployed
- GIVEN a spawned internal build
- WHEN scaffolding, planning, building, testing and deploy-verify all succeed
- THEN metadata progresses through the phase statuses and ends at `status: 'deployed'` with a served `/apps/<uuid>/v<version>/` URL

#### Scenario: Scaffold fails before AI work
- GIVEN the scaffold does not build cleanly before the AI touches code
- WHEN the builder verifies the scaffold
- THEN it sets `status: 'error'`, records `lastErrorOutput`, and aborts the build

### Requirement: Safe builder process spawning
The system SHALL spawn the builder with an argv array and `shell: false` (never `shell: true` with interpolated strings). It SHALL pipe stdout/stderr to a per-build log file under `workspaces/<uuid>/builds/`, persist the child PID and start time into `metadata.json` atomically, and on non-zero exit set `status: 'error'` with the reason and the last ~8 KB of output in `lastErrorOutput`. The builder subprocess env SHALL be an allowlist that excludes portal-only secrets such as `SESSION_SECRET`.

#### Scenario: Builder exits non-zero
- GIVEN a running builder child
- WHEN it exits with a non-zero code or is killed by a signal
- THEN the exit handler clears `buildPid`, sets `status: 'error'` with the reason, and captures the stderr tail into `lastErrorOutput`

### Requirement: External Mamina build pipeline
When `MAMINA_API_KEY` is configured, the system SHALL offer the external "Mamina" pipeline (`https://www.mamina.net/api/v1`) as an alternative to the local builder. `POST /api/ideas/{id}/build-external` SHALL create a remote run (using the idea UUID as `Idempotency-Key`), write `metadata.json` tagged `pipeline: 'external'` with `maminaRunId`, `maminaStatus`, and cost/deploy fields. `syncRunToWorkspace` SHALL poll the run and its event feed, appending narrative events to `buildLog` (deduplicated via a persisted `lastEventId` cursor), mapping the remote status to the internal vocabulary, and persisting `externalCostUsd`, off-platform `deployUrl`, and `prUrl`. If the pipeline is not configured the endpoint SHALL return HTTP 503.

#### Scenario: Start an external run
- GIVEN a completed idea and a configured Mamina key
- WHEN the user POSTs to `/api/ideas/{id}/build-external`
- THEN a remote run is created, the workspace metadata is written with `pipeline: 'external'` and the run id, and `status: 'building'` is returned

#### Scenario: External run completes with a deploy URL
- GIVEN an external run that reaches `completed`/`completed_empty`
- WHEN it is synced and carries a `deploy_url`
- THEN metadata maps to `status: 'deployed'`, records the off-platform `deployUrl`, and persists the latest `externalCostUsd`

#### Scenario: External run completes empty
- GIVEN an external run that completes but produced no deployable app
- WHEN it is synced
- THEN metadata maps to `status: 'error'` explaining no deployable app was produced

#### Scenario: Not configured
- GIVEN no `MAMINA_API_KEY`
- WHEN the external build endpoint is called
- THEN the server responds 503 "External build pipeline is not configured"

### Requirement: Build watchdog reconciles stalled and dead builds
The system SHALL run a watchdog every 2 minutes (plus once at startup) that scans workspaces. For internal builds in an active phase, if the recorded PID is dead it SHALL mark the build `error`; if a `heartbeat.json` is older than 25 minutes while the PID is alive it SHALL mark the build stuck (`error`) and kill the PID best-effort. For external (`pipeline: 'external'`) runs that are not yet terminal it SHALL call `syncRunToWorkspace` so they reach a terminal state even when no page is open.

#### Scenario: Dead internal build detected
- GIVEN a workspace in an active build phase whose recorded PID is no longer alive
- WHEN the watchdog runs
- THEN it appends a build-log entry and sets `status: 'error'`, clearing `buildPid`

#### Scenario: Stalled internal build killed
- GIVEN an active build whose `heartbeat.json` mtime is older than 25 minutes and whose PID is alive
- WHEN the watchdog runs
- THEN it marks the build stuck (`error`) and sends SIGTERM to the PID

#### Scenario: External run reconciled headlessly
- GIVEN a non-terminal external run and no open page
- WHEN the watchdog runs
- THEN it syncs the remote run into workspace metadata (persisting deploy_url/cost) until it reaches a terminal status

### Requirement: Per-version app serving via reverse proxy
The system SHALL serve each deployed version by starting a dedicated SSR child process on an OS-assigned ephemeral port and reverse-proxying `/apps/<uuid>/v<version>/*` to it. Requests SHALL require a valid session. The proxy SHALL validate the UUID format and version range, return 404 when no deployment exists, 503 when the process cannot be started (enriched with the tail of `runtime.log`), 504 on a 30s timeout, and 502 on other proxy errors. It SHALL forward `x-forwarded-host`/`x-forwarded-proto` (host pinned to a trusted value when configured) and normalize trailing slashes except for file-like and SvelteKit `__data.json` paths.

#### Scenario: Serve a deployed version
- GIVEN an authenticated user and a deployed `v<version>`
- WHEN they request `/apps/<uuid>/v<version>/<path>`
- THEN a child process is started (or reused) and the request is proxied to it, returning its response

#### Scenario: Version cannot boot
- GIVEN a deployment whose child process fails to start
- WHEN the proxy tries to get its port
- THEN it returns 503 including the last runtime-log errors as the cause

### Requirement: Forwarded, signed user identity to child apps
The proxy SHALL strip any inbound `x-user-*` spoofed headers and set trusted `x-user-id/email/name/role/department` from the authenticated session. It SHALL HMAC-SHA-256 sign the identity with a per-portal secret (`x-user-sig` + `x-user-sig-ts`) and expose that secret to child processes via `WORKSPACE_IDENTITY_SECRET` so AI-generated apps may verify it. Child processes SHALL be spawned with an allowlisted env that excludes portal secrets.

#### Scenario: Identity forwarded and signed
- GIVEN a proxied request from an authenticated user
- WHEN it is forwarded to the child app
- THEN spoofed `x-user-*` headers are removed, the real identity is set, and a valid `x-user-sig`/`x-user-sig-ts` pair is attached

### Requirement: Workspace process lifecycle management
The system SHALL cap concurrent child processes and evict the least-recently-started when at the limit, retry ephemeral ports on collision, and apply crash backoff — refusing to restart after >10 crashes and delaying restart after >3. It SHALL persist each child PID to `runtime.pid`, reap orphaned children from a previous portal run at startup, capture stdout/stderr to a rotating `runtime.log`, and expose health (running/ready/healthy/crashCount/uptime).

#### Scenario: Orphan reaping after restart
- GIVEN `runtime.pid` files left by child apps from a previous portal run
- WHEN the portal starts
- THEN it SIGTERMs each recorded PID and removes the PID files so ports are freed

#### Scenario: Crash backoff
- GIVEN a version that has crashed more than 3 times
- WHEN a request tries to start it
- THEN the manager waits an exponential backoff (capped) before restarting, and after >10 crashes refuses to start it

### Requirement: Build logs and status polling
The system SHALL expose `GET /api/apps/{uuid}/status` returning build status/error from metadata plus per-version process health, crash counts, and recent runtime-error counts; and `GET /api/apps/{uuid}/logs` returning runtime logs, extracted/classified errors, or a summary (via `mode`) for a chosen or latest version, with pagination and level filtering.

#### Scenario: Query runtime errors
- GIVEN a deployed version with runtime output
- WHEN `GET /api/apps/{uuid}/logs?mode=errors` is called
- THEN the server returns structured, deduplicated errors classified by category (crash, runtime, database, network, etc.)

### Requirement: Incremental progress feed for external builds
The system SHALL expose `GET /api/apps/{uuid}/progress?since={n}` for `pipeline: 'external'` workspaces, returning scalar status fields (status, currentPhase, error, maminaStatus, externalCostUsd, deployUrl, prUrl) plus only the `buildLog` rows at index >= `since`, and a `terminal` flag. It SHALL trigger a throttled remote sync before responding, require an authenticated user, and enforce ownership (admin or the idea's proposer). Non-external workspaces SHALL be rejected with 400.

#### Scenario: Poll external progress incrementally
- GIVEN an external build with N existing log rows the client already has
- WHEN it GETs `progress?since=N`
- THEN the server syncs the remote run and returns only new log rows plus the current status/cost/deploy fields and whether the run is terminal

### Requirement: Cancel, rebuild, and clarification corrections
The system SHALL let an authenticated owner (admin or idea proposer): cancel an in-progress external run via `POST /api/apps/{uuid}/cancel` (best-effort remote cancel, then mark local metadata `error`/`cancelled`; internal builds use reset instead); trigger a rebuild via `POST /api/apps/{uuid}/rebuild`, which refuses if a build is already running (409) and refreshes the design reference before spawning a `rebuild` builder; and read/append clarification corrections via `GET`/`PATCH /api/apps/{uuid}/clarifications`, appending user corrections under a "User Corrections" heading in the latest version's `CLARIFICATIONS.md`.

#### Scenario: Rebuild while a build is running
- GIVEN a workspace whose status is an active phase and whose build PID is alive
- WHEN an owner POSTs to `/api/apps/{uuid}/rebuild`
- THEN the server responds 409 "A build is already in progress"

#### Scenario: Cancel an external run
- GIVEN a non-terminal external build
- WHEN an owner POSTs to `/api/apps/{uuid}/cancel`
- THEN the server attempts a remote cancel and sets metadata `status: 'error'`, `maminaStatus: 'cancelled'`

#### Scenario: Append clarification corrections
- GIVEN a workspace with a `CLARIFICATIONS.md` in its latest version
- WHEN a `PATCH` supplies `corrections` text
- THEN the text is appended under a "## User Corrections" section of that file
