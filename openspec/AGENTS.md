# OpenSpec Conventions

This repository documents its behavior using **OpenSpec**: agreed specifications
live in the repo alongside the code, organized by capability. Read `project.md`
for the system overview before working with specs.

## Directory layout

```
openspec/
├── project.md            # system context (stack, architecture, conventions)
├── AGENTS.md             # this file — how to write specs
├── specs/                # SOURCE OF TRUTH: current, shipped behavior
│   └── <capability>/
│       └── spec.md
└── changes/              # proposed changes (deltas), archived when shipped
    ├── <change-id>/
    │   ├── proposal.md   # Why + What (Intent / Scope / Approach)
    │   ├── tasks.md      # implementation checklist (1.1, 1.2, …)
    │   ├── design.md     # optional: technical approach & decisions
    │   └── specs/<capability>/spec.md   # deltas (see below)
    └── archive/
        └── YYYY-MM-DD-<change-id>/
```

## Spec format (`specs/<capability>/spec.md`)

```markdown
# <Capability Title> Specification

## Purpose
<2–4 sentences: what this capability does and why it exists.>

## Requirements

### Requirement: <Short imperative name>
The system SHALL <behavior>. <Optional detail using MUST / SHOULD / MAY.>

#### Scenario: <concrete case>
- GIVEN <precondition>
- WHEN <action or trigger>
- THEN <observable outcome>
- AND <further outcome>   (optional)
```

Rules:

- **Every requirement MUST have at least one scenario.**
- Use RFC-2119 keywords: **SHALL/MUST** (mandatory), **SHOULD** (recommended),
  **MAY** (optional).
- Scenarios use **GIVEN / WHEN / THEN / AND** bullet steps.
- Requirements are the "what"; scenarios are concrete, testable examples.
- Keep it grounded in the actual code — do not invent behavior.

## Change deltas (`changes/<id>/specs/<capability>/spec.md`)

Only the delta is written, under these headers:

- `## ADDED Requirements` — new requirements (appended to the spec on archive)
- `## MODIFIED Requirements` — restate the **complete** updated requirement
  (replaces the existing one)
- `## REMOVED Requirements` — with a `Reason:` line
- `## RENAMED Requirements` — `From: <old>` / `To: <new>`

## Workflow

1. Draft a change under `changes/<id>/` (proposal + tasks + spec deltas).
2. Implement against the tasks.
3. On completion, merge the deltas into `specs/` and move the change to
   `changes/archive/YYYY-MM-DD-<id>/`.
