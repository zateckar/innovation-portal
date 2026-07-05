# OpenSpec

This directory holds the **specifications** for the Innovation Incubator, written
in the [OpenSpec](https://github.com/Fission-AI/OpenSpec) style: specs live in the
repo alongside the code, organized by capability, as the durable source of truth
for how the system behaves.

## Start here

- **`project.md`** — system overview: what the app is, the end-to-end pipeline,
  the tech stack, and architecture conventions.
- **`AGENTS.md`** — the exact spec format and workflow (how to write/change specs).

## Capabilities (`specs/`)

Each folder documents one capability as `spec.md` (Purpose + Requirements with
GIVEN/WHEN/THEN scenarios).

### Discovery & content
- `dashboard` — home, department radar/filtering, inspiration, about
- `news-feed-ingestion` — sources, scanning, AI filtering of raw items
- `news-digests` — AI-generated department news
- `trends` — AI-generated trend analyses
- `innovations` — curated/researched innovations & lifecycle

### Ideas → software
- `ideas` — AI/Jira/user-sourced ideas, evaluation, realization PoC
- `idea-development` — vote-gated development: spec generation, chat refinement,
  AI spec editing, version history, mockups
- `autonomous-build` — building a working app from a spec (internal + external
  pipelines, workspace serving, watchdog)
- `production-promotion` — requesting promotion of a built app to production

### Engagement
- `voting` — voting on innovations and ideas
- `comments` — threaded comments across innovations/ideas/catalog

### Delivery
- `catalog` — incubator catalog, SaaS vs self-hosted deployments

### Platform
- `authentication` — local + OIDC login, sessions, roles
- `api-tokens` — personal access tokens for deploys
- `admin-settings` — platform configuration (singleton settings)
- `admin-management` — user & content management
- `automation-pipeline` — scheduled jobs & auto-mode
- `observability` — audit log, runtime logs, health
- `integrations` — Jira & Azure DevOps

## Proposing changes (`changes/`)

New or changed behavior starts as a change proposal under
`changes/<change-id>/` (proposal + tasks + spec deltas), then gets merged into
`specs/` and archived on completion. See `AGENTS.md`.
