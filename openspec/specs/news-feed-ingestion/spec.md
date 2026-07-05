# News Feed Ingestion Specification

## Purpose
The system discovers technology innovations by scanning configured news sources
(RSS feeds and APIs), storing new items as raw feed items, de-duplicating them,
and running an AI relevance filter that accepts or rejects each item with a
reason. This capability covers source configuration, scanning, de-duplication,
AI filtering, and the raw item status lifecycle.

## Requirements

### Requirement: Source configuration
The system SHALL let admins manage news sources stored in the `sources` table.
Each source MUST have a `name`, a `type` of `rss`, `api`, or `scrape`, and a
`url`; it also carries an `enabled` flag (default true) and a
`scanIntervalMinutes` (default 120). Adding a source MUST validate that all
required fields are present and that the URL is a well-formed URL. All source
management actions MUST be restricted to admin users.

#### Scenario: Adding a valid source
- GIVEN an admin submits a name, type, and valid URL with an optional interval
- WHEN the add action runs
- THEN a new `sources` row is inserted with `enabled` true and the given (or default 120) scan interval

#### Scenario: Rejecting an invalid source
- GIVEN a submitted source with a missing field or a malformed URL
- WHEN the add action runs
- THEN it fails with a 400 error and no row is inserted

#### Scenario: Non-admin blocked
- GIVEN a non-admin user
- WHEN they attempt to add, toggle, or delete a source
- THEN the action returns 403 Forbidden

### Requirement: Enable and disable sources
The system SHALL allow toggling a source's `enabled` flag and deleting sources.
Only enabled sources SHALL be considered when scanning all sources, and a
scan targeting a missing or disabled source MUST be a no-op that adds 0 items.

#### Scenario: Toggling a source off
- GIVEN an enabled source
- WHEN the toggle action runs
- THEN the source's `enabled` flag is flipped to false and it is skipped by subsequent scans

#### Scenario: Scanning a disabled source
- GIVEN a source with `enabled` false
- WHEN `scanSource` is called for it
- THEN it logs that the source is disabled and returns 0 items added

### Requirement: Scanning RSS feeds
The system SHALL scan RSS/Atom sources with `scanRssFeed`. It MUST parse the feed
URL, keep only items that have both a title and a link, and insert each new item
into `raw_items` with status `pending`, capturing `externalId` (guid or link),
title, url (the link), content (contentSnippet or content), and `publishedAt`
from the item's pubDate when present. After a successful scan the source's
`lastScannedAt` MUST be updated.

#### Scenario: New RSS items ingested
- GIVEN an RSS source returns feed items with titles and links not already stored
- WHEN `scanRssFeed` runs
- THEN each new item is inserted into `raw_items` with status `pending` and `lastScannedAt` is updated on the source

#### Scenario: Items missing title or link
- GIVEN feed entries that lack a title or a link
- WHEN the feed is scanned
- THEN those entries are filtered out and not inserted

### Requirement: Scanning API sources
The system SHALL scan `api`-type sources. For URLs identifying Hacker News, the
system MUST fetch the top stories list, retrieve up to the first 30 story details
(in parallel), keep only items of type `story` that have a `url`, and insert new
ones into `raw_items` with status `pending` using the story id as `externalId`.
Unrecognized API source URLs MUST add 0 items.

#### Scenario: Hacker News top stories ingested
- GIVEN a Hacker News API source
- WHEN it is scanned
- THEN up to 30 top story items of type `story` with a URL are inserted as new `raw_items` with status `pending`

#### Scenario: Unknown API type
- GIVEN an `api` source whose URL is not a recognized API
- WHEN it is scanned
- THEN the scan logs an unknown API type and returns 0 items added

### Requirement: De-duplication of raw items
The system SHALL avoid storing duplicate feed items. For RSS sources it MUST
batch-load the existing URLs for that source and skip any incoming item whose
link already exists (including duplicates within the same feed). For Hacker News
it MUST batch-check existing `externalId` values for that source and skip stories
already stored.

#### Scenario: Duplicate RSS link skipped
- GIVEN a feed item whose link already exists in `raw_items` for that source
- WHEN the feed is scanned
- THEN the item is not inserted again

#### Scenario: Duplicate within a single feed
- GIVEN two feed entries in the same fetch share the same link
- WHEN the feed is scanned
- THEN only the first is inserted and the second is skipped

### Requirement: AI relevance filtering
The system SHALL filter `pending` raw items through the AI via
`filterPendingItems`, processing up to a limit ordered by `discoveredAt`
descending, using the configurable `filterPrompt`. An item MUST be marked
`accepted` when the AI reports it relevant with confidence at least 0.6;
otherwise it MUST be marked `rejected`. In both cases the AI's reason MUST be
stored in `aiFilterReason`.

#### Scenario: Relevant item accepted
- GIVEN a pending item the AI judges relevant with confidence >= 0.6
- WHEN it is filtered
- THEN its status becomes `accepted` and `aiFilterReason` records the AI reason

#### Scenario: Low-confidence or irrelevant item rejected
- GIVEN a pending item that is not relevant or has confidence below 0.6
- WHEN it is filtered
- THEN its status becomes `rejected` and `aiFilterReason` records the AI reason

### Requirement: Raw item status lifecycle
The system SHALL track each raw item through the `raw_items.status` enum:
`pending`, `accepted`, `rejected`, `processed`, `failed` (default `pending`).
Newly ingested items are `pending`; filtering moves them to `accepted` or
`rejected`; the research stage marks accepted items `processed` on success (or
when a duplicate innovation already exists) and `failed` when research
encounters a transient error, leaving the reason in `aiFilterReason`.

#### Scenario: Accepted item processed after research
- GIVEN an `accepted` item that is successfully researched into an innovation
- WHEN research completes
- THEN the raw item status becomes `processed` with an explanatory `aiFilterReason`

#### Scenario: Research failure is retryable
- GIVEN an `accepted` item whose research throws a transient error
- WHEN research fails
- THEN the item status becomes `failed` (not `rejected`) so it can be retried later

### Requirement: Per-source and job scan intervals
The system SHALL support per-source scan intervals via `sources.scanIntervalMinutes`
and a global scan job gate via settings. `shouldRunScan` MUST return false when
`scanEnabled` is false, true when the scan has never run, and otherwise true only
once the minutes since `scanLastRunAt` reach `scanIntervalMinutes` (default 120).

#### Scenario: Scan disabled
- GIVEN `scanEnabled` is false in settings
- WHEN `shouldRunScan` is evaluated
- THEN it returns false and no scan runs

#### Scenario: Interval elapsed
- GIVEN `scanEnabled` is true and the time since `scanLastRunAt` exceeds the configured interval
- WHEN `shouldRunScan` is evaluated
- THEN it returns true so the scan job may run
</content>
