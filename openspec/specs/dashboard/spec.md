# Dashboard & Discovery Specification

## Purpose
Defines the authenticated home dashboard and the employee-facing discovery surfaces (home overview, "Get Inspiration", and "About"). Covers what a logged-in employee sees — published innovations ranked by votes, latest news, top trends, ideas and development pipeline — and how a per-user department preference filters most of these surfaces consistently.

## Requirements

### Requirement: Authenticated access to discovery surfaces
The system SHALL require an authenticated session for the home dashboard (`/`), the inspiration page (`/inspiration`), and the about page (`/about`). Any request without `locals.user` MUST be redirected (302) to `/auth/login`.

#### Scenario: Anonymous visitor hits the home page
- GIVEN a request with no active session
- WHEN the user navigates to `/`
- THEN the server throws a 302 redirect to `/auth/login`

#### Scenario: Logged-in employee opens the dashboard
- GIVEN a request with a valid `locals.user`
- WHEN the user navigates to `/`
- THEN the dashboard load runs and returns the discovery data payload

### Requirement: Home dashboard aggregates the innovation pipeline
The system SHALL render an at-a-glance overview composed of published innovations, active catalog items, top ideas, ideas in development, latest news, and top trends, plus a stat strip with total counts per section (innovations, catalog, ideas, development, news, trends).

#### Scenario: Dashboard shows top published innovations
- GIVEN published innovations exist
- WHEN the dashboard loads
- THEN it returns up to 4 innovations with `status = 'published'`, each joined to its vote count
- AND they are ordered by vote count descending, then `publishedAt` descending

#### Scenario: Development pipeline counts match the development page
- GIVEN ideas are in development
- WHEN the dashboard computes `devIdeasCount`
- THEN it sums the `inProgress`, `underReview`, `building`, and `deployed` buckets from `ideasService.getIdeasInDevelopment(userId)`
- AND ideas not fitting any bucket are excluded so the count matches `/development`

#### Scenario: Load failure degrades gracefully
- GIVEN the database query throws during load
- WHEN the dashboard catch block runs
- THEN it returns empty lists and zeroed counts while still returning `activeDept`

### Requirement: Ranked published innovations by votes
The system SHALL rank innovations shown on discovery surfaces primarily by descending vote count (via a LEFT JOIN on `votes` with `count(votes.id)`), and MUST mark each innovation with `hasVoted` for the current user.

#### Scenario: A user's own votes are flagged
- GIVEN the user has voted on some innovations
- WHEN the innovations list is built
- THEN each returned innovation has `hasVoted` set to true only when the user's id appears in that innovation's votes

### Requirement: Per-user department preference resolution
The system SHALL resolve an active department filter in priority order: the `?dept=` URL parameter (only if it is a member of `DEPARTMENTS`), otherwise the current user's saved `department` preference, otherwise `null` meaning "show all".

#### Scenario: URL parameter overrides the saved preference
- GIVEN a user whose saved department is `it`
- WHEN they load `/?dept=finance`
- THEN `activeDept` resolves to `finance`

#### Scenario: Invalid department parameter is ignored
- GIVEN a user with no saved preference
- WHEN they load `/?dept=notarealdept`
- THEN `activeDept` resolves to `null` (show all)

### Requirement: Persisting the department preference
The system SHALL expose a `setDepartment` form action on both the dashboard and inspiration pages that saves the chosen department onto the current user's `users.department` row. Submitting an empty or invalid value MUST clear the preference (set to `null`), and the action MUST redirect (303) back to the originating page.

#### Scenario: Employee selects a department pill
- GIVEN a logged-in employee on the dashboard
- WHEN they submit the department form with `dept=hr`
- THEN `users.department` is updated to `hr`
- AND the browser is redirected (303) to `/`

#### Scenario: Employee clears the filter
- GIVEN a logged-in employee with a saved department
- WHEN they submit the form with `dept=""`
- THEN `users.department` is set to `null` and content is shown for all departments

### Requirement: Department filtering applied per content type
The system SHALL apply the active department filter to innovations, catalog items, news, and ideas, while treating trends as cross-cutting (never department-filtered). For innovations and catalog items, selecting `general` MUST also match rows whose `department` is `NULL` (backfill guard); news is filtered on `news.category` and ideas on `ideas.department`.

#### Scenario: General department includes legacy NULL rows
- GIVEN some published innovations have `department = NULL`
- WHEN `activeDept` is `general`
- THEN the innovations query matches both `department = 'general'` and `department IS NULL`

#### Scenario: Trends ignore the department filter
- GIVEN an active department filter of `production`
- WHEN top trends are loaded
- THEN trends are selected by `status = 'published'` ordered by `impactScore` and are not restricted by department

### Requirement: Department radar and overview
The system SHALL provide a radar/overview of published innovations with an always-unfiltered per-department count breakdown (`innovationDeptCounts`), so the radar shows the full picture regardless of the active filter, and MUST render department labels and colours from `DEPARTMENT_LABELS` / `DEPARTMENT_COLORS`.

#### Scenario: Department counts stay unfiltered
- GIVEN an active department filter is set
- WHEN `innovationDeptCounts` is computed
- THEN it counts all published innovations grouped by department, ignoring the active filter

### Requirement: Inspiration discovery page
The system SHALL provide `/inspiration` showing up to 6 items each of software on the market (innovations), catalog tools, generated ideas (restricted to `source` in `ai` and `jira`, sorted by votes), industry news, and industry trends, each with a total count and a "View all" link, honouring the same department preference and `setDepartment` action (redirecting to `/inspiration`).

#### Scenario: Generated ideas are limited to AI and Jira sources
- GIVEN published ideas from mixed sources exist
- WHEN the inspiration page loads its ideas section
- THEN only ideas with `source` of `ai` or `jira` are returned, sorted by votes, limited to 6

### Requirement: Static about / lifecycle page
The system SHALL provide an authenticated `/about` page describing the two-phase, AI-augmented innovation-to-deployment lifecycle (Phase 1 discover & evaluate in this app; Phase 2 build & operate in the companion app) with human approval gates, requiring only a valid session and no additional data load.

#### Scenario: Logged-in employee views the lifecycle
- GIVEN a logged-in employee
- WHEN they navigate to `/about`
- THEN the pipeline overview and step-by-step breakdown are rendered
