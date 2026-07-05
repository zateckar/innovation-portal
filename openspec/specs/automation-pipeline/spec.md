# Automation Pipeline Specification

## Purpose
The Innovation Incubator runs itself through a single background scheduler that
ticks on a fixed cron cadence and dispatches a set of interval-gated jobs: feed
scan, AI filter, AI research, news generation, ideas generation, trends
generation, Jira sync, auto-archive, and feed cleanup. Each job is individually
enabled, has its own interval, and records a last-run timestamp in the singleton
settings row. An "auto mode" can run the scan → filter → research → publish
pipeline end-to-end and auto-publish innovations above a score threshold. This
capability covers scheduling, per-job gating, auto mode, and the admin surfaces
that monitor and manually trigger the pipeline. Domain logic for each job lives
in its own capability (news-feed-ingestion, innovations, news-digests, etc.).

## Requirements

### Requirement: Scheduler bootstrap and cron tick
The system SHALL start exactly one background scheduler after startup
initialization completes. `initializeJobs()` MUST be called from
`hooks.server.ts` only after admin bootstrap, additive migrations, log-level
load, and orphan reaping have finished, and MUST register a single
`Bun.cron('*/5 * * * *', …)` task that invokes `runScheduledTasks()` every five
minutes. Re-invocation MUST be idempotent (guarded by an `initialized` flag), and
`stopJobs()` MUST stop the cron task and reset the guard.

#### Scenario: Scheduler initialized once at startup
- GIVEN the server has completed `initializeAdminFromEnv()` and follow-up init steps
- WHEN `initializeJobs()` runs
- THEN a single Bun cron task on the `*/5 * * * *` schedule is registered and `initialized` is set true

#### Scenario: Repeated initialization is a no-op
- GIVEN jobs are already initialized
- WHEN `initializeJobs()` is called again
- THEN it logs "Jobs already initialized" and does not register a second cron task

### Requirement: Non-overlapping tick execution
The system SHALL prevent overlapping job batches. `runScheduledTasks()` MUST skip
the tick when a previous batch is still running (an `isRunning` guard), and MUST
arm a 30-minute watchdog timer that force-resets `isRunning` to false so a stuck
batch cannot block all future ticks. The guard MUST be cleared in a `finally`
block when the batch completes.

#### Scenario: Overlapping tick skipped
- GIVEN a previous job batch is still executing when the next 5-minute tick fires
- WHEN `runScheduledTasks()` runs
- THEN it logs that the previous run is in progress and returns without running jobs

#### Scenario: Stuck batch released by watchdog
- GIVEN a job batch has run longer than 30 minutes
- WHEN the watchdog timer fires
- THEN `isRunning` is forced to false so subsequent ticks can proceed

### Requirement: Per-job enable flag, interval, and last-run timestamp
The system SHALL gate each job on columns in the singleton `settings` row (id
`default`). Every job MUST honour its `<job>Enabled` flag, its
`<job>IntervalMinutes`, and its `<job>LastRunAt` timestamp, running only when
enabled and only once the minutes elapsed since the last run reach the interval;
a job that has never run MUST be allowed to run. The covered jobs and their
settings are: scan (`scanEnabled`/`scanIntervalMinutes` default 120), filter
(`filterEnabled`/`filterIntervalMinutes` default 30), research
(`researchEnabled`/`researchIntervalMinutes` default 60), archive
(`archiveEnabled`/`archiveIntervalMinutes` default 60), cleanup
(`cleanupEnabled`/`cleanupIntervalMinutes` default 60), news
(`newsEnabled`/`newsIntervalMinutes` default 1440), ideas
(`ideasEnabled`/`ideasIntervalMinutes` default 1440), jira
(`jiraEnabled`/`jiraIntervalMinutes` default 1440), and trends
(`trendsEnabled`/`trendsIntervalMinutes` default 10080). Each job MUST update its
`<job>LastRunAt` after a run.

#### Scenario: Disabled job skipped
- GIVEN a job's `<job>Enabled` flag is false
- WHEN the scheduler tick evaluates that job
- THEN the job logs that it is disabled and is skipped

#### Scenario: Interval not yet elapsed
- GIVEN an enabled job whose minutes since `<job>LastRunAt` are less than its interval
- WHEN the scheduler tick evaluates that job
- THEN the job logs "not due yet" and is skipped

#### Scenario: Job runs and records timestamp
- GIVEN an enabled job that is due
- WHEN the job executes successfully
- THEN its work runs and `<job>LastRunAt` is updated to the current time

### Requirement: Auto mode end-to-end pipeline
The system SHALL provide an "auto mode" that supersedes the individual
scan/filter/research jobs when `autoModeEnabled` is true. On each tick the
scheduler MUST run `runAutoModeJob()` instead of the separate scan, filter, and
research jobs. Auto mode MUST enforce its own cooldown using the dedicated
`autoModeLastRunAt` timestamp and `autoRunIntervalMinutes` (default 60) so that
manually triggered scans do not reset it, MUST run `scannerService.runAutoMode()`
which discovers, filters, researches, and publishes innovations whose average
score meets `autoPublishThreshold` (default 7.0, producing up to
`autoInnovationsPerRun`, default 3), and MUST update `autoModeLastRunAt`
afterward.

