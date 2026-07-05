# Idea Development Specification

## Purpose
The idea-development capability turns a community-endorsed idea into a business specification through a guided AI conversation. Once an idea's votes cross a configurable threshold it enters development: an AI facilitator chats with participants to gather requirements, then synthesises a structured, business-language specification document. Participants can refine that document with AI assistance, roll back to earlier versions, generate HTML/CSS screen mockups, and download the spec. A completed specification is presented as "Ready". This capability covers everything up to a ready specification; the subsequent autonomous build and production-deploy stages are out of scope here.

## Requirements

### Requirement: Vote-threshold gating into development
The system SHALL, after each successful idea vote, count the idea's votes and compare them to the configured `ideaVoteThreshold` (default 5). When an idea whose `specStatus` is `not_started` reaches or exceeds the threshold, the system SHALL set `specStatus` to `in_progress` and insert a seeded AI facilitator opening message into `idea_chats`. The transition SHALL happen at most once and be reported back to the voting client.

#### Scenario: Threshold vote opens development
- GIVEN a published idea with `specStatus` = `not_started` one vote below the threshold
- WHEN a user casts the vote that reaches the threshold
- THEN `checkAndTriggerDevelopment` sets `specStatus` = `in_progress`
- AND an `ai`-role opening message is stored to start the refinement conversation
- AND the vote response reports `developmentTriggered: true`

