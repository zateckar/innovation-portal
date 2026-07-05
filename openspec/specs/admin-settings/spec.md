# Admin Settings Specification

## Purpose
Defines the platform configuration capability: a single `settings` row (id = `default`) through which privileged users configure AI/LLM access, OIDC, Jira and Azure DevOps credentials, AI prompts, thresholds, tech-stack rules, log level, and the enable/interval controls for each background job. Also covers how settings are cached for read performance and invalidated on save, and that only administrators may change them.

## Requirements

### Requirement: Singleton settings row
The system SHALL persist all platform configuration in a single `settings` row identified by `id = 'default'`. The settings page load MUST ensure this row exists (via `scannerService.ensureSettings()`) before returning it.

#### Scenario: Settings row is ensured on load
- GIVEN the admin settings page is requested
- WHEN the load function runs
- THEN `ensureSettings()` returns the singleton row and it is passed to the page

#### Scenario: Load failure returns null settings
- GIVEN ensuring settings throws
- WHEN the load catch block runs
- THEN the page receives `{ settings: null }` instead of erroring

### Requirement: Admin-only configuration changes
The system SHALL restrict every settings mutation action to authenticated users whose `role` is `admin`. A missing user or non-admin role MUST be rejected with a 403 `fail`.

#### Scenario: Non-admin attempts to save settings
- GIVEN a logged-in user with role `user`
- WHEN they POST the `save` action
- THEN the action returns `fail(403, { error: 'Forbidden' })` and nothing is written

#### Scenario: Non-admin attempts to reset prompts
- GIVEN a logged-in user with role `user`
- WHEN they POST the `resetPrompts` action
- THEN the action returns a 403 failure

### Requirement: Configurable AI/LLM access
The system SHALL let admins configure the LLM API key (`llmApiKey`) and model (`llmModel`). The API key MUST be stored encrypted at rest, and `llmModel` MUST default to `models/gemini-3-flash-preview` when left blank.

#### Scenario: Saving an LLM key stores ciphertext
- GIVEN an admin enters a new LLM API key
- WHEN the settings are saved
- THEN the value is passed through `encryptSecret` before being written to `llmApiKey`

### Requirement: Configurable identity and integration credentials
The system SHALL let admins configure OIDC (`oidcEnabled`, `oidcIssuer`, `oidcClientId`, `oidcClientSecret`), Jira (`jiraUrl`, `jiraWebHostname`, `jiraApimSubscriptionKey`, `jiraMtlsCert`, `jiraMtlsKey`, `jiraJql`, `jiraProjectKey`, `jiraExtractionPrompt`), and Azure DevOps (`adoEnabled`, `adoOrgUrl`, `adoProject`, `adoRepoId`, `adoTargetBranch`, `adoPat`). The OIDC client secret MUST be encrypted; the ADO PAT MUST be updated only when a new non-empty value is supplied; `adoTargetBranch` MUST default to `main`.

#### Scenario: Empty ADO PAT preserves the existing token
- GIVEN an admin saves settings leaving the ADO PAT field blank
- WHEN the update runs
- THEN the `adoPat` column is not overwritten and the existing token is retained

#### Scenario: OIDC client secret is encrypted
- GIVEN an admin enters an OIDC client secret
- WHEN settings are saved
- THEN it is stored via `encryptSecret`

### Requirement: Configurable AI prompts
The system SHALL let admins override the prompts driving the pipeline: `filterPrompt`, `researchPrompt`, `newsPrompt`, `ideasPrompt`, `evaluationPrompt`, `realizationPrompt`, `trendsPrompt`, `trendsCriteria`, and `jiraExtractionPrompt`. A blank prompt value MUST be stored as `NULL` (falling back to the built-in default).

#### Scenario: Reset prompts to defaults
- GIVEN an admin has customised several prompts
- WHEN they invoke the `resetPrompts` action
- THEN `filterPrompt`, `researchPrompt`, `newsPrompt`, `ideasPrompt`, `evaluationPrompt`, `realizationPrompt`, `jiraExtractionPrompt`, `trendsPrompt`, and `trendsCriteria` are set to `NULL`

### Requirement: Configurable thresholds and tech-stack rules
The system SHALL let admins configure the idea vote threshold (`ideaVoteThreshold`, default 5), the auto-publish score threshold (`autoPublishThreshold`, default 7.0), and free-text tech-stack rules (`techStackRules`). `ideaVoteThreshold` MUST only be written when the submitted value parses to a valid number.

#### Scenario: Invalid vote threshold is ignored
- GIVEN the `ideaVoteThreshold` form field is empty or non-numeric
- WHEN settings are saved
- THEN the `ideaVoteThreshold` column is left unchanged

### Requirement: Configurable log level applied immediately
The system SHALL let admins set the runtime log level to one of `DEBUG`, `INFO`, `WARN`, `ERROR` (defaulting to `INFO` for invalid values) and MUST apply the new level immediately via `setLogLevel` without a restart.

#### Scenario: Admin lowers the log level
- GIVEN an admin selects `DEBUG`
- WHEN settings are saved
- THEN `logLevel` is persisted and `setLogLevel('DEBUG')` is invoked in the same request

### Requirement: Per-job enable and interval controls
The system SHALL store, per background job, an enabled flag and an interval-in-minutes value on the settings row (scan, filter, research, archive, cleanup, news, ideas, trends, jira, and auto mode), so administrators can turn each job on/off and tune its cadence.

#### Scenario: Job toggles persist on the settings row
- GIVEN the settings row exists
- WHEN it is read
- THEN it exposes enable flags (e.g. `scanEnabled`, `newsEnabled`, `ideasEnabled`, `trendsEnabled`, `jiraEnabled`) and interval fields (e.g. `scanIntervalMinutes`, `newsIntervalMinutes`, `ideasIntervalMinutes`)

### Requirement: Cached reads with selective invalidation on save
The system SHALL serve settings through a process-local cache (`getSettings`) with a 30s default TTL that returns `null` for a missing row, and MUST invalidate that cache (`bumpSettingsCache`) on save so the next read sees new values without waiting for the TTL. On save the system SHALL clear dependent caches only when the relevant values changed: the AI client cache when LLM key/model changed, the OIDC cache when OIDC settings changed, and the Jira mTLS agent cache when Jira certificate/key changed. Saves MUST stamp `settingsChangedAt` and record an audit event.

#### Scenario: Save invalidates the settings cache
- GIVEN cached settings are still within their TTL
- WHEN an admin saves new settings
- THEN `bumpSettingsCache()` is called so the subsequent read reflects the update

#### Scenario: Unrelated save does not flush the AI client
- GIVEN an admin changes only OIDC settings
- WHEN the save runs
- THEN `clearOIDCCache()` is called but `aiService.clearCache()` is not
