# Design Notes

## Why archive instead of delete
Generated content participates in draft/published/**archived** lifecycles that
already exist on all three tables. Archiving removes items from public browsing
(all public queries filter `status = 'published'`) while preserving them for
admin review and reversibility. Hard deletion was reserved for `raw_items` (feed
noise with no downstream references).

## Why ideas key off `source` and `createdAt`
- **`source = 'ai'` only.** The `ideas.source` enum (`ai` | `jira` | `user`)
  already distinguishes provenance. "Auto-generated" is `ai`. User proposals
  (`user`) are human contributions and must persist; Jira-imported ideas
  (`jira`) mirror real tracked work and are also preserved. The archive query is
  `source = 'ai' AND status != 'archived' AND createdAt < cutoff`.
- **`createdAt`, not `publishedAt`.** The `ideas` table has no `publishedAt`
  column, so age is measured from creation. News and trends both have
  `publishedAt` and archive on that, matching `archiveOldNews`.

## Why mirror the maintenance-job pattern
Feed cleanup and auto-archive already establish the
`<job>Enabled` / `<job>IntervalMinutes` / `<job>LastRunAt` +
`shouldRun<Job>()` / `update<Job>LastRun()` idiom, gated on the singleton
settings row and dispatched from `runScheduledTasks()`. Reusing it verbatim keeps
one mental model for all background maintenance and inherits the existing
per-job failure isolation and settings cache.

## Defaults
`newsRetentionDays` 30, `trendsRetentionDays` 90 (trend analyses are long-lived),
`ideasRetentionDays` 30; interval 60 min each; all three `*RetentionEnabled`
default `false` so the feature is opt-in and prod behavior is unchanged until an
admin turns it on.

## Migration mechanism
Production applies migrations at boot via `entrypoint.sh` →
`scripts/db-migrate.js` (Drizzle migrator over `drizzle/`). New settings columns
therefore require a committed migration file (`0027_content_retention.sql`), not
just a `schema.ts` edit. The file was hand-authored (repo has prior schema drift
that makes `drizzle-kit generate` interactive) and verified to apply cleanly.
