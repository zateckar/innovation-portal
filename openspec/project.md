# Innovation Incubator — Project Context

> Context file for OpenSpec. Read this before writing or changing any spec. It
> describes the technology, architecture, and conventions of this codebase so
> specifications stay grounded in how the system actually works.

## What this application is

An internal **Innovation Incubator** platform. It runs an AI-assisted pipeline
that turns external signal (news feeds, Jira, user submissions) into curated
**innovations**, actionable **ideas**, and **trend** analyses, then lets the
organization vote on ideas, collaboratively refine them into a **specification**,
**autonomously build** a working application from that spec, and finally publish
finished tools to an **incubator catalog** that colleagues can try or self-deploy.

Everything is organized around **departments** (R&D, Production, HR, Legal,
Finance, IT, Purchasing, Quality, Logistics, General) — a taxonomy that is
cross-cutting across users, news, ideas, innovations, trends, and catalog items.

## The end-to-end pipeline

```
news sources ──scan──> raw items ──AI filter──> researched INNOVATIONS ──vote──> promote
                                              └─> AI-generated IDEAS ──vote (threshold)──>
      IDEAS ──development──> spec (chat refine + AI edit + versions + mockups)
            ──autonomous build──> deployed app ──promote──> production (Jira)
            (finished tools) ──> CATALOG ──> users try / self-host deploy
NEWS DIGESTS and TRENDS are generated on schedules for each department.
```

## Technology stack

- **Framework:** SvelteKit 2 (Node adapter) with **Svelte 5 runes** (`$state`,
  `$derived`, `$props`, `$effect`). Server routes are `+page.server.ts` /
  `+server.ts`; UI is `.svelte`.
- **Runtime / package manager:** Bun.
- **Database:** SQLite via **Drizzle ORM**. Schema in
  `src/lib/server/db/schema.ts`; migrations in `drizzle/`.
- **Styling:** Tailwind CSS v4 with a custom dark design system (CSS variables,
  department accent colors). Markdown rendered via `marked`; diagrams via
  `mermaid`; syntax highlighting via `highlight.js`.
- **AI:** Google Generative AI (Gemini) through `@google/generative-ai`, wrapped
  by `src/lib/server/services/ai.ts`. Model + API key configurable at runtime in
  admin settings.
- **Autonomous builder:** OpenCode SDK (`@opencode-ai/sdk`) drives an internal
  build pipeline; an external "Mamina" pipeline is an alternative build path.
- **Auth:** Local (email + password hash) and **OIDC SSO** via `arctic`.
  Cookie-based sessions.
- **External integrations:** **Jira** (issue ingestion → ideas, escalation) and
  **Azure DevOps** (repository PRs for published specs).

## Architecture conventions

- **Service layer:** business logic lives in `src/lib/server/services/*.ts`
  (e.g. `ideas.ts`, `scanner.ts`, `news.ts`, `trends.ts`, `deployment.ts`,
  `buildLauncher.ts`). Routes are thin and delegate to services.
- **Settings are a singleton DB row** (`settings`, id `default`), cached by
  `settingsCache.ts`. Most runtime behavior (prompts, schedules, feature toggles,
  integration credentials, thresholds) is admin-configurable rather than env-based.
- **Scheduling:** background jobs (scan, filter, research, news, ideas, trends,
  Jira sync, archive, cleanup, auto-mode) are interval-driven from settings and
  bootstrapped in `src/hooks.server.ts`.
- **Auth gating:** `src/hooks.server.ts` resolves the session user; `admin/**`
  routes and `api/admin/**` endpoints require role `admin`.
- **Audit:** privileged writes are recorded in the audit log (`activity_log`
  table) via `src/lib/server/audit.ts`.
- **Departments enum** is duplicated between `schema.ts` and `src/lib/types.ts`
  (schema cannot import the app layer) — keep them in sync.

## Key entities (see `src/lib/server/db/schema.ts`)

`users`, `sessions`, `apiTokens`, `sources`, `rawItems`, `settings`,
`innovations` (+ `votes`, `tags`, `innovationTags`, `innovationSources`),
`ideas` (+ `ideaVotes`, `ideaChats`, `specVersions`), `comments`, `news`,
`trends`, `catalogItems` (+ `userDeployments`), `auditLog`.

## Conventions for writing specs here

- One capability per folder under `openspec/specs/<capability>/spec.md`.
- Specs describe **current, shipped behavior** (source of truth). Proposed
  changes go under `openspec/changes/<change-id>/` as deltas.
- Every **Requirement** uses RFC-2119 wording (SHALL/MUST/SHOULD/MAY) and has at
  least one **Scenario** (GIVEN / WHEN / THEN / AND).
- Keep requirements behavior-focused but technically accurate — reference real
  statuses, roles, and external systems as they exist in the code.
- See `AGENTS.md` for the exact format.