#### Scenario: Auto mode replaces individual jobs
- GIVEN `autoModeEnabled` is true
- WHEN a scheduler tick runs
- THEN `runAutoModeJob()` runs and the standalone scan/filter/research jobs are not run

#### Scenario: Auto mode respects its own cooldown
- GIVEN auto mode ran less than `autoRunIntervalMinutes` ago per `autoModeLastRunAt`
- WHEN the auto mode job is evaluated
- THEN it logs the elapsed/interval and skips without re-running the pipeline

### Requirement: Always-on maintenance and generation jobs
The system SHALL run the archive, cleanup, news, ideas, Jira, and trends jobs on
every tick independently of auto mode, each subject to its own enable/interval
gate. Auto-archive MUST archive innovations that have accrued no votes within
`archiveNoVotesDays` (default 14); cleanup MUST remove feed items older than
`cleanupOlderThanDays` (default 7); news MUST call
`newsService.generateAndPublishNews()`; ideas MUST call
`ideasService.runFullPipeline()`; Jira MUST call `ideasService.runJiraPipeline()`
(gated additionally by `jiraEnabled`); and trends MUST call
`trendsService.generateAndPublishTrends()`. The tick MUST also clean up expired
sessions and run the workspace health monitor each time.

#### Scenario: Maintenance jobs run regardless of auto mode
- GIVEN auto mode is enabled
- WHEN a scheduler tick runs
- THEN the archive, cleanup, news, ideas, Jira, and trends jobs are still evaluated on their own gates

#### Scenario: Auto-archive removes stale innovations
- GIVEN the archive job is enabled and due and innovations exist with no votes older than `archiveNoVotesDays`
- WHEN `archiveInactiveInnovations()` runs
- THEN those innovations are archived and `archiveLastRunAt` is updated

### Requirement: Job failure isolation
The system SHALL isolate failures so that one failing job does not abort the tick
or block others. Each job's body MUST be wrapped so an error is logged (e.g.
"[Job] … failed") and the batch continues; a per-tick settings cache with a
5-minute TTL MUST avoid hitting the database when all jobs are disabled.

#### Scenario: One job throws, others continue
- GIVEN the news job throws an error during a tick
- WHEN the batch continues
- THEN the error is logged and the remaining jobs (ideas, Jira, trends, etc.) still run

### Requirement: Manual job triggering
The system SHALL let admins trigger jobs on demand from the schedule admin page
(`/admin/schedule`, with `/admin/pipeline` redirecting to it). The `runJob`
action MUST reject non-admins with 403, MUST accept the scheduler jobs `auto`,
`discover`, `scan`, `filter`, `research`, `news`, `ideas`, `jira`, and `trends`
via `runJobNow()` (bypassing the interval gate), MUST additionally handle
`archive` and `cleanup` by calling the scanner service directly, and MUST reject
any other job name with 400.

#### Scenario: Admin runs a job immediately
- GIVEN an admin submits `runJob` with `job=ideas`
- WHEN the action runs
- THEN `runJobNow('ideas')` executes the ideas pipeline and a success message is returned

#### Scenario: Non-admin blocked from triggering
- GIVEN a non-admin user
- WHEN they submit the `saveSchedule` or `runJob` action
- THEN the action returns 403 Forbidden

#### Scenario: Unknown job rejected
- GIVEN a submitted `job` value that is not a known scheduler, archive, or cleanup job
- WHEN `runJob` runs
- THEN it returns a 400 "Invalid job name" error

### Requirement: Schedule configuration and monitoring surface
The system SHALL provide an admin schedule page that loads the current settings
and lets admins save all job enable flags, intervals, and job-specific parameters
(auto-publish threshold, innovations per run, archive/cleanup thresholds,
news/ideas departments and batch sizes, Jira max issues per run, etc.) via the
`saveSchedule` action. Saving MUST validate that `autoPublishThreshold` is
between 1 and 10 and `autoInnovationsPerRun` is between 1 and 20, MUST persist
`settingsChangedAt`, and the page MUST surface each job's last-run time and a
computed next-run estimate from `lastRunAt + intervalMinutes`.

#### Scenario: Saving an out-of-range threshold rejected
- GIVEN an admin submits `autoPublishThreshold` outside 1–10
- WHEN `saveSchedule` runs
- THEN it returns a 400 validation error and settings are not updated

#### Scenario: Next-run estimate shown
- GIVEN a job with a recorded `lastRunAt` and configured interval
- WHEN the schedule page renders
- THEN it displays the last run and a next-run estimate (e.g. "Due now" or "in 2h 15m")
