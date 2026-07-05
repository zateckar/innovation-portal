# Ideas Specification

## Purpose
The ideas capability produces and curates concrete innovation proposals for the company. Ideas originate from three sources — AI batch generation, imported Jira issues, and user proposals via the `/propose` form — and each idea carries a problem, a proposed solution, an owning department, an AI evaluation score, and optionally a self-contained proof-of-concept ("realization"). Ideas move through a status lifecycle from `draft` to `published`, after which authenticated users can browse and open them. The subsequent community-vote-gated refinement, spec, build, and deploy stages are covered by the separate `idea-development` capability.

## Requirements

### Requirement: Idea record and source taxonomy
The system SHALL store every idea in the `ideas` table with a unique `slug`, a `title`, `summary`, `problem`, `solution` (Markdown), and a `department` drawn from the shared `DEPARTMENTS` enum (`rd`, `production`, `hr`, `legal`, `finance`, `it`, `purchasing`, `quality`, `logistics`, `general`). Each idea SHALL record a `source` of `ai`, `jira`, or `user` (default `ai`) and a `status` of `draft`, `evaluated`, `realized`, `published`, or `archived` (default `draft`).

#### Scenario: Idea carries a source and department
- GIVEN an idea created by any of the three intake paths
- WHEN it is persisted
- THEN it has a `source` of `ai`, `jira`, or `user`
- AND a `department` from the `DEPARTMENTS` enum
- AND an initial `status` reflecting how far it has been processed

### Requirement: AI batch generation
The system SHALL generate ideas in batches of a configurable size (`ideasPerBatch`, default 5) for a given department using the AI service and the admin `ideasPrompt`. Each generated idea SHALL be inserted with `status` = `draft`, a shared `batchId` grouping the run, and `aiPromptUsed` capturing the custom prompt.

#### Scenario: Generating a department batch
- GIVEN a department and a requested count
- WHEN `generateIdeaBatch` runs
- THEN the AI produces that many idea drafts
- AND all drafts share one `batchId` and are stored with `status` = `draft`

### Requirement: AI evaluation and within-batch ranking
The system SHALL evaluate each idea in a batch with the AI service (using the admin `evaluationPrompt`), scoring five dimensions in `evaluationDetails` — impact, feasibility, costEffectiveness, innovation, urgency — and SHALL set `evaluationScore` to their average rounded to two decimals. After scoring, the system SHALL sort the batch by descending score and write each idea's `rank` (1 = best). Unless a caller passes `preserveStatus`, evaluated ideas SHALL move to `status` = `evaluated`. Individual evaluation calls SHALL be retried on failure and a failed idea SHALL not abort the batch.

#### Scenario: Batch is scored and ranked
- GIVEN a batch of draft ideas
- WHEN `evaluateBatch` runs
- THEN each idea receives an `evaluationScore` (average of the five sub-scores) and `evaluationDetails`
- AND the ideas are assigned `rank` values 1..N by descending score
- AND (absent `preserveStatus`) their `status` becomes `evaluated`

### Requirement: Realization into a self-contained proof of concept
The system SHALL realize an idea by asking the AI service (using the admin `realizationPrompt`) to produce a self-contained interactive PoC and store it on the idea: `realizationHtml` (dependency-free HTML+JS), `realizationDiagram` (Mermaid source), `realizationNotes` (Markdown), and `realizationCode` (JSON array of `{ path, language, content }` scaffold files). A realized idea SHALL move to `status` = `realized`. In the AI pipeline only the rank-1 idea of a batch is realized; the Jira and user pipelines realize all ideas in their batch.

#### Scenario: Top idea is realized
- GIVEN an evaluated batch
- WHEN `realizeTopIdea` runs for the rank-1 idea
- THEN the idea gains `realizationHtml`, `realizationDiagram`, `realizationNotes`, and `realizationCode`
- AND its `status` becomes `realized`

### Requirement: Full AI ideas pipeline
The system SHALL run a full pipeline per configured department that generates a batch, evaluates it, optionally realizes the top idea when `ideasAutoRealize` is enabled, and publishes the winning idea. When realization occurs the realized idea SHALL be published; otherwise the rank-1 evaluated idea SHALL be published. The system SHALL record `ideasLastRunAt` on completion.

#### Scenario: Pipeline publishes a winner per department
- GIVEN one or more configured departments
- WHEN `runFullPipeline` executes
- THEN each department yields a batch that is generated, evaluated, and (if enabled) realized
- AND the realized idea — or the top evaluated idea when realization is skipped — is set to `status` = `published`

### Requirement: User-proposed ideas via /propose
The system SHALL let an authenticated user submit an idea through the `/propose` form (proposal type `idea`), validating that title is ≥3 characters and that summary, problem, and solution are each 20–8000 characters and department is a valid `DEPARTMENTS` value. On success the idea SHALL be inserted immediately with `source` = `user`, `status` = `published`, and `proposedBy`/`proposedByEmail` set, and the user SHALL be redirected to the idea page. AI evaluation and realization SHALL then run in the background with `preserveStatus` so the idea stays `published` while processing.

