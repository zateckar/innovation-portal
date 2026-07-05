# External Integrations Specification

## Purpose
The system integrates with two external enterprise systems using
admin-configured credentials stored in the singleton settings row. JIRA is used
both to ingest issues (via a JQL query) into AI-generated ideas and to escalate
work by creating Jira issues when a spec is published or an app is promoted to
production. AZURE DEVOPS is used to open pull requests containing published
specification documents. This capability describes each integration as an
external contract: its configuration, request shape, authentication, and the
connection-test endpoints. The AI extraction/realization of ingested issues is
covered by the ideas capability.

## Requirements

### Requirement: Jira credentials and connection configuration
The system SHALL store Jira configuration in the settings row: `jiraEnabled`
flag, `jiraUrl` (REST API base), `jiraWebHostname` (for `/browse/` links),
`jiraApimSubscriptionKey` (sent as the `OCP-APIM-Subscription-Key` header),
`jiraMtlsCert` and `jiraMtlsKey` (PEM client cert/key for mutual TLS), `jiraJql`,
`jiraMaxIssuesPerRun` (default 20), `jiraExtractionPrompt`, `jiraProjectKey`, and
`jiraIntervalMinutes`/`jiraLastRunAt`. Requests MUST attach the APIM header when
present and use an mTLS HTTPS agent built from the cert/key (cached and
invalidatable), with `rejectUnauthorized: false` to allow on-prem self-signed
certs and a 30-second timeout.

#### Scenario: Authenticated Jira request
- GIVEN Jira credentials with an APIM key and mTLS cert/key are configured
- WHEN the service issues a REST call
- THEN the request carries the `OCP-APIM-Subscription-Key` header and uses the mTLS agent built from the configured cert and key

#### Scenario: Jira not configured
- GIVEN `jiraUrl` is empty
- WHEN a credential-dependent operation is attempted
- THEN the service returns null / skips rather than making a request

### Requirement: Jira issue ingestion via JQL
The system SHALL ingest Jira issues into ideas when Jira is enabled. It MUST call
`GET {jiraUrl}/rest/api/latest/search` with the configured `jiraJql`,
`maxResults` equal to `jiraMaxIssuesPerRun` (default 20), and the fields
`summary,description,attachment,creator,created,updated`. Already-imported issue
keys MUST be excluded (deduplicated against `ideas.jiraIssueKey`). Each new issue
MUST be turned into an idea via the AI extraction prompt (`jiraExtractionPrompt`)
and inserted with `source` = `jira`, its `jiraIssueKey`, and a `jiraIssueUrl`
built from `jiraWebHostname` (falling back to `jiraUrl`) as `<base>/browse/<key>`.
`jiraLastRunAt` MUST be updated after a run.

#### Scenario: New issues imported as ideas
- GIVEN Jira is enabled with a JQL and new (not-yet-imported) issues match
- WHEN the Jira pipeline runs
- THEN each new issue is extracted into an idea with `source='jira'`, `jiraIssueKey`, and a `/browse/` `jiraIssueUrl`, and `jiraLastRunAt` is updated

#### Scenario: Already-imported issue skipped
- GIVEN a matched issue whose key already exists on an idea
- WHEN issues are filtered before processing
- THEN that issue is excluded and not re-imported

### Requirement: Jira escalation for spec publish and production promotion
The system SHALL create Jira Story issues via
`POST {jiraUrl}/rest/api/latest/issue` when work is escalated, using
`jiraProjectKey` for the `project.key` and `issuetype.name` `Story`. When a spec
is approved/published, the system MUST create an issue titled `[Idea Spec]
<title>` (description referencing the ADO PR when one was created) and store its
key on the idea as `jiraEscalationKey`. When a built app is promoted, the
`POST /api/ideas/{id}/deploy-to-production` endpoint MUST create an issue titled
`[Deploy to Production] <title>` and store `productionJiraKey`/`productionJiraUrl`
on the idea. Both flows MUST be no-ops (return null) when Jira or the project key
is not configured; production promotion MUST return 503 in that case.

#### Scenario: Spec publish creates a Jira escalation issue
- GIVEN Jira is configured with a project key and a spec is published
- WHEN the publish flow runs
- THEN a `Story` issue titled `[Idea Spec] <title>` is created and its key is stored as `jiraEscalationKey`