### Requirement: Refinement chat conversation
The system SHALL persist the refinement conversation in `idea_chats` with a `role` of `ai` or `user` (user messages carrying the author's `userId`). While `specStatus` = `in_progress`, an authenticated user SHALL be able to post a message (max 8000 chars) and receive an AI facilitator reply that asks focused clarifying questions and is stored as an `ai` message. Posting to an idea that has not entered development SHALL return HTTP 409. If the opening AI message is ever missing when the page loads, the system SHALL regenerate it.

#### Scenario: User contributes to the conversation
- GIVEN an idea with `specStatus` = `in_progress`
- WHEN an authenticated user POSTs a chat message
- THEN the user message and the AI's reply are appended to `idea_chats`
- AND the reply asks further clarifying questions until enough detail is gathered

#### Scenario: Chat blocked before development
- GIVEN an idea with `specStatus` = `not_started`
- WHEN a user POSTs a chat message
- THEN the server responds 409 (idea has not entered the development stage)

### Requirement: AI specification generation
When the AI facilitator determines it has gathered enough detail it SHALL emit the sentinel `[[SPEC_READY]]`, which the system strips from the visible reply and uses to trigger spec generation asynchronously. Generation SHALL synthesise the full chat transcript and idea context into a Markdown specification using a fixed business-language section structure (numbered sections 1–7 covering what the app is, users, information, features with "how do we know it works", screens, business rules, and other requirements). On completion the system SHALL store `specDocument`, set `specStatus` = `completed`, and set `specReviewStatus` = `under_review`.

#### Scenario: Conversation completes into a spec
- GIVEN a refinement conversation that has reached sufficient detail
- WHEN the AI reply contains `[[SPEC_READY]]`
- THEN the sentinel is removed from the visible message and `generateSpecDocument` runs
- AND the idea gains a Markdown `specDocument` and `specStatus` becomes `completed`

### Requirement: Completed spec presented as Ready
The system SHALL present a completed specification to users as "Ready" — the development page header badge reads "Ready" and the idea banner reads "Specification Ready" — with no participant review-and-publish gate surfaced in the UI. The stored `specReviewStatus` column and the server-side publish endpoints (`approveAndPublishSpec`, `forcePublishSpec`, and `publishSpec`, which push the spec to Azure DevOps and Jira) remain in the codebase but are vestigial and not reachable from the current UI.

#### Scenario: Ready specification shown without a review gate
- GIVEN an idea with `specStatus` = `completed`
- WHEN a participant opens the development page
- THEN the status is shown as "Ready" / "Specification Ready"
- AND no "submit for review" or "approve & publish" control is presented

### Requirement: Tech-stack section derived for the build team
When a specification is sent to DevOps for build, the system SHALL, if admin `techStackRules` are configured, ask the AI to derive a tailored "Technical Implementation" section (recommended stack, constraints, and open questions) from the business requirements and those rules, and append it only to the document handed to DevOps. The `specDocument` stored in the database and shown to business reviewers SHALL never be modified by this step.

#### Scenario: Tech stack appended only for DevOps
- GIVEN a completed spec and configured `techStackRules`
- WHEN the spec is published to DevOps
- THEN an AI-derived Technical Implementation section is appended to the DevOps document
- AND the stored business `specDocument` is left unchanged

### Requirement: AI-assisted section editing (propose then apply)
The system SHALL let a participant edit the specification with a two-phase AI flow. The propose phase SHALL analyse the requested change (optionally scoped to a section) and return an analysis, the list of affected sections, and a complete proposed spec without persisting anything; the response payload SHALL be capped and flagged `truncated` when oversized. The apply phase SHALL persist an approved proposal. Both phases SHALL require that the caller is a participant (has sent at least one chat message), returning HTTP 403 otherwise. A legacy single-phase `spec-edit` endpoint that regenerates and saves the spec in one step also exists.

#### Scenario: Proposing a change previews without saving
- GIVEN a participant on an idea with a `specDocument`
- WHEN they POST an edit instruction to the propose endpoint
- THEN the AI returns analysis, affected sections, and a full proposed spec
- AND nothing is written to the database yet

#### Scenario: Non-participant blocked from editing
- GIVEN a user who has never sent a chat message on the idea
- WHEN they call the propose or apply endpoint
- THEN the server responds 403 Not a participant

### Requirement: Specification version history and rollback
Before overwriting `specDocument` on any AI edit, rollback, or apply, the system SHALL snapshot the prior content into `spec_versions` with an incrementing `versionNumber`, the author, and a change description. Participants SHALL be able to list versions (newest first, with author name) and roll back to any version; a rollback SHALL first snapshot the current document, restore the chosen version, and record the action in the chat.

#### Scenario: Edit snapshots previous version
- GIVEN a participant applying a spec edit
- WHEN the new document is saved
- THEN the previous `specDocument` is stored as a new `spec_versions` row with the next version number

#### Scenario: Rolling back restores a version
- GIVEN an idea with several spec versions
- WHEN a participant rolls back to a chosen version
- THEN the current document is snapshotted, the chosen version's content becomes the active `specDocument`, and a chat entry notes the rollback

### Requirement: AI-rendered screen mockups
The system SHALL let a participant generate a set of self-contained HTML/CSS screen mockups from a completed specification, stored in `specMockups` as `{ generatedAt, designSystem, screens[] }`. Mockup generation SHALL require `specStatus` = `completed` and participant status. Participants SHALL be able to regenerate a single screen from the current spec so the visual reflects later spec changes.

#### Scenario: Generating mockups from the spec
- GIVEN a participant on an idea with a completed spec
- WHEN they POST to the mockups endpoint
- THEN a set of screen mockups is generated and stored in `specMockups`
- AND requesting mockups before the spec is completed returns HTTP 400

#### Scenario: Regenerating one screen
- GIVEN an existing mockup set
- WHEN a participant regenerates a single screen by its mockup id
- THEN only that screen is re-rendered from the current spec and the set is updated

### Requirement: Downloading the specification
The system SHALL let any authenticated user download an idea's specification as a Markdown file attachment named `{slug}-specification.md`. When the idea has no `specDocument` the download SHALL return HTTP 404.

#### Scenario: Downloading a ready spec
- GIVEN an authenticated user and an idea with a `specDocument`
- WHEN they GET the spec-download endpoint
- THEN they receive the Markdown document as a `.md` file attachment

### Requirement: Development listing
The system SHALL provide an authenticated development view listing all `published` ideas whose `specStatus` is `in_progress` or `completed`, partitioned into buckets (in-progress refinement, ready/under-review, building, and deployed) using each idea's `specStatus` and, when present, its linked build workspace status. Ideas the current user has voted on SHALL be surfaced first as a relevance signal.

#### Scenario: Viewing ideas in development
- GIVEN published ideas at various development stages
- WHEN an authenticated user opens the development page
- THEN ideas are grouped by stage (in progress, ready, building, deployed)
- AND ideas the user voted on appear first