#### Scenario: Valid user proposal published immediately
- GIVEN a logged-in user submitting a well-formed idea proposal
- WHEN the form is posted
- THEN the idea is created as `source` = `user`, `status` = `published`, tagged with the proposer's id and email
- AND the user is redirected to `/ideas/{slug}` without waiting for AI processing
- AND evaluation and realization run afterwards in the background

#### Scenario: Invalid proposal rejected
- GIVEN a proposal missing a field or violating a length rule
- WHEN the form is posted
- THEN the server returns a 400 with a validation message and the entered values preserved

### Requirement: Jira issue import pipeline
When Jira integration is enabled and configured, the system SHALL fetch issues matching the configured JQL (up to `jiraMaxIssuesPerRun`, default 20), skip already-imported keys, and use the AI service to extract an idea (title, summary, problem, solution, department) from each new issue including its attachments. Imported ideas SHALL be stored with `source` = `jira`, the `jiraIssueKey` and a browse `jiraIssueUrl`, then evaluated and realized as a batch, and ALL of them SHALL be published. The system SHALL record `jiraLastRunAt`.

#### Scenario: New Jira issues become published ideas
- GIVEN Jira enabled with a URL and JQL, and new unimported issues
- WHEN `importFromJira` runs
- THEN each new issue is converted to an idea with `source` = `jira` and its `jiraIssueKey`/`jiraIssueUrl`
- AND every imported idea is evaluated, realized, and set to `status` = `published`

#### Scenario: Duplicate issues skipped
- GIVEN a Jira issue whose key was already imported
- WHEN the import runs
- THEN that issue is excluded and no duplicate idea is created

### Requirement: Browsing published ideas
The system SHALL require authentication to browse ideas and SHALL list only `published` ideas with per-idea vote counts. The list SHALL support filtering by one or more departments, a text search over title and summary, a source view that shows either generated ideas (`ai` + `jira`) or user-proposed ideas (`user`), and sorting by recent (default), oldest, votes, or score, with pagination.

#### Scenario: Filtered idea list
- GIVEN published ideas across departments and sources
- WHEN an authenticated user opens `/ideas` with department, search, source, and sort parameters
- THEN only matching `published` ideas are returned with vote counts and whether the current user has voted
- AND anonymous requests are redirected to login

### Requirement: Idea detail by slug
The system SHALL serve a single published idea by its `slug` including its full research/evaluation/realization content, vote count and the current user's vote and participation flags, and its chat messages. A missing or non-published slug SHALL redirect back to `/ideas`.

#### Scenario: Opening an idea page
- GIVEN a published idea slug
- WHEN an authenticated user opens `/ideas/{slug}`
- THEN the idea's evaluation scores, interactive PoC, diagram, notes, and metadata are available for display
- AND an unknown or unpublished slug redirects to the ideas list

### Requirement: Admin idea management
The system SHALL provide an admin ideas page (admin role required for mutations) that lists all ideas with filters (department, status, batchId, source) and pagination, and offers actions to run the generation pipeline, evaluate or realize a batch, import from Jira, and publish, archive, or delete an individual idea.

#### Scenario: Admin archives an idea
- GIVEN an admin on the admin ideas page
- WHEN they invoke the archive action for an idea
- THEN that idea's `status` becomes `archived`
- AND a non-admin invoking any mutating action receives HTTP 403

### Requirement: AI Idea Retention
The system SHALL provide `ideasService.archiveOldIdeas(days)` that archives only auto-generated ideas that have aged out. The method MUST archive ideas where `source = 'ai'` AND `status != 'archived'` AND `createdAt` is older than `days` (ideas have no `publishedAt`, so age is measured from creation), setting their `status` to `archived` with `updatedAt` refreshed, and MUST return the count archived. User-proposed ideas (`source = 'user'`) and Jira-imported ideas (`source = 'jira'`) MUST NEVER be archived by this method. It is invoked by the ideas-retention background job.

#### Scenario: Old AI ideas archived
- GIVEN non-archived `source='ai'` ideas whose `createdAt` is older than the configured day threshold
- WHEN `archiveOldIdeas(days)` runs
- THEN those ideas are set to `archived`, `updatedAt` is refreshed, and the archived count is returned

#### Scenario: Human and Jira ideas preserved
- GIVEN old ideas with `source='user'` and `source='jira'` older than the threshold
- WHEN `archiveOldIdeas(days)` runs
- THEN those ideas remain in their existing status and are not archived

#### Scenario: Already-archived AI ideas skipped
- GIVEN an old `source='ai'` idea already at `status='archived'`
- WHEN `archiveOldIdeas(days)` runs
- THEN it is not re-processed and is excluded from the returned count
