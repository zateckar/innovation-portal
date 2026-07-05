# Add automatic retention for generated News, Trends & Ideas

## Intent

Old AI-generated content accumulated indefinitely in production. Administrators
expected enabling the schedule to periodically remove aging generated content,
but nothing did: the only age-based maintenance jobs were **Feed Cleanup**
(deletes `raw_items`) and **Auto-Archive** (archives vote-less `innovations`).
Neither touched `news`, `trends`, or `ideas`. A `newsService.archiveOldNews()`
method existed but had no caller; trends and ideas had no age-based routine at
all. Enabling the schedule therefore correctly did nothing to old digests, trend
reports, or ideas.

The goal is to periodically **archive** old auto-generated content, driven by
dedicated admin-configurable settings, so public feeds stay fresh without losing
data or removing human-authored content.

## Scope

- Three new, independently gated background jobs on the existing 5-minute
  scheduler: **news retention**, **trends retention**, **ideas retention**.
- Twelve new columns on the singleton `settings` row (enable / days / interval /
  last-run per content type) plus a Drizzle migration.
- Dedicated admin controls (toggle + day threshold + "Run Now") on
  `/admin/schedule` under the Maintenance section.
- Domain archive methods: reuse `archiveOldNews`, add `archiveOldTrends` and
  `archiveOldIdeas`.

Out of scope: changing feed-item cleanup (stays hard-delete) or innovation
auto-archive; any hard deletion of generated content; retention for
human-authored content.

## Approach

- **Soft archive, not delete.** Each job sets `status = 'archived'` so items drop
  out of public feeds but remain in the database and admin views. This matches
  the existing `news.status` / `trends.status` / `ideas.status` lifecycles and is
  reversible.
- **Only auto-generated content is archived.** News retention and trends
  retention archive `published` rows older than the threshold (by `publishedAt`).
  Ideas retention archives only `source = 'ai'` ideas (by `createdAt`, since
  ideas have no `publishedAt`); **user-proposed (`source = 'user'`) and
  Jira-imported (`source = 'jira'`) ideas are never touched.**
- **Mirror the existing maintenance pattern exactly.** Each job has an
  `<x>RetentionEnabled` flag, `<x>RetentionDays` threshold,
  `<x>RetentionIntervalMinutes` (default 60), and `<x>RetentionLastRunAt`,
  gated by `scannerService.shouldRun<X>Retention()` and stamped by
  `updateNewsRetentionLastRun()` etc. — identical to feed cleanup / auto-archive.
- **Defaults ship OFF.** News/ideas default 30 days, trends default 90 days;
  all three retention toggles default `false`, so behavior is unchanged until an
  admin opts in.
