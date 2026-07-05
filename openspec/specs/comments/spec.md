# Comments Specification

## Purpose
The comments capability provides threaded discussion attached to a single target — an innovation, an idea, or a catalog item. Authenticated users post top-level comments and one level of replies, list existing threads, and edit or delete their own comments. Each comment references exactly one target, a rule enforced in application code because the database schema alone permits any of the three foreign keys.

## Requirements

### Requirement: Authentication required
The system SHALL require an authenticated user for all comment operations (listing, posting, editing, deleting). Requests without a session SHALL be rejected with HTTP 401.

#### Scenario: Anonymous request rejected
- GIVEN a request with no authenticated user
- WHEN it GETs, POSTs, PATCHes, or DELETEs a comment
- THEN the server responds with 401 Unauthorized

### Requirement: Exactly one target
The system SHALL attach each comment to exactly one of `innovationId`, `ideaId`, or `catalogItemId`. This single-target invariant is enforced at the application level: each posting endpoint sets only its own target foreign key. Before creating a comment, the endpoint SHALL verify the referenced target exists.

#### Scenario: Comment created against its target only
- GIVEN a POST to the innovation, idea, or catalog comment endpoint
- WHEN the target exists and the content is valid
- THEN a comment row is inserted with only that endpoint's foreign key set and the others null

#### Scenario: Missing target
- GIVEN a POST for a target id that does not exist
- WHEN the endpoint verifies the target
- THEN it responds with 404 (Innovation not found / Idea not found / Catalog item not found)

### Requirement: Posting comments and validation
The system SHALL require non-empty comment `content`, trim it before storing, and reject content longer than 2000 characters. On success it SHALL return the created comment with author name and avatar and HTTP 201.

#### Scenario: Empty content rejected
- GIVEN a POST whose content is missing or only whitespace
- WHEN the endpoint validates it
- THEN it responds with 400 Comment content is required

#### Scenario: Overlong content rejected
- GIVEN a POST whose content exceeds 2000 characters
- WHEN the endpoint validates it
- THEN it responds with 400 Comment is too long (max 2000 characters)

### Requirement: Threaded replies
The system SHALL support one level of threading via a `parentId`. When a comment is posted as a reply, the system SHALL verify the parent comment exists and belongs to the same target. Listings SHALL return top-level comments each with their replies nested underneath.

#### Scenario: Valid reply
- GIVEN a POST with a `parentId` whose parent belongs to the same target
- WHEN the reply is created
- THEN it is stored with that `parentId` and appears nested under its parent when listed

#### Scenario: Parent mismatch
- GIVEN a POST with a `parentId` that does not exist or belongs to a different target
- WHEN the endpoint verifies the parent
- THEN it responds with 404 Parent comment not found

### Requirement: Listing comments
The system SHALL return the threaded comments for a target, grouping replies under their top-level parents. For innovations the response SHALL be bounded — top-level comments capped (50) and replies per parent capped (20) — and SHALL report the total reply count and how many replies were omitted per parent.

#### Scenario: Innovation thread bounded
- GIVEN an innovation with more replies on a comment than the per-parent cap
- WHEN the comments are listed
- THEN at most the capped number of replies are returned for that comment
- AND the response reports the total reply count and the number omitted

### Requirement: Editing own comments
The system SHALL allow only the comment's author to edit it via PATCH, applying the same content validation as posting, and SHALL set `updatedAt` on success. A non-author edit SHALL be rejected with HTTP 403.

#### Scenario: Author edits
- GIVEN the author of a comment
- WHEN they PATCH it with valid new content
- THEN the content is updated (trimmed) and `updatedAt` is set

#### Scenario: Non-author edit blocked
- GIVEN a user who is not the comment's author
- WHEN they PATCH the comment
- THEN the server responds with 403 Forbidden

### Requirement: Deleting comments cascades to replies
The system SHALL allow the comment's author or an admin to delete a comment. Deletion SHALL remove the comment together with all of its descendant replies (resolved via a recursive query). A delete by a non-author, non-admin SHALL be rejected with HTTP 403.

#### Scenario: Author deletes a thread
- GIVEN a comment with nested replies
- WHEN its author deletes it
- THEN the comment and all descendant replies are removed

#### Scenario: Admin deletes another user's comment
- GIVEN a comment authored by another user
- WHEN an admin deletes it
- THEN the deletion succeeds

#### Scenario: Unauthorized delete blocked
- GIVEN a non-admin user who is not the comment's author
- WHEN they attempt to delete it
- THEN the server responds with 403 Forbidden
