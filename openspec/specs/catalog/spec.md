# Incubator Catalog Specification

## Purpose
The Incubator Catalog is a browsable directory of implemented innovation tools that authenticated users can try. Each catalog item is either a shared SaaS tool (one URL for everyone) or a self-hosted tool that provisions a private per-user instance on demand via a Kubernetes deployment API. Admins manage catalog items and deployments; users browse the catalog and manage their own self-hosted instances.

## Requirements

### Requirement: Catalog Item Content Model
The system SHALL persist catalog items in the `catalog_items` table with a unique `slug`, a `name`, a `description`, a `category` (one of `ai-ml`, `devops`, `security`, `data-analytics`, `developer-tools`, `automation`, `collaboration`, `infrastructure`), a `department` (one of the DEPARTMENTS enum, default `general`), markdown `howTo` usage instructions, an access `url`, optional `iconUrl` and `screenshotUrl`, and a `status` of `active`, `maintenance`, or `archived` (default `active`). Each item MAY reference an originating `innovationId` (set null on innovation delete) and records `addedBy`, `createdAt`, `updatedAt`, and `archivedAt`.

#### Scenario: Item linked to a source innovation
- GIVEN a catalog item with a non-null `innovationId`
- WHEN a user views the item detail page
- THEN the system SHALL show a "Promoted from Innovation Radar" panel with the innovation title and its current vote count
- AND provide a link to the innovation's research page

#### Scenario: Item with no icon
- GIVEN a catalog item whose `iconUrl` is null
- WHEN the detail page renders
- THEN the system SHALL display a default gradient placeholder icon instead

### Requirement: Public Catalog Browsing
The system SHALL require an authenticated user to browse the catalog and SHALL redirect unauthenticated requests to `/auth/login`. The catalog list SHALL show only items with status `active` or `maintenance` by default (excluding `archived`), ordered by `createdAt` descending, and SHALL support filtering by `department` and a case-insensitive text search over item name and description.

#### Scenario: Default listing excludes archived items
- GIVEN catalog items exist with statuses `active`, `maintenance`, and `archived`
- WHEN a user opens `/catalog` without an `archived=true` query parameter
- THEN the system SHALL return only the `active` and `maintenance` items

#### Scenario: Search by keyword
- GIVEN the user provides a `q` search term
- WHEN the list loads
- THEN the system SHALL escape LIKE wildcards in the term and match it against item `name` or `description`

#### Scenario: Detail lookup by slug
- GIVEN a slug that matches no catalog item
- WHEN the user opens `/catalog/{slug}`
- THEN the system SHALL respond with HTTP 404

### Requirement: SaaS vs Self-Hosted Deployment Types
The system SHALL classify each catalog item by `deploymentType`: `saas` (a single shared `url` used by all users) or `self-hosted` (each user provisions their own instance). For SaaS items the detail page SHALL present a direct "Try it Now" link to the shared URL. For self-hosted items the detail page SHALL present a deployment flow instead.

#### Scenario: SaaS item action
- GIVEN a catalog item with `deploymentType = 'saas'`
- WHEN a user views the detail page
- THEN the system SHALL render a "Try it Now" link that opens the item's `url` in a new tab

#### Scenario: Self-hosted item requires corporate SSO token
- GIVEN a catalog item with `deploymentType = 'self-hosted'`
- AND the logged-in user has no OIDC access token
- WHEN the user views the detail page
- THEN the system SHALL prompt the user to log in with corporate SSO before deploying

