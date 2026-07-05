# Admin Content & User Management Specification

## Purpose
Defines the administrative surface for managing people and content: restricting the entire admin area to administrators, managing user accounts and roles, reviewing the pending discovery queue, and moderating innovations, ideas, news, feed sources, and the catalog. Covers the publish / archive / delete / promote actions administrators perform on content.

## Requirements

### Requirement: Admin area restricted to administrators
The system SHALL gate the entire `/admin` area behind the `admin` role. Unauthenticated requests MUST be redirected (302) to `/auth/login`, and authenticated non-admins MUST be redirected (302) to `/`. Every admin form action MUST additionally re-check the role and reject non-admins with 403.

#### Scenario: Non-admin is bounced from the admin area
- GIVEN a logged-in user with role `user`
- WHEN they request any `/admin` route
- THEN the admin layout redirects them (302) to `/`

#### Scenario: Admin index redirects to innovations
- GIVEN an authenticated admin
- WHEN they open `/admin`
- THEN they are redirected to `/admin/innovations`

### Requirement: User account management
The system SHALL let admins list users (capped at 100, newest first), filter by `all`/`local`/`oidc`/`admins`/`users`, and search by email or name with LIKE wildcards escaped, exposing only safe columns (never `passwordHash` or `oidcSubject`). Admins SHALL be able to create local users, and creation MUST require email/password/name, reject passwords shorter than 8 characters, reject duplicate emails, and hash the password with bcrypt (cost 12).

#### Scenario: Password too short on user creation
- GIVEN an admin submits the create-user form with a 5-character password
- WHEN the action runs
- THEN it returns `fail(400)` and no user is inserted

#### Scenario: Listing never leaks credentials
- GIVEN the admin users page loads
- WHEN the user list is selected
- THEN the returned columns exclude `passwordHash` and `oidcSubject`

### Requirement: Role, password, and account lifecycle actions
The system SHALL let admins change a user's role (`user` or `admin`), reset a password (only for `local` auth-provider users, minimum 8 characters), and delete a user. Each of these mutations MUST write an audit event capturing the target and relevant before/after metadata.

#### Scenario: Role change is audited
- GIVEN an admin promotes a user to `admin`
- WHEN the `updateRole` action runs
- THEN the user's role is updated and a `user.role.change` audit event records the previous and new role

#### Scenario: Password reset blocked for OIDC users
- GIVEN a target user whose `authProvider` is `oidc`
- WHEN the admin submits a password reset
- THEN the action returns `fail(400)` without changing anything

### Requirement: Pending discovery review queue
The system SHALL present a review queue (at `/admin/innovations`, to which `/admin/pending` redirects) listing raw feed items with `status = 'pending'` and `status = 'accepted'`, plus researched innovations with `status = 'pending'`. Admins SHALL be able to accept a raw item (→ `accepted`) or reject it (→ `rejected`).

#### Scenario: Admin accepts a raw item for research
- GIVEN a raw item with status `pending`
- WHEN the admin invokes the `accept` action for its id
- THEN the item's status becomes `accepted`

#### Scenario: Admin rejects a raw item
- GIVEN a raw item with status `pending`
- WHEN the admin invokes the `reject` action
- THEN the item's status becomes `rejected`

### Requirement: Innovation moderation
The system SHALL let admins publish a pending innovation and archive innovations. Publishing MUST set `status = 'published'`, stamp `publishedAt`, and assign a department (falling back to `general` when the submitted value is not a valid department). Archiving MUST set `status = 'archived'`.

#### Scenario: Publishing assigns a valid department
- GIVEN a pending innovation and a `department` value of `qualityXYZ`
- WHEN the admin publishes it
- THEN the innovation is published with `department = 'general'` and `publishedAt` set

#### Scenario: Archiving an innovation
- GIVEN a published innovation
- WHEN the admin invokes `archiveInnovation`
- THEN its status becomes `archived`

### Requirement: Catalog management and promotion
The system SHALL let admins manage catalog items (at `/admin/innovations#catalog`, to which `/admin/catalog` redirects): archive (`status = 'archived'`, stamp `archivedAt`), restore (`status = 'active'`, clear `archivedAt`), set maintenance (`status = 'maintenance'`), and permanently delete. Admins SHALL also quick-promote a published innovation into a new catalog item; promotion MUST create the catalog item with `status = 'maintenance'` and set the source innovation's `status = 'promoted'` (stamping `promotedAt`) in a single transaction, and MUST reject an innovation already promoted.

#### Scenario: Quick-promote creates a maintenance catalog item
- GIVEN a published innovation not yet in the catalog
- WHEN the admin invokes `quickPromote`
- THEN a catalog item is created with `status = 'maintenance'` and the innovation becomes `promoted` within one transaction

#### Scenario: Duplicate promotion rejected
- GIVEN an innovation already linked to a catalog item
- WHEN the admin invokes `quickPromote`
- THEN the action returns `fail(400)` and no new item is created

### Requirement: Ideas moderation
The system SHALL let admins list ideas (via `ideasService.getAllIdeas` with department/status/batch/source filters, 100 per page) and moderate individual ideas: publish (`status = 'published'`), archive (`status = 'archived'`), and delete. Each mutation MUST bump `updatedAt` where applicable.

#### Scenario: Admin publishes an idea
- GIVEN an idea by its id
- WHEN the admin invokes the `publish` action
- THEN the idea's status becomes `published` and `updatedAt` is refreshed

#### Scenario: Admin deletes an idea
- GIVEN an idea by its id
- WHEN the admin invokes the `delete` action
- THEN the idea row is removed

### Requirement: News moderation
The system SHALL let admins list news (via `newsService.getAllNews` with department/status filters, 100 per page) and moderate items: publish (`status = 'published'`, stamp `publishedAt`), archive (`status = 'archived'`), and delete.

#### Scenario: Admin publishes a news item
- GIVEN a news item by its id
- WHEN the admin invokes `publish`
- THEN the item's status becomes `published` and `publishedAt` is set

### Requirement: Feed source management
The system SHALL let admins manage discovery sources: add a source (name, type in `rss`/`api`/`scrape`, URL, scan interval defaulting to 120 minutes) with server-side URL validation, toggle a source's `enabled` flag, and delete a source. Adding MUST reject missing required fields or an invalid URL.

#### Scenario: Adding a source with an invalid URL
- GIVEN an admin submits the add-source form with a malformed URL
- WHEN the `add` action runs
- THEN it returns `fail(400, { error: 'Invalid URL' })` and no source is inserted

#### Scenario: Toggling a source
- GIVEN an enabled source
- WHEN the admin invokes `toggle`
- THEN the source's `enabled` flag is flipped to disabled
