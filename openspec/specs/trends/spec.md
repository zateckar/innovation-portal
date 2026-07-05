# Industry Trends Specification

## Purpose
The Trends capability provides AI-generated long-term trend analyses across three category groups — automotive industry, enterprise departments, and IT focus areas. Each trend captures a maturity level, an impact score, a time horizon, key insights, chart-ready visual data, and cited sources, and moves through a draft/published/archived lifecycle. Authenticated users browse published trends grouped by category group and read rich detail pages.

## Requirements

### Requirement: Trend Content Model
The system SHALL persist trends in the `trends` table with a unique `slug`, a `category` key (e.g. `automotive-general`, `dept-rd`, `it-ai`), a `categoryGroup` of `automotive`, `department`, or `it`, an optional `department` (DEPARTMENTS enum), a `title`, a `summary`, full markdown `content`, a JSON `keyInsights` array, an optional `maturityLevel` (`emerging`/`growing`/`mature`/`declining`), an `impactScore` real between 0 and 1, an optional `timeHorizon` (`near-term`/`mid-term`/`long-term`), a JSON `visualData` blob, a JSON `sources` array, and a `status`. It SHALL also track `generatedAt`, `publishedAt`, `createdAt`, and `updatedAt`.

#### Scenario: Persisted trend fields
- GIVEN a generated trend
- WHEN it is stored
- THEN the system SHALL serialize `keyInsights`, `visualData`, and `sources` as JSON strings
- AND clamp `impactScore` into the inclusive range 0 to 1

#### Scenario: Sources normalized on read
- GIVEN a stored `sources` entry that is a bare URL string rather than an object
- WHEN the detail page loads the trend
- THEN the system SHALL normalize it to `{ url }` form

### Requirement: AI Trend Generation
The system SHALL generate trend analyses per category by invoking the AI service with the category key, label, and group, honoring an optional custom prompt and custom criteria from settings. For each successful generation the system SHALL create a new trend row with a generated slug, assign the department chosen by the AI (falling back to a category-to-department map, defaulting to `general` so no row is null), and set `status` to `published`.

#### Scenario: Generate all categories
- GIVEN no explicit category list is provided
- WHEN generation runs
- THEN the system SHALL generate a trend for every key in the TREND_CATEGORIES map

#### Scenario: Department fallback
- GIVEN the AI returns a department that is not a valid DEPARTMENTS value
- WHEN the trend is stored
- THEN the system SHALL use the legacy category-to-department mapping, defaulting to `general`

#### Scenario: Resilient generation
- GIVEN generation of one category throws an error
- WHEN the batch continues
- THEN the system SHALL log the error, skip that category, and proceed with the remaining categories

### Requirement: Publish Supersedes Prior Trend
When publishing a newly generated trend for a category, the system SHALL archive any previously `published` trend in that same `category` so that only the latest analysis per category remains live.

#### Scenario: New trend archives the old one
- GIVEN a `published` trend already exists for category `dept-rd`
- WHEN a new trend is generated and published for `dept-rd`
- THEN the system SHALL set the previous trend's status to `archived`
- AND the new trend SHALL become the `published` one

### Requirement: Trend Lifecycle Status
The system SHALL support the trend statuses `draft`, `published`, and `archived`, with a default of `draft`. Only `published` trends SHALL be visible to end users through the public browsing surfaces.

#### Scenario: Non-published hidden from users
- GIVEN trends exist with statuses `draft`, `published`, and `archived`
- WHEN a user browses `/trends`
- THEN the system SHALL return only the `published` trends

### Requirement: Public Trend Browsing
The system SHALL require authentication to browse trends and SHALL redirect unauthenticated users to `/auth/login`. The list SHALL return published trends ordered by `publishedAt` descending, filterable by `categoryGroup`, by `department`, and by a text search over title and summary, and the UI SHALL group results under the automotive, department, and it headings.

#### Scenario: Filter by category group
- GIVEN a user selects the `it` group
- WHEN the list loads
- THEN the system SHALL return only published trends whose `categoryGroup` is `it`

#### Scenario: Search trends
- GIVEN a search term
- WHEN the list loads
- THEN the system SHALL match it against trend `title` or `summary`

### Requirement: Trend Detail View
The system SHALL serve a trend detail page by `slug` that renders the trend's markdown content, key insights, sources, and category/group/department/maturity badges. When present, `visualData` SHALL drive visual widgets including an impact-score gauge, a maturity-stage indicator, key statistics, an adoption curve, impact dimensions, and a past/present/future timeline.

#### Scenario: Unknown slug
- GIVEN a slug matching no trend
- WHEN the user opens `/trends/{slug}`
- THEN the system SHALL redirect back to `/trends`

#### Scenario: Visual data rendering
- GIVEN a published trend whose `visualData` contains a `timeline` array of past/present/future entries
- WHEN the detail page renders
- THEN the system SHALL display a timeline widget marking the present entry as "Now" and future entries as "Predicted"

### Requirement: Trend Retention
The system SHALL provide `trendsService.archiveOldTrends(days)` that archives `published` trends whose `publishedAt` is older than `days`. Matching trends MUST have their `status` set to `archived` with `updatedAt` refreshed, and the method MUST return the count archived. This is the age-based counterpart to the publish-supersedes-prior archiving and is invoked by the trends-retention background job.

#### Scenario: Old published trends archived
- GIVEN published trends whose `publishedAt` is older than the configured day threshold
- WHEN `archiveOldTrends(days)` runs
- THEN those trends are set to `archived`, `updatedAt` is refreshed, and the archived count is returned

#### Scenario: Recent trends untouched
- GIVEN a published trend whose `publishedAt` is within the threshold
- WHEN `archiveOldTrends(days)` runs
- THEN that trend remains `published`