#### Scenario: Production promotion is idempotent
- GIVEN an idea already has `productionJiraKey` and `productionJiraUrl`
- WHEN `POST /api/ideas/{id}/deploy-to-production` is called again
- THEN it returns the existing issue with `alreadyRequested: true` and does not create a new issue

#### Scenario: Promotion requires a deployed build
- GIVEN an idea whose workspace is not in `deployed` status
- WHEN production promotion is requested
- THEN it returns a 400 error and no Jira issue is created

### Requirement: Jira connection test endpoint
The system SHALL expose `POST /api/admin/jira/test` for admins to verify Jira
connectivity. It MUST reject non-admins with 403, MUST use credentials from the
request body when provided (otherwise fall back to stored settings), and MUST
probe `GET {jiraUrl}/rest/api/latest/serverInfo`, returning a `{ success,
message }` result that names the server/version on success or the error on
failure.

#### Scenario: Successful Jira connection test
- GIVEN an admin submits valid Jira credentials
- WHEN the test endpoint calls `serverInfo`
- THEN it returns `success: true` with the server name and version

#### Scenario: Non-admin blocked
- GIVEN a non-admin caller
- WHEN they POST to `/api/admin/jira/test`
- THEN it returns 403 Forbidden

### Requirement: Azure DevOps credentials and configuration
The system SHALL store Azure DevOps configuration in the settings row:
`adoEnabled` flag, `adoOrgUrl` (e.g. `https://dev.azure.com/<org>`), `adoProject`,
`adoRepoId`, `adoPat` (personal access token), and `adoTargetBranch` (default
`main`). Requests MUST authenticate with HTTP Basic using a base64 of `:<pat>`
and use API version 7.1. Credentials MUST resolve to null (integration disabled)
unless `adoEnabled` is true and org url, project, repo id, and PAT are all
present.

#### Scenario: Credentials resolved when fully configured
- GIVEN `adoEnabled` is true and org/project/repo/PAT are all set
- WHEN credentials are requested
- THEN they resolve with the configured values and `adoTargetBranch` (defaulting to `main`)

#### Scenario: Disabled or incomplete config
- GIVEN `adoEnabled` is false or any of org/project/repo/PAT is missing
- WHEN credentials are requested
- THEN they resolve to null and ADO operations are skipped

### Requirement: Azure DevOps pull request creation for published specs
The system SHALL open an Azure DevOps pull request containing a published spec
document. `createPullRequest` MUST read the tip of `adoTargetBranch` via the refs
API, push a branch `spec/<ideaSlug>` committing the spec to `specs/<ideaSlug>.md`
(adding the file, or editing it if the branch already existed), then create a
pull request from that branch back to the target branch titled `Spec: <title>`.
The resulting web PR URL MUST be stored on the idea as `adoPrUrl`. Failure to
create the PR MUST be non-fatal to spec publishing (logged, continuing without
`adoPrUrl`).

#### Scenario: PR opened for a published spec
- GIVEN ADO is configured and a spec is published
- WHEN `createPullRequest` runs
- THEN a `spec/<slug>` branch with `specs/<slug>.md` is pushed, a PR to the target branch is opened, and its URL is stored as `adoPrUrl`

#### Scenario: PR creation failure does not block publish
- GIVEN ADO push or PR creation fails
- WHEN the publish flow handles it
- THEN the error is logged and publishing continues with a null `adoPrUrl`

### Requirement: Azure DevOps connection test endpoint
The system SHALL expose `POST /api/admin/ado/test` for admins to verify ADO
connectivity. It MUST reject non-admins with 403, MUST use credentials from the
request body when the required fields are supplied (otherwise fall back to stored
settings), and MUST probe the repository via
`GET {orgUrl}/{project}/_apis/git/repositories/{repoId}?api-version=7.1`,
returning `{ ok, message }`.

#### Scenario: Successful ADO connection test
- GIVEN an admin submits valid ADO credentials
- WHEN the endpoint queries the repository
- THEN it returns `ok: true` with a success message

#### Scenario: Failed ADO connection test
- GIVEN credentials that the ADO API rejects
- WHEN the endpoint queries the repository
- THEN it returns `ok: false` with the returned status and truncated response body
