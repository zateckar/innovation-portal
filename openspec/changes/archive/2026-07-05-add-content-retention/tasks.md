# Tasks

## 1. Schema & migration
- [x] 1.1 Add 12 retention columns to the `settings` table in
  `src/lib/server/db/schema.ts` (news/trends/ideas × enabled/days/intervalMinutes/lastRunAt)
- [x] 1.2 Add Drizzle migration `drizzle/0027_content_retention.sql` + journal entry;
  verify it applies via `scripts/db-migrate.js`

## 2. Domain archive methods
- [x] 2.1 Reuse existing `newsService.archiveOldNews(days)` (archives `published`
  news older than `days` by `publishedAt`)
- [x] 2.2 Add `trendsService.archiveOldTrends(days)` (archives `published` trends
  older than `days` by `publishedAt`)
- [x] 2.3 Add `ideasService.archiveOldIdeas(days)` — archive only `source='ai'`,
  non-archived ideas older than `days` by `createdAt`; keep `user`/`jira`

## 3. Scheduling gates
- [x] 3.1 Add `shouldRunNewsRetention` / `shouldRunTrendsRetention` /
  `shouldRunIdeasRetention` + matching `update<X>RetentionLastRun` to
  `scannerService`, mirroring `shouldRunCleanup` / `updateCleanupLastRun`

## 4. Scheduler wiring
- [x] 4.1 Add `runNewsRetentionJob` / `runTrendsRetentionJob` /
  `runIdeasRetentionJob` to `src/lib/server/jobs/scheduler.ts`
- [x] 4.2 Invoke all three in `runScheduledTasks()` right after `runCleanupJob()`

## 5. Admin surface
- [x] 5.1 `saveSchedule`: parse & persist the 6 new form fields (enabled + days per type)
- [x] 5.2 `runJob`: handle `news-retention` / `trends-retention` / `ideas-retention`
  (call the service method + update last-run)
- [x] 5.3 Add three Maintenance cards to `/admin/schedule` `+page.svelte`
  (toggle, day threshold, Run Now)

## 6. Verification
- [x] 6.1 `bun run check` — 0 errors
- [x] 6.2 End-to-end: seed old news/trend/AI-idea/user-idea/jira-idea, run each
  archive method, confirm generated items archive and user/jira ideas are preserved