### Requirement: Self-Hosted Deployment via Templated K8s Manifest
The system SHALL provision a self-hosted instance by resolving the item's `deploymentManifest` and `instanceUrlTemplate` against a per-deployment context and POSTing the resolved manifest (Content-Type `application/yaml`, `Authorization: Bearer <token>`) to the item's `deploymentApiUrl`. The template context SHALL expose `{{username}}` (sanitized to K8s-safe lowercase from the user's email local-part or name), `{{user_id}}`, `{{email}}`, `{{timestamp}}`, `{{random_suffix}}` (CSPRNG-generated), `{{catalog_item_name}}` (the item slug), and `{{catalog_item_id}}`. Deployment SHALL fail if the item is not self-hosted, if its deployment configuration is incomplete, or if the deployment API returns a non-OK response.

#### Scenario: Successful deployment
- GIVEN a self-hosted item with a valid manifest, `deploymentApiUrl`, and `instanceUrlTemplate`
- AND the user has no existing deployment for the item
- WHEN the user triggers deployment with a valid access token
- THEN the system SHALL POST the resolved manifest to the deployment API
- AND on success create a `user_deployments` record storing the resolved `instanceUrl`, `deployedAt`, and the JSON-serialized deployment variables
- AND return the resolved instance URL

#### Scenario: Incomplete configuration
- GIVEN a self-hosted item missing its `deploymentManifest`, `deploymentApiUrl`, or `instanceUrlTemplate`
- WHEN a deployment is attempted
- THEN the system SHALL return a failure with error "Deployment configuration is incomplete" and SHALL NOT call the deployment API

#### Scenario: Deployment API error
- GIVEN the deployment API responds with a non-OK HTTP status
- WHEN deployment is attempted
- THEN the system SHALL return failure and SHALL NOT create a deployment record

### Requirement: One Deployment Per User Per Item
The system SHALL enforce at most one deployment per user per catalog item via a unique constraint on (`userId`, `catalogItemId`). Attempting to deploy again while a deployment exists SHALL be rejected, and the UI SHALL offer to open the existing instance or replace it (undeploy then redeploy).

#### Scenario: Duplicate deployment rejected
- GIVEN the user already has a deployment for a catalog item
- WHEN the user POSTs to `/api/catalog/{id}/deploy`
- THEN the system SHALL respond HTTP 409 with error `existing_deployment` and the existing deployment's details

#### Scenario: Replace existing instance
- GIVEN the user has an existing deployment and chooses "Replace" in the redeploy dialog
- WHEN the replace action runs
- THEN the system SHALL undeploy the current instance and then deploy a fresh one

### Requirement: Undeploy a User Instance
The system SHALL allow a user to remove their own deployment. When an `undeployManifest` and `deploymentApiUrl` exist, the system SHALL resolve the manifest against the stored deployment variables and send it via HTTP DELETE to the deployment API; the local `user_deployments` record SHALL be deleted regardless of whether the API cleanup succeeds. If the catalog item no longer exists, the record SHALL simply be removed.

#### Scenario: Undeploy with cleanup manifest
- GIVEN a deployment exists for an item that has an `undeployManifest`
- WHEN the user DELETEs `/api/catalog/{id}/deploy`
- THEN the system SHALL send the resolved undeploy manifest to the deployment API
- AND delete the deployment record even if the API call fails

#### Scenario: Undeploy without prior deployment
- GIVEN the user has no deployment for the item
- WHEN the user issues a DELETE
- THEN the system SHALL respond HTTP 404 "No deployment found"

### Requirement: Deployment API Authentication
The system SHALL authenticate deployment and undeployment API calls by either a session cookie or an `Authorization: Bearer` token, with bearer taking precedence when both are present. A downstream credential (the bearer token itself, or the session user's OIDC access token) SHALL be required to call the deployment API; requests lacking one SHALL be rejected with HTTP 403. Deployment and undeployment actions SHALL be recorded to the audit log.

#### Scenario: Missing downstream credential
- GIVEN a session-authenticated user with no OIDC access token
- WHEN the user POSTs to `/api/catalog/{id}/deploy`
- THEN the system SHALL respond HTTP 403 requesting corporate SSO login

#### Scenario: Bearer-authenticated automation
- GIVEN a request carrying a valid bearer token
- WHEN it calls the deploy endpoint
- THEN the system SHALL authenticate via the bearer user and forward the bearer token as the downstream credential

### Requirement: Admin Catalog Management
The system SHALL let admins create and edit catalog items and SHALL restrict write actions to users with role `admin`. Creation SHALL validate required fields, category, status (`active`/`maintenance`), and a valid access URL, generate a unique slug, and — when linked to an innovation — mark that innovation `promoted`. Editing SHALL additionally manage `deploymentType` and, for self-hosted items, validate `deploymentApiUrl`, `deploymentManifest`, `instanceUrlTemplate`, and any `undeployManifest` (rejecting unknown `{{variable}}` tokens); setting status to `archived` SHALL stamp `archivedAt`.

#### Scenario: Non-admin blocked
- GIVEN a user whose role is not `admin`
- WHEN they submit the create or edit catalog form
- THEN the system SHALL return HTTP 403 Forbidden

#### Scenario: Self-hosted edit validation
- GIVEN an admin sets `deploymentType = 'self-hosted'`
- WHEN a required deployment field is missing or a template references an unknown variable
- THEN the system SHALL reject the submission with a validation error
- AND on success store the deployment fields and set the item `url` to the `#self-hosted` placeholder

### Requirement: Admin Deployment Oversight
The system SHALL let admins list all deployments for a catalog item and force-remove any specific deployment. Listing SHALL return each deployment's instance URL, deployed date, and associated user. Admin force-undeploy SHALL require the admin's OIDC access token and SHALL run the same undeploy flow as the owning user.

#### Scenario: List deployments for an item
- GIVEN an admin requests `/api/admin/catalog/{id}/deployments`
- WHEN deployments exist
- THEN the system SHALL return each deployment with its resolved `instanceUrl`, `deployedAt`, and the user's id, email, and name

#### Scenario: Admin force-undeploy
- GIVEN an admin with an OIDC access token DELETEs `/api/admin/deployments/{id}`
- WHEN the deployment exists
- THEN the system SHALL undeploy it on behalf of its owning user and remove the record
