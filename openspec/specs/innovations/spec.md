# Innovations Specification

## Purpose
The innovations capability represents technologies that are discovered, AI-researched, and curated for internal review and adoption. Each innovation carries structured research content, three quantitative scores, adoption metadata, a department/category taxonomy, tags, and source references. Authenticated users browse published innovations; admins manage a status lifecycle that culminates in promotion to the incubator catalog.

## Requirements

### Requirement: Researched innovation record
The system SHALL persist each innovation with a unique `slug`, `title`, `tagline`, a `category` (one of `ai-ml`, `devops`, `security`, `data-analytics`, `developer-tools`, `automation`, `collaboration`, `infrastructure`), a `department` relevance value (one of `rd`, `production`, `hr`, `legal`, `finance`, `it`, `purchasing`, `quality`, `logistics`, `general`, defaulting to `general`), and a non-null `researchData` JSON blob. The `researchData` JSON MUST contain the researched content fields: `executiveSummary`, `keyBenefits`, `useCases`, `competitors`, `prosAndCons` (pros/cons), `requiredSkills`, `estimatedTimeToMVP`, and `sources`.

#### Scenario: AI research produces an innovation
- GIVEN an accepted raw feed item that has not already been researched
- WHEN the scanner runs AI research on it
- THEN a new innovation row is created with a generated slug, the researched title/tagline/category/department, and `researchData` stored as a JSON string
- AND `researchedAt` is set to the time of research

#### Scenario: Detail page parses research JSON
- GIVEN a published innovation whose `researchData` is valid JSON
- WHEN an authenticated user opens its detail page by slug
- THEN the executive summary, key benefits, use cases, pros/cons, competitors, and sources are rendered from the parsed research data
- AND if the JSON fails to parse, an empty research structure is used instead of erroring

### Requirement: Innovation scores
The system SHALL store three real-valued scores per innovation — `relevanceScore`, `innovationScore`, and `actionabilityScore` — each of which MAY be null. The average of the three scores SHALL be used to decide auto-publishing.

#### Scenario: Scores displayed on detail
- GIVEN an innovation with non-null scores
- WHEN a user views its detail page
- THEN a score bar is shown for each of Relevance, Innovation, and Actionability
- AND any score that is null is omitted

#### Scenario: Average score gates auto-publish
- GIVEN research yields relevance, innovation, and actionability scores
- WHEN the average of the three is greater than or equal to the configured auto-publish threshold and auto-publish is enabled
- THEN the innovation is created with status `published` and `publishedAt` set
- AND otherwise it is created with status `pending` and no `publishedAt`

### Requirement: Adoption metadata
The system SHALL record adoption metadata flags and references on each innovation: `isOpenSource`, `isSelfHosted`, and `hasAiComponent` (booleans defaulting to false), `maturityLevel` (one of `experimental`, `beta`, `stable`, `mature`), `license`, `githubUrl`, `documentationUrl`, and `heroImageUrl`.

#### Scenario: Metadata badges and actions
- GIVEN an innovation flagged AI-powered, open source, or self-hosted, and/or carrying a maturity level
- WHEN a user views its detail page
- THEN the corresponding badges are displayed
- AND when a GitHub URL or documentation URL is present, external action links are shown

### Requirement: Status lifecycle
The system SHALL manage each innovation through the status enum `pending`, `published`, `promoted`, `archived` (default `pending`). Only `published` and `promoted` innovations SHALL be publicly visible; non-public statuses are visible only to admins.

#### Scenario: Admin promotes to catalog
- GIVEN an admin viewing a published innovation not yet in the catalog
- WHEN the admin submits the promote action with a deployment type of `saas` or `self-hosted`
- THEN a new catalog item linked to the innovation is created and the innovation status is set to `promoted` with `promotedAt` set, within a single transaction
- AND the admin is redirected to the catalog item edit page

#### Scenario: Admin archives an innovation
- GIVEN an admin viewing an innovation
- WHEN the admin submits the archive action
- THEN the innovation status is set to `archived` and it no longer appears in the public list

#### Scenario: Non-admin cannot see non-public innovation
- GIVEN an innovation whose status is `pending` or `archived`
- WHEN a non-admin user requests its detail page by slug
- THEN a 404 error is returned

### Requirement: Tags and source references
The system SHALL support many-to-many tagging of innovations via the `tags` and `innovation_tags` tables, and SHALL record external references in `innovation_sources` with a `url`, optional `title`, and a `sourceType` of `original`, `related`, or `documentation`.

#### Scenario: Tags shown on detail
- GIVEN an innovation with associated tags
- WHEN a user views its detail page
- THEN each tag name is displayed as a chip

### Requirement: Public browsing with filters
The system SHALL provide a listing of `published` innovations to authenticated users, filterable by department and free-text search over title and tagline, and sortable by vote count (default), most recent, or relevance. The list SHALL be capped at 50 results and SHALL expose per-department published counts for the filter bar.

#### Scenario: Filtered and sorted list
- GIVEN published innovations across multiple departments
- WHEN a user requests the list with a `department` filter and `sort=votes`
- THEN only published innovations matching that department (with `general` also matching null departments) are returned, ordered by descending vote count
- AND each returned item includes its vote count and whether the current user has voted

#### Scenario: Unauthenticated access redirected
- GIVEN a visitor who is not logged in
- WHEN they request the innovations list or a detail page
- THEN they are redirected to the login page
