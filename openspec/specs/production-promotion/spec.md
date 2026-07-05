# Production Promotion Specification

## Purpose
The production-promotion capability lets a user request that a built-and-deployed application be moved to production. Requesting promotion creates a Jira issue asking the team to review and promote the app, and records the issue key and URL on the idea. Once recorded, the idea is treated as being in a "Deployment Requested" state. This flow is deliberately separate from the spec-review publish flow.

## Requirements

### Requirement: Authenticated user may request promotion
The system SHALL require an authenticated user for `POST /api/ideas/{id}/deploy-to-production` and SHALL reject anonymous requests with HTTP 401. Any logged-in user MAY trigger promotion; it is not restricted to admins or the idea proposer. A missing idea SHALL return HTTP 404.

#### Scenario: Anonymous request rejected
- GIVEN a request with no authenticated session
- WHEN it POSTs to `/api/ideas/{id}/deploy-to-production`
- THEN the server responds 401 Authentication required

#### Scenario: Any logged-in user promotes
- GIVEN an authenticated user (not necessarily admin or proposer) and a deployed idea
- WHEN they request promotion
- THEN the request is authorized and proceeds

### Requirement: App must be deployed before promotion
The system SHALL allow promotion only when the idea has a `workspaceUuid` and its workspace metadata `status` is `deployed`. A request for an un-built idea SHALL return HTTP 400 "This idea has not been built yet"; a request for a built-but-not-deployed idea SHALL return HTTP 400 requiring deployment first.

#### Scenario: Not yet built
- GIVEN an idea with no `workspaceUuid`
- WHEN promotion is requested
- THEN the server responds 400 "This idea has not been built yet"

#### Scenario: Built but not deployed
- GIVEN an idea whose workspace metadata status is not `deployed`
- WHEN promotion is requested
- THEN the server responds 400 requiring the application to be deployed first

### Requirement: Promotion creates a Jira issue and records it on the idea
The system SHALL create a Jira Story via `jiraService.createIssue` with a `[Deploy to Production]` summary and a description including the idea title, summary, and the application URL — the local `/apps/<uuid>/v<version>/` URL for internal builds or the off-platform `deployUrl` for external builds. On success it SHALL persist `productionJiraKey` and `productionJiraUrl` on the idea and return them. If Jira is not configured or the call fails, it SHALL return HTTP 503 and record nothing.

#### Scenario: Successful promotion
- GIVEN a deployed idea and a configured Jira project
- WHEN promotion is requested
- THEN a Jira Story is created, `productionJiraKey`/`productionJiraUrl` are saved on the idea, and the key and URL are returned

#### Scenario: Jira unavailable
- GIVEN Jira is not configured or the create call fails
- WHEN promotion is requested
- THEN the server responds 503 and does not set the production Jira fields on the idea

### Requirement: Promotion is idempotent
The system SHALL treat the presence of `productionJiraKey`/`productionJiraUrl` on an idea as "Deployment Requested". A repeat promotion request SHALL NOT create a second Jira issue; it SHALL return the existing key and URL with `alreadyRequested: true`.

#### Scenario: Repeat request returns existing issue
- GIVEN an idea that already has `productionJiraKey` and `productionJiraUrl`
- WHEN promotion is requested again
- THEN the server returns the existing key/url with `alreadyRequested: true` and creates no new issue

### Requirement: Deployment Requested state in the UI
The development detail page SHALL, for a deployed app, show a "Deploy to Production" button when no production Jira issue exists, and once `productionJiraUrl` is set SHALL replace it with a "Deployment Requested" link to the Jira issue and reflect the "Deployment Requested" status label.

#### Scenario: UI reflects requested state
- GIVEN a deployed idea with `productionJiraUrl` set
- WHEN a user views its development page
- THEN the page shows a "Deployment Requested" link to Jira instead of the promote button

### Requirement: Separate from spec-publish flow
The production-promotion flow SHALL be independent of the specification review/publish flow (`approveAndPublishSpec`) and SHALL use its own `productionJiraKey`/`productionJiraUrl` fields, distinct from any spec-review or escalation Jira references (e.g. `jiraEscalationKey`).

#### Scenario: Distinct Jira reference
- GIVEN an idea that was published through the spec-review flow
- WHEN it is later promoted to production
- THEN the production request is stored in `productionJiraKey`/`productionJiraUrl`, separate from the spec-publish/escalation Jira fields
