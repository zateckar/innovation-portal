# News Digests Specification

## Purpose
The system generates AI-curated news digests per department from the pool of
already-researched, published innovations, and lets authenticated users browse
published digests. Digests are grounded in real innovation data (no invented
content), carry a relevance score and source references, and move through a
draft/published/archived lifecycle.

## Requirements

### Requirement: Per-department digest generation
The system SHALL generate news digests for a set of target departments via
`generateAndPublishNews`. The target departments MUST be resolved from an
explicit argument, else the `newsDepartments` setting (a JSON array), else all
`DEPARTMENTS`. For each department it MUST generate `newsPerDepartment` digests
per run (default 1, floored at 1), using the configurable `newsPrompt`. Each
generated digest is inserted into the `news` table with the department as its
`category`, a unique slug, and status `published`.

#### Scenario: Generating digests for configured departments
- GIVEN at least one published or promoted innovation exists and target departments are configured
- WHEN `generateAndPublishNews` runs
- THEN for each department the AI curates a digest and a `news` row is inserted with status `published`, `publishedAt`/`createdAt`/`updatedAt` set
- AND `newsLastRunAt` in settings is updated

#### Scenario: No published innovations to draw from
- GIVEN there are no innovations with status `published` or `promoted`
- WHEN `generateAndPublishNews` runs
- THEN no digests are created, the function returns 0, and `newsLastRunAt` is still updated

### Requirement: Grounding digests in real innovations
The system SHALL build each digest only from real, already-researched
innovations. `fetchPublishedInnovationsForDigest` MUST select up to 200
innovations with status `published` or `promoted`, extract a source URL from each
innovation's `researchData.sources` (falling back to `documentationUrl` or
`githubUrl`), and MUST exclude any innovation with no resolvable source URL. The
candidate pool passed to the AI MUST be pre-sorted by category affinity to the
target department and capped at 50 items.

#### Scenario: Innovation without a source URL is excluded
- GIVEN a published innovation whose researchData has no sources and no documentation or github URL
- WHEN the digest input pool is built
- THEN that innovation is omitted from the pool passed to the AI

#### Scenario: Department affinity ordering
- GIVEN the target department maps to preferred categories in the affinity table
- WHEN the pool is assembled
- THEN innovations in preferred categories are ordered ahead of the rest before the list is truncated to 50

### Requirement: Skipping empty digests
The system SHALL NOT persist a digest when the AI finds nothing relevant. When
the AI result has a `relevanceScore` of 0 OR an empty `sources` array, the system
MUST skip creating that digest and stop generating further digests for that
department in the current run.

#### Scenario: AI returns no relevant material
- GIVEN the AI returns a result with relevanceScore 0 or no sources for a department
- WHEN the digest would be persisted
- THEN no `news` row is inserted and remaining runs for that department are skipped

### Requirement: News status lifecycle
The system SHALL track each digest through the `news.status` enum `draft`,
`published`, `archived` (column default `draft`). AI-generated digests are
inserted as `published`. Admins MAY publish a draft (setting `publishedAt`),
archive a digest, or delete it. `archiveOldNews` MUST archive published digests
whose `publishedAt` is older than a given number of days.

#### Scenario: Admin publishes a digest
- GIVEN an admin invokes the publish action with a news id
- WHEN the action runs
- THEN the row's status becomes `published` and `publishedAt`/`updatedAt` are set to now

#### Scenario: Auto-archiving old published news
- GIVEN published digests older than the configured day threshold
- WHEN `archiveOldNews` runs
- THEN those rows are set to status `archived` with `updatedAt` refreshed, and the archived count is returned

#### Scenario: Admin actions restricted to admins
- GIVEN a generate/publish/archive/delete action on the news admin page
- WHEN the requester is not an admin
- THEN the action returns 403 Forbidden

### Requirement: Browsing published news
The system SHALL let authenticated users browse published digests.
`getPublishedNews` MUST return only rows with status `published`, ordered by
`publishedAt` descending then `id` descending, and MUST support optional
department filtering, title/summary search, and keyset (cursor) pagination.
Unauthenticated visitors MUST be redirected to login.

#### Scenario: Listing with a department filter
- GIVEN a user requests the news list with a `department` query parameter
- WHEN the page loads
- THEN only published digests whose `category` matches that department are returned

#### Scenario: Searching by keyword
- GIVEN a search term is provided
- WHEN the list is queried
- THEN results are limited to published digests whose title or summary matches the term, with LIKE wildcards escaped

#### Scenario: Unauthenticated access
- GIVEN a visitor with no session
- WHEN they request the news list or a detail page
- THEN they are redirected to `/auth/login`

### Requirement: Viewing a digest by slug
The system SHALL serve a single digest by its unique slug via `getNewsBySlug`.
The detail loader MUST parse the stored `sources` JSON into a list of
`{ url, title? }` entries (accepting plain URL strings), and MUST redirect to the
news list when the slug does not resolve to a digest.

#### Scenario: Valid slug
- GIVEN a digest exists with the requested slug
- WHEN the detail page loads
- THEN the digest content, relevance score, and parsed source links are returned for display

#### Scenario: Unknown slug
- GIVEN no digest matches the requested slug
- WHEN the detail page loads
- THEN the user is redirected to the news index

### Requirement: Relevance scoring and source references
The system SHALL persist a `relevanceScore` and a `sources` JSON reference list
on each digest. The score comes from the AI result (nullable) and the sources are
the curated source references returned by the AI. The detail view MUST render
each source as an external link.

#### Scenario: Digest carries score and sources
- GIVEN a generated digest with an AI relevance score and one or more sources
- WHEN it is persisted
- THEN `relevanceScore` and the JSON-encoded `sources` array are stored on the `news` row

#### Scenario: Rendering source links
- GIVEN a digest with a non-empty sources list
- WHEN the detail page renders
- THEN each source is shown as an external link using its title when present, otherwise its URL
</content>
