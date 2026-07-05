# Voting Specification

## Purpose
The voting capability lets authenticated users express support for innovations and for ideas. Each user may cast at most one vote per item, and votes can be freely added or removed. Vote counts drive ranking of innovations and, for ideas, advancement past a configurable development threshold. Users can review everything they have voted for on a dedicated page.

## Requirements

### Requirement: Authentication required to vote
The system SHALL require an authenticated user for all vote operations. Requests without a valid session SHALL be rejected with HTTP 401.

#### Scenario: Anonymous vote rejected
- GIVEN a request with no authenticated user
- WHEN it POSTs or DELETEs a vote on an innovation or an idea
- THEN the server responds with 401 Authentication required

### Requirement: One vote per user per item
The system SHALL enforce at most one vote per user per innovation and one vote per user per idea via a unique constraint on `(userId, innovationId)` in `votes` and on `(userId, ideaId)` in `idea_votes`. The API SHALL reject a duplicate vote attempt and SHALL tolerate concurrent inserts.

#### Scenario: Duplicate vote rejected
- GIVEN a user who has already voted on an item
- WHEN they POST a vote on the same item again
- THEN the server responds with 400 Already voted

#### Scenario: Concurrent vote race
- GIVEN two simultaneous vote requests from the same user for the same item
- WHEN both pass the pre-check but the second insert violates the unique constraint
- THEN the second request catches the constraint violation and returns success with `alreadyVoted: true` rather than an error

### Requirement: Votes only on eligible items
The system SHALL allow voting only on items that exist and are `published`. A vote on a missing or non-published innovation or idea SHALL return HTTP 404.

#### Scenario: Vote on unpublished item
- GIVEN an innovation or idea that does not exist or whose status is not `published`
- WHEN an authenticated user POSTs a vote for it
- THEN the server responds with 404 (Innovation not found / Idea not found)

### Requirement: Removing a vote
The system SHALL let a user remove their existing vote on an item via DELETE. If the user has no vote on that item, the request SHALL return HTTP 404.

#### Scenario: Remove existing vote
- GIVEN a user who has voted on an item
- WHEN they DELETE the vote
- THEN the vote row is removed and the server responds with success

#### Scenario: Remove nonexistent vote
- GIVEN a user who has not voted on an item
- WHEN they DELETE a vote for it
- THEN the server responds with 404 Vote not found

### Requirement: Vote counts drive innovation ranking
The system SHALL compute innovation vote counts by aggregating the `votes` table and SHALL use them as the default ordering of the public innovations list.

#### Scenario: Default sort by votes
- GIVEN published innovations with differing vote totals
- WHEN a user loads the innovations list with the default sort
- THEN innovations are ordered by descending vote count

### Requirement: Idea vote threshold triggers development
The system SHALL, after a successful idea vote, count the idea's votes and compare against the configured `ideaVoteThreshold` (default 5). When an idea whose `specStatus` is `not_started` reaches or exceeds the threshold, the system SHALL advance its `specStatus` to `in_progress`, seed an opening facilitator chat message, and report the trigger in the vote response.

#### Scenario: Threshold reached
- GIVEN an idea with `specStatus` = `not_started` that is one vote below the threshold
- WHEN a user casts the vote that reaches the threshold
- THEN the idea's `specStatus` becomes `in_progress`
- AND the vote response includes `developmentTriggered: true`

#### Scenario: Below threshold
- GIVEN an idea below the vote threshold
- WHEN a user casts a vote that does not reach the threshold
- THEN the idea's `specStatus` is unchanged and the response includes `developmentTriggered: false`

### Requirement: My votes page
The system SHALL provide an authenticated "My Votes" page listing the innovations the current user has voted for, ordered by most recent vote, each shown with its current total vote count.

#### Scenario: Viewing my votes
- GIVEN a logged-in user who has voted on several innovations
- WHEN they open the My Votes page
- THEN their voted innovations are listed newest-vote-first with each item's total vote count
- AND if they have no votes, an empty state prompting them to browse innovations is shown
