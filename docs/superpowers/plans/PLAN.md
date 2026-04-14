# Autonomous Application Builder - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an autonomous application-building pipeline that takes a SPECIFICATION.md, uses OpenCode AI agents to plan, review, build, test, and deploy a SvelteKit/SQLite/TailwindCSS application into a versioned workspace, served by the Innovation Portal.

**Architecture:** A Node.js orchestrator script (`builder.ts`) drives the entire pipeline. It creates an isolated workspace directory (`./workspaces/{uuid}`), scaffolds a SvelteKit project, then uses the OpenCode SDK to programmatically invoke AI agents for planning, reviewing, building, testing, and deploying. Each specification edit triggers a new version. Every version is independently deployed into its own `versions/v{n}/deployment/` directory, so all versions remain live and accessible simultaneously. Users can compare, test, and work with multiple versions at once. The Innovation Portal serves them under `/apps/{uuid}/v{n}/`.

**Tech Stack:** Node.js orchestrator, OpenCode CLI (`opencode run`), SvelteKit 2 + Svelte 5, SQLite (better-sqlite3 + Drizzle ORM), TailwindCSS 4, Vitest for testing.

**Patterns adopted from existing harnesses:**
- **GSD-OpenCode:** STATE.md for cross-session memory, per-task `<verify>` steps, fresh context per task, wave-based parallelism where possible
- **Spec-Kit:** Separate clarification phase before planning, split architecture (PLAN.md) from tasks (TASKS.md), phantom-completion detection
- **Oh-My-OpenAgent:** Loop-until-done semantics for test-fix phase, model specialization (stronger model for planning, faster for execution)

---

## Chunk 1: System Architecture & Design Decisions

### 1.1 Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Orchestrator language | TypeScript (Node.js) | Same as Innovation Portal; runs with `tsx` already in devDependencies |
| AI Agent interface | OpenCode CLI (`opencode run`) | CLI is simpler for autonomous scripting than SDK server; v1.3.13 installed; `--format json` for machine parsing |
| Workspace isolation | `./workspaces/{uuid}/` | Each workspace is a self-contained SvelteKit project with its own `node_modules`, `package.json`, DB, and build output |
| Versioning strategy | `./workspaces/{uuid}/versions/{v1,v2,...}/` each with own `deployment/` | Each spec edit creates a new version directory; all versions deployed independently and accessible simultaneously |
| Deployment mechanism | SvelteKit `adapter-node` built with `BASE_PATH=/apps/{uuid}/v{n}`, output deployed to `./workspaces/{uuid}/versions/v{n}/deployment/` | Each version self-contained; users can test/compare multiple versions at once |
| Integration with Portal | New SvelteKit route `/apps/[uuid]/[...path]` that proxies to the workspace's built Node app | Reuses Portal's auth and hostname |
| Mocked integrations | All external APIs (Gemini, OIDC, Jira, ADO) stubbed with in-memory/SQLite mocks | Per requirement #2 |
| Test framework | Vitest (unit + integration) | Standard for SvelteKit projects |

### 1.2 Directory Structure

```
innovation-incubator-opus/
├── workspaces/                          # NEW: All generated apps live here
│   └── {uuid}/                          # One workspace per spec
│       ├── SPECIFICATION.md             # User's spec document (source of truth)
│       ├── metadata.json               # Workspace metadata (uuid, versions, timestamps, status)
│       └── versions/                    # Version history (all versions live simultaneously)
│           ├── v1/                      # First version (complete SvelteKit project)
│           │   ├── SPECIFICATION.md    # Copy of spec for this version
│           │   ├── CLARIFICATIONS.md   # AI-resolved ambiguities (from spec-kit pattern)
│           │   ├── PLAN.md             # Architecture decisions (from spec-kit: separate from tasks)
│           │   ├── TASKS.md            # Ordered atomic task list with dependencies + verify steps
│           │   ├── STATE.md            # Cross-session memory: decisions, progress (from GSD pattern)
│           │   ├── package.json
│           │   ├── src/
│           │   ├── build/              # Production build output
│           │   ├── deployment/         # Deployed artifacts for this version
│           │   └── ...
│           ├── v2/                      # After spec edit (also independently deployed)
│           │   ├── ...
│           │   └── deployment/         # v2's own deployment
│           └── ...
│
├── src/
│   └── routes/
│       └── apps/                        # NEW: Route for serving workspace apps
│           └── [...path]/
│               └── +server.ts           # Serves files from versions/{n}/deployment/
│
├── scripts/
│   ├── builder.ts                       # NEW: Main orchestrator script
│   ├── workspace-manager.ts             # NEW: Workspace CRUD operations
│   ├── opencode-agent.ts                # NEW: OpenCode CLI wrapper
│   ├── app-proxy.ts                     # NEW: Proxy/serve workspace apps
│   └── version-manager.ts              # NEW: Version management
```

### 1.3 File Responsibilities

| File | Responsibility |
|------|---------------|
| `scripts/builder.ts` | Main entry point. Orchestrates the full pipeline: create workspace, scaffold project, invoke AI agents for each phase, handle errors, report status |
| `scripts/workspace-manager.ts` | Create workspace dirs, manage `metadata.json`, list workspaces, resolve paths |
| `scripts/opencode-agent.ts` | Wraps `opencode run` CLI calls. Sends prompts, captures JSON output, handles timeouts and errors |
| `scripts/version-manager.ts` | Create new versions from spec edits, copy/build projects, track version history |
| `scripts/app-proxy.ts` | HTTP proxy logic: forward requests from Portal route to workspace's running Node app |
| `src/routes/apps/[uuid]/[...path]/+server.ts` | SvelteKit catch-all route that serves files from `versions/v{n}/deployment/` |
| `workspaces/{uuid}/metadata.json` | JSON file tracking workspace state: uuid, spec hash, versions array, current version, per-version deployment status |

---

## Chunk 2: Pipeline Phases (Steps 1-7: Planning & Review)

### 2.1 Pipeline Overview

The builder runs these phases sequentially. Patterns adopted from GSD, Spec-Kit, and OmO are marked.

```
Phase 0:  Specification Interview (GSD /gsd-new-project + spec-kit /speckit.specify pattern)
Phase 1:  Workspace Creation
Phase 2:  Project Scaffolding + Verify Template Builds
Phase 3:  AI Clarification (spec-kit pattern: surface ambiguities before planning)
Phase 4:  AI Architecture Plan → PLAN.md (spec-kit pattern: separate from tasks)
Phase 5:  AI Task Decomposition → TASKS.md (spec-kit pattern: ordered, atomic, with dependencies)
Phase 6:  AI Critical Review (covers both PLAN.md and TASKS.md)
Phase 7:  AI Spec Compliance Check (spec-kit /analyze: cross-artifact consistency)
Phase 8:  AI Final Review
Phase 9:  Layered Build (fresh context per layer, per-task <verify> from GSD)
Phase 10: Loop-Until-Done Test Fix (OmO Ralph Loop pattern: not retry N times, but loop until done or budget exhausted)
Phase 11: Phantom-Completion Detection (spec-kit verify-tasks: check tests have real assertions)
Phase 12: Deploy to Workspace
Phase 13: Serve via Portal
Phase 14: Push to Git Repository (create repo, push source + docs, branch per version)
Phase 15: Create Jira Issue (link to deployed app + git repo)
Phase 16: Version Management (on spec edits → new branch per version)
```

### 2.2 Artifacts Produced Per Version (adopted patterns)

| Artifact | Source Pattern | Purpose |
|----------|--------------|---------|
| `CLARIFICATIONS.md` | Spec-Kit `/clarify` | Ambiguities found in spec + how AI resolved them. User can review and correct. |
| `PLAN.md` | Spec-Kit `/plan` | Architecture decisions: schema, route structure, component tree, integration mocking strategy. NOT individual tasks. |
| `TASKS.md` | Spec-Kit `/tasks` + GSD XML | Ordered atomic task list. Each task has: name, files, action, `<verify>` command, `<done>` criteria, dependencies. |
| `STATE.md` | GSD STATE.md | Running log of decisions, resolved blockers, progress. Updated after each agent call. Carried into next agent's context. |
| `TECH_REFERENCE.md` | Our own | Syntax cheat-sheet injected into every build prompt. |

### Task 0: Specification Interview System

**Files:**
- Create: `scripts/spec-interviewer.ts`
- Create: `scripts/spec-template.md`

The specification interview is the **only phase that requires user interaction**. All subsequent phases are autonomous. The interview must produce a SPECIFICATION.md structured enough for the builder pipeline to consume.

#### 2.3.1 Required Specification Structure

Every SPECIFICATION.md must contain these sections. The interview drives toward filling all of them.
**The language is deliberately non-technical** — these specs are written by business department users, not developers. Technical concepts (routes, data models, responsive breakpoints) are the AI's job to derive during planning, not the user's job to specify.

```markdown
# {Application Name}

## 1. What is this application?
{One paragraph in plain language: what problem does it solve, who will use it, 
why is it needed.}

## 2. Who will use it?
{For each type of user:}
- **{Role name}** — what they need to do in the application
{If everyone has the same access, say "All users have the same access."}

## 3. What information does the application work with?
{Describe the "things" the application manages, in business terms.}
{For each thing: what it is, what details it has, how it relates to other things.}
Example:
- **Request**: has a title, description, priority (low/medium/high), 
  current status (new/in progress/completed), who submitted it, when it was submitted
- **Comment**: text, who wrote it, which request it belongs to

## 4. What should the application do?
{For each feature, describe it as a user story:}

### {Feature name}
- **What the user does:** {describe the action in plain language}
- **What should happen:** {describe the expected result}
- **What if something goes wrong:** {describe error scenarios}
- **How do we know it works:** {a simple test anyone can perform}
  Example: "I can add a new request with just a title, and it appears in my list immediately"

## 5. What screens does the application need?
{For each screen:}

### {Screen name}
- **What is it for:** {purpose in one sentence}
- **What does it show:** {what information the user sees}
- **What can the user do here:** {buttons, forms, actions available}
- **Where can the user go from here:** {links to other screens}

## 6. Business rules and constraints
{Rules that the application must enforce. Things like:}
- {A request title must not be empty}
- {Only administrators can delete requests}
- {A request cannot be re-opened once completed}

## 7. Any other requirements?
{Optional. Anything else that matters:}
- Should it work on mobile phones? {yes/no}
- Roughly how many users will use it? {gives AI a sense of scale}
- Any branding or style preferences? {colors, look and feel}
- Should it support multiple languages? {yes/no}
```

**What the AI derives from this (not the user's job):**
The spec uses business language. The AI translates during the planning phase:
- "What information does it work with?" → Drizzle ORM database schema
- "What screens does it need?" → SvelteKit routes and page components
- "Should it work on mobile?" → responsive TailwindCSS design
- "How do we know it works?" → Vitest test assertions

#### 2.3.2 Interview Script (`scripts/spec-interviewer.ts`)

The interviewer uses OpenCode SDK's session API to conduct a multi-turn conversation with the user. It asks questions round by round, filling in the spec sections.

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { runAgent } from './opencode-agent.ts';

const SPEC_TEMPLATE = readFileSync(resolve(import.meta.dirname, 'spec-template.md'), 'utf-8');

interface InterviewState {
  round: number;
  userInput: string;        // initial idea from user
  collectedInfo: string;    // accumulated Q&A transcript
  specDraft: string;        // current spec draft
  sectionsComplete: Record<string, boolean>;
}

/**
 * Run the specification interview.
 * This is the ONLY interactive phase — all subsequent phases are autonomous.
 *
 * The interview follows this flow:
 * 1. User provides initial idea (could be 1 sentence or a full document)
 * 2. AI asks targeted questions to fill required sections
 * 3. AI writes structured SPECIFICATION.md
 * 4. AI checks for completeness — asks more questions if gaps remain
 * 5. User reviews and approves
 *
 * The interview is conducted via OpenCode's session, so the user
 * interacts through the Portal's UI (spec editor textarea + chat).
 */
export async function conductInterview(
  initialInput: string,
  outputPath: string,
  workDir: string
): Promise<string> {
  
  const sections = [
    'what_is_it', 'who_uses_it', 'what_info',
    'what_it_does', 'screens', 'rules', 'other'
  ];

  // Round 1: Analyze what the user already provided
  const analysisPrompt = `You are a friendly product consultant helping a business person
describe the application they want built. They are NOT a developer — do not use
technical jargon. Speak in plain business language.

Here is what they told you:
---
${initialInput}
---

Analyze what they've told you against what we need to know:
1. What is this application? — Do we understand the purpose?
2. Who will use it? — Do we know the different types of users?
3. What information does it manage? — Do we know the "things" the app tracks?
4. What should it do? — Do we have specific features described?
5. What screens are needed? — Do we know what the user will see?
6. Business rules? — Do we know any constraints or requirements?
7. Anything else? — Mobile support, number of users, style preferences?

For each area, rate: CLEAR / NEEDS MORE DETAIL / NOT MENTIONED.

Then write questions to fill the gaps. Ask about NOT MENTIONED and NEEDS MORE DETAIL only.
Ask at most 5 questions per round. Be specific and conversational.

BAD question: "Can you elaborate on the features?"
BAD question: "What data entities does the application manage?"
GOOD question: "When someone adds a new request, what information should they fill in?
  For example: just a title, or also a description, priority level, deadline?"
GOOD question: "You mentioned managers and staff — should managers see everything, 
  or only their own department's data?"

Write questions as if you're sitting across the table from a colleague.

Output format:
## What We Know So Far
| Area | Status | Notes |
|------|--------|-------|

## Questions
1. {question}
2. {question}
...`;

  const analysis = await runAgent(analysisPrompt, { workDir, timeout: 5 * 60 * 1000 });

  // The actual interview loop happens in the Portal UI:
  // - The analysis and questions are shown to the user
  // - The user answers in the spec editor or chat
  // - The AI processes answers and either asks more questions or drafts the spec
  //
  // This is orchestrated by the Portal's /apps/[uuid] page,
  // not by this script directly. This script provides the prompts.

  // Round 2+: After user answers, generate spec draft
  const draftPrompt = `Based on the conversation below, write a complete SPECIFICATION.md.

Use this EXACT template structure — keep the language simple and non-technical.
The spec is written FOR business people, not developers.
${SPEC_TEMPLATE}

User's original idea:
---
${initialInput}
---

Conversation so far:
---
{Q&A transcript will be injected here by the Portal}
---

RULES:
- Write in plain business language. No jargon. No "routes", "endpoints", "components".
- Fill in EVERY section. If the user didn't specify something, make a reasonable default
  and mark it with "(assumed — please change if this is wrong)" so they can spot it.
- "What should the application do?" features MUST each have a "How do we know it works"
  test written as something a person (not a computer) would check.
  GOOD: "I can add a new request with just a title, and it appears in my list immediately"
  BAD: "The POST /api/requests endpoint returns 201"
- "What information does it work with?" MUST list every type of thing the app manages,
  described the way the user would describe it (not as database tables).
- "What screens are needed?" should describe what the user SEES and DOES,
  not technical page structures.
- Be SPECIFIC. "User can manage tasks" is too vague.
  "User can create a new task by typing a title and clicking Add" is good.

Write the complete SPECIFICATION.md.`;

  // Completeness check — also in business language
  const completenessPrompt = `Review this SPECIFICATION.md as if you are handing it to a 
colleague to check. Is there enough detail to actually build this?

Check:
1. Does every feature have a "How do we know it works" test?
   (not just "it should work" but a specific thing to try)
2. Does every screen describe what the user sees and what they can do?
3. Does "What information does it work with" cover every type of thing 
   mentioned in the features?
4. Are there features that mention things not listed in the information section?
5. Are the business rules specific enough to follow?
   ("titles can't be empty" = good. "proper validation" = too vague)

If ANY gaps found, write follow-up questions in plain language.
If COMPLETE, respond with "SPECIFICATION COMPLETE — ready to build."`;

  return draftPrompt; // The actual flow is managed by the Portal UI
}
```

#### 2.3.3 Sufficiency Checklist

Before the builder pipeline starts, the spec must pass this machine-checkable gate:

```typescript
/**
 * Verify a specification has all required sections with real content.
 * Section headings use business-friendly language, not developer jargon.
 * Returns { valid: boolean, missing: string[] }
 */
export function validateSpec(specContent: string): { valid: boolean; missing: string[] } {
  const required = [
    { 
      section: 'What is this application?', 
      pattern: /##\s*1\.\s*What is this application/i, 
      minLength: 50,
      userMessage: 'Please describe what the application does and why it is needed.'
    },
    { 
      section: 'Who will use it?', 
      pattern: /##\s*2\.\s*Who will use it/i, 
      minLength: 30,
      userMessage: 'Please describe who will use the application and what they need to do.'
    },
    { 
      section: 'What information does it work with?', 
      pattern: /##\s*3\.\s*What information/i, 
      minLength: 50,
      userMessage: 'Please describe the things the application keeps track of (requests, tasks, items, etc.).'
    },
    { 
      section: 'What should the application do?', 
      pattern: /##\s*4\.\s*What should the application do/i, 
      minLength: 100,
      userMessage: 'Please describe the features — what can users do, and what happens when they do it?'
    },
    { 
      section: 'What screens does it need?', 
      pattern: /##\s*5\.\s*What screens/i, 
      minLength: 50,
      userMessage: 'Please describe what screens (pages) the application needs and what users see on each one.'
    },
    { 
      section: 'Business rules and constraints', 
      pattern: /##\s*6\.\s*Business rules/i, 
      minLength: 20,
      userMessage: 'Please add any rules the application must enforce (e.g., "a title cannot be empty").'
    },
  ];

  const missing: string[] = [];

  for (const req of required) {
    const match = specContent.match(req.pattern);
    if (!match) {
      missing.push(req.userMessage);
      continue;
    }
    // Check section has content (rough: count chars until next ## or EOF)
    const startIdx = match.index! + match[0].length;
    const nextSection = specContent.indexOf('\n## ', startIdx);
    const sectionContent = nextSection > 0
      ? specContent.slice(startIdx, nextSection).trim()
      : specContent.slice(startIdx).trim();
    if (sectionContent.length < req.minLength) {
      missing.push(`${req.section}: needs more detail. ${req.userMessage}`);
    }
  }

  // Check that features have testable success criteria
  const featureSections = specContent.match(/###\s+.+/g) || [];
  const hasCriteria = (specContent.match(/how do we know it works/gi) || []).length;
  const featureCount = featureSections.filter(h => 
    !h.match(/screen|page|rule/i) // exclude non-feature sub-headings
  ).length;
  
  if (featureCount > 0 && hasCriteria < Math.max(1, Math.floor(featureCount * 0.5))) {
    missing.push(
      'Some features are missing a "How do we know it works" check. ' +
      'For each feature, describe a simple test anyone could try — for example: ' +
      '"I can add a new item and it appears in the list immediately."'
    );
  }

  return { valid: missing.length === 0, missing };
}
```

This validation runs before Phase 1 (workspace creation). If it fails, the user sees **plain-language messages** explaining what to add — no technical jargon. The pipeline does not start with an incomplete spec.

- [ ] **Step 1: Create spec-template.md with required structure**
- [ ] **Step 2: Create spec-interviewer.ts with interview flow**
- [ ] **Step 3: Create validateSpec() function**
- [ ] **Step 4: Integrate validation gate into builder.ts (reject incomplete specs)**
- [ ] **Step 5: Update Portal UI to support interview mode**
- [ ] **Step 6: Commit**

```bash
git add scripts/spec-interviewer.ts scripts/spec-template.md
git commit -m "feat: add specification interview system with required structure validation"
```

---

### Task 1: Workspace Manager (`scripts/workspace-manager.ts`)

**Files:**
- Create: `scripts/workspace-manager.ts`

- [ ] **Step 1: Write workspace-manager.ts**

```typescript
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'fs';
import { join, resolve } from 'path';

const WORKSPACES_ROOT = resolve(import.meta.dirname, '..', 'workspaces');

export interface WorkspaceMetadata {
  uuid: string;
  createdAt: string;
  specHash: string;
  versions: VersionInfo[];
  currentVersion: number;
  status: 'creating' | 'planning' | 'reviewing' | 'building' | 'testing' | 'deploying' | 'deployed' | 'error';
  error?: string;
  port?: number;
}

export interface VersionInfo {
  version: number;
  createdAt: string;
  specHash: string;
  status: 'building' | 'built' | 'deployed' | 'error';
  buildLog?: string;
}

export function createWorkspace(specContent: string): WorkspaceMetadata {
  const uuid = randomUUID();
  const wsDir = join(WORKSPACES_ROOT, uuid);
  
  // Create directory structure
  mkdirSync(wsDir, { recursive: true });
  mkdirSync(join(wsDir, 'versions'), { recursive: true });
  
  // Write spec
  writeFileSync(join(wsDir, 'SPECIFICATION.md'), specContent, 'utf-8');
  
  // Create metadata
  const metadata: WorkspaceMetadata = {
    uuid,
    createdAt: new Date().toISOString(),
    specHash: simpleHash(specContent),
    versions: [],
    currentVersion: 0,
    status: 'creating'
  };
  
  writeFileSync(join(wsDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');
  
  return metadata;
}

export function getWorkspacePath(uuid: string): string {
  return join(WORKSPACES_ROOT, uuid);
}

export function getVersionPath(uuid: string, version: number): string {
  return join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`);
}

export function getDeploymentPath(uuid: string, version: number): string {
  return join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'deployment');
}

export function updateMetadata(uuid: string, updates: Partial<WorkspaceMetadata>): WorkspaceMetadata {
  const metaPath = join(WORKSPACES_ROOT, uuid, 'metadata.json');
  const existing = JSON.parse(readFileSync(metaPath, 'utf-8')) as WorkspaceMetadata;
  const updated = { ...existing, ...updates };
  writeFileSync(metaPath, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function readMetadata(uuid: string): WorkspaceMetadata {
  const metaPath = join(WORKSPACES_ROOT, uuid, 'metadata.json');
  return JSON.parse(readFileSync(metaPath, 'utf-8')) as WorkspaceMetadata;
}

export function listWorkspaces(): WorkspaceMetadata[] {
  if (!existsSync(WORKSPACES_ROOT)) return [];
  const { readdirSync } = require('fs');
  return readdirSync(WORKSPACES_ROOT, { withFileTypes: true })
    .filter((d: any) => d.isDirectory())
    .map((d: any) => {
      try { return readMetadata(d.name); }
      catch { return null; }
    })
    .filter(Boolean) as WorkspaceMetadata[];
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsx --eval "import './scripts/workspace-manager.ts'"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add scripts/workspace-manager.ts
git commit -m "feat: add workspace manager for isolated app workspaces"
```

---

### Task 2: OpenCode Agent Wrapper (`scripts/opencode-agent.ts`)

**Files:**
- Create: `scripts/opencode-agent.ts`

- [ ] **Step 1: Write opencode-agent.ts**

```typescript
import { execSync, exec } from 'child_process';
import { join } from 'path';

export interface AgentResponse {
  success: boolean;
  output: string;
  error?: string;
  sessionId?: string;
}

export interface AgentOptions {
  workDir: string;
  model?: string;
  timeout?: number;       // ms, default 10 minutes
  sessionId?: string;     // continue existing session
}

const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const MAX_TIMEOUT = 60 * 60 * 1000;     // 60 minutes for build tasks

/**
 * Run an OpenCode agent with a prompt, working in a specific directory.
 * Uses `opencode run` CLI for autonomous, non-interactive execution.
 */
export async function runAgent(prompt: string, options: AgentOptions): Promise<AgentResponse> {
  const { workDir, model, timeout = DEFAULT_TIMEOUT, sessionId } = options;
  
  // Build command
  const args = ['opencode', 'run'];
  
  if (sessionId) {
    args.push('--session', sessionId);
  }
  
  if (model) {
    args.push('--model', model);
  }
  
  // Use default format for readable output
  args.push(JSON.stringify(prompt));
  
  const cmd = args.join(' ');
  
  console.log(`[agent] Running in ${workDir}`);
  console.log(`[agent] Prompt: ${prompt.substring(0, 200)}...`);
  
  try {
    const output = execSync(cmd, {
      cwd: workDir,
      timeout,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      env: {
        ...process.env,
        // Auto-approve all tool calls for autonomous operation
        OPENCODE_PERMISSION: JSON.stringify({
          allow: ["*"]
        })
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return {
      success: true,
      output: output.trim()
    };
  } catch (err: any) {
    return {
      success: false,
      output: err.stdout?.toString() || '',
      error: err.stderr?.toString() || err.message
    };
  }
}

/**
 * Run agent with extended timeout for build tasks.
 */
export async function runBuildAgent(prompt: string, options: AgentOptions): Promise<AgentResponse> {
  return runAgent(prompt, { ...options, timeout: options.timeout || MAX_TIMEOUT });
}

/**
 * Run a shell command in the workspace directory.
 */
export function runShell(command: string, workDir: string, timeout = 120_000): string {
  return execSync(command, {
    cwd: workDir,
    timeout,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024
  }).trim();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsx --eval "import './scripts/opencode-agent.ts'"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add scripts/opencode-agent.ts
git commit -m "feat: add OpenCode CLI agent wrapper for autonomous AI tasks"
```

---

### Task 3: Version Manager (`scripts/version-manager.ts`)

**Files:**
- Create: `scripts/version-manager.ts`

- [ ] **Step 1: Write version-manager.ts**

```typescript
import { mkdirSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getWorkspacePath, getVersionPath, getDeploymentPath, updateMetadata, readMetadata } from './workspace-manager.ts';
import type { VersionInfo } from './workspace-manager.ts';

/**
 * Create a new version directory for a workspace.
 * If previousVersion exists, copies it as a starting point.
 */
export function createVersion(uuid: string, specContent: string): { version: number; versionPath: string } {
  const metadata = readMetadata(uuid);
  const newVersion = metadata.currentVersion + 1;
  const versionPath = getVersionPath(uuid, newVersion);
  
  // If there's a previous version, copy it as base
  if (newVersion > 1) {
    const prevPath = getVersionPath(uuid, newVersion - 1);
    if (existsSync(prevPath)) {
      cpSync(prevPath, versionPath, { 
        recursive: true,
        filter: (src) => {
          // Skip node_modules and build directories during copy
          return !src.includes('node_modules') && !src.includes('/build/');
        }
      });
    }
  } else {
    mkdirSync(versionPath, { recursive: true });
  }
  
  // Write updated spec into version directory
  writeFileSync(join(versionPath, 'SPECIFICATION.md'), specContent, 'utf-8');
  
  // Update metadata
  const versionInfo: VersionInfo = {
    version: newVersion,
    createdAt: new Date().toISOString(),
    specHash: simpleHash(specContent),
    status: 'building'
  };
  
  updateMetadata(uuid, {
    currentVersion: newVersion,
    versions: [...metadata.versions, versionInfo]
  });
  
  return { version: newVersion, versionPath };
}

/**
 * Mark a version as successfully built.
 */
export function markVersionBuilt(uuid: string, version: number): void {
  const metadata = readMetadata(uuid);
  const versions = metadata.versions.map(v => 
    v.version === version ? { ...v, status: 'built' as const } : v
  );
  updateMetadata(uuid, { versions });
}

/**
 * Deploy a specific version into its own deployment directory.
 * Each version is independently deployed - all versions stay live simultaneously.
 */
export function deployVersion(uuid: string, version: number): string {
  const versionPath = getVersionPath(uuid, version);
  const buildPath = join(versionPath, 'build');
  const deployPath = getDeploymentPath(uuid, version);
  
  if (!existsSync(buildPath)) {
    throw new Error(`Build output not found at ${buildPath}`);
  }
  
  // Copy build output to deployment
  mkdirSync(deployPath, { recursive: true });
  cpSync(buildPath, deployPath, { recursive: true });
  
  // Also copy node_modules for runtime (adapter-node needs them)
  const nodeModulesPath = join(versionPath, 'node_modules');
  if (existsSync(nodeModulesPath)) {
    cpSync(nodeModulesPath, join(deployPath, 'node_modules'), { recursive: true });
  }
  
  // Copy package.json for runtime
  const pkgPath = join(versionPath, 'package.json');
  if (existsSync(pkgPath)) {
    cpSync(pkgPath, join(deployPath, 'package.json'));
  }
  
  // Update metadata - mark this version as deployed (all versions stay live independently)
  const metadata = readMetadata(uuid);
  const versions = metadata.versions.map(v => 
    v.version === version ? { ...v, status: 'deployed' as const } : v
  );
  // Workspace status reflects latest activity; all deployed versions remain accessible
  updateMetadata(uuid, { versions, status: 'deployed' });
  
  return deployPath;
}

/**
 * List all available versions for a workspace.
 */
export function listVersions(uuid: string): VersionInfo[] {
  return readMetadata(uuid).versions;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/version-manager.ts
git commit -m "feat: add version manager for workspace version tracking"
```

---

## Chunk 3: Scaffold Template (Concrete, Not Described)

### Task 4: SvelteKit Project Scaffold Template

**Files:**
- Create: `scripts/scaffold-template/package.json`
- Create: `scripts/scaffold-template/svelte.config.js`
- Create: `scripts/scaffold-template/vite.config.ts`
- Create: `scripts/scaffold-template/tsconfig.json`
- Create: `scripts/scaffold-template/src/app.html`
- Create: `scripts/scaffold-template/src/app.css`
- Create: `scripts/scaffold-template/src/app.d.ts`
- Create: `scripts/scaffold-template/src/routes/+page.svelte`
- Create: `scripts/scaffold-template/src/lib/server/db/index.ts`
- Create: `scripts/scaffold-template/drizzle.config.ts`
- Create: `scripts/scaffold-template/vitest.config.ts`
- Create: `scripts/scaffold-template/TECH_REFERENCE.md`

Rather than having the AI scaffold from scratch each time (slow, error-prone), we provide a **complete, working, verified** SvelteKit template. This eliminates the #1 cause of autonomous build failures: broken project config.

**Critical:** The template must `npm run build` successfully BEFORE any AI touches it. This is verified in Task 4 Step 3.

- [ ] **Step 1: Create all scaffold template files with exact content**

**`scripts/scaffold-template/package.json`:**
```json
{
  "name": "workspace-app",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "prepare": "svelte-kit sync",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@sveltejs/adapter-node": "^5.5.3",
    "better-sqlite3": "^12.6.2",
    "drizzle-orm": "^0.45.1",
    "nanoid": "^5.1.6"
  },
  "devDependencies": {
    "@sveltejs/kit": "^2.54.0",
    "@sveltejs/vite-plugin-svelte": "^6.2.4",
    "@tailwindcss/vite": "^4.2.0",
    "@tailwindcss/typography": "^0.5.19",
    "@types/better-sqlite3": "^7.6.13",
    "drizzle-kit": "^0.31.9",
    "svelte": "^5.53.11",
    "svelte-check": "^4.3.6",
    "tailwindcss": "^4.2.0",
    "typescript": "^5.9.3",
    "vite": "^7.3.1",
    "vitest": "^3.2.1"
  }
}
```

**`scripts/scaffold-template/svelte.config.js`:**
```javascript
import adapter from '@sveltejs/adapter-node';

function normalizeBasePath(path) {
  if (!path) return '';
  path = path.replace(/\/+$/, '');
  if (!path.startsWith('/')) path = '/' + path;
  return path;
}

const basePath = normalizeBasePath(process.env.BASE_PATH);

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({ out: 'build' }),
    paths: { base: basePath }
  }
};

export default config;
```

**`scripts/scaffold-template/vite.config.ts`:**
```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: { host: '0.0.0.0' },
  test: {
    include: ['src/**/*.test.{js,ts}'],
    environment: 'node'
  }
});
```

**`scripts/scaffold-template/tsconfig.json`:**
```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

**`scripts/scaffold-template/src/app.html`:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  %sveltekit.head%
</head>
<body data-sveltekit-preload-data="hover">
  <div style="display: contents">%sveltekit.body%</div>
</body>
</html>
```

**`scripts/scaffold-template/src/app.css`:**
```css
@import "tailwindcss";
```

**`scripts/scaffold-template/src/app.d.ts`:**
```typescript
declare global {
  namespace App {
    interface Locals {}
    interface PageData {}
    interface Platform {}
  }
}
export {};
```

**`scripts/scaffold-template/src/routes/+page.svelte`:**
```svelte
<h1 class="text-2xl font-bold p-8">Application placeholder — replace with real content</h1>
```

**`scripts/scaffold-template/src/lib/server/db/index.ts`:**
```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { resolve } from 'path';

const DB_PATH = process.env.DATABASE_PATH || resolve('data', 'app.db');
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite);
export { sqlite };
```

**`scripts/scaffold-template/drizzle.config.ts`:**
```typescript
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: process.env.DATABASE_PATH || './data/app.db' }
});
```

**`scripts/scaffold-template/vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    include: ['src/**/*.test.{js,ts}'],
    environment: 'node'
  }
});
```

- [ ] **Step 2: Create TECH_REFERENCE.md (injected into every AI prompt)**

This file is the tech cheat-sheet that prevents the AI from using wrong syntax.
It gets included in every build prompt.

**`scripts/scaffold-template/TECH_REFERENCE.md`:**
```markdown
# Tech Reference — READ BEFORE WRITING ANY CODE

## Svelte 5 Runes Syntax (NOT Svelte 4)
```svelte
<!-- CORRECT: Svelte 5 runes -->
<script lang="ts">
  // Reactive state (replaces `let x = writable(0)`)
  let count = $state(0);

  // Derived values (replaces `$: doubled = count * 2`)
  let doubled = $derived(count * 2);

  // Side effects (replaces `$: { ... }`)
  $effect(() => {
    console.log('count changed:', count);
  });

  // Props (replaces `export let name`)
  let { name, items = [] }: { name: string; items?: string[] } = $props();
</script>

<!-- Event handlers: use onclick not on:click -->
<button onclick={() => count++}>Count: {count}</button>

<!-- Snippets (replaces slots) -->
{#snippet header()}
  <h1>Header</h1>
{/snippet}
```

### WRONG patterns to avoid:
- `import { writable } from 'svelte/store'` — NO. Use `$state()`
- `export let prop` — NO. Use `let { prop } = $props()`
- `$: reactive = ...` — NO. Use `$derived(...)` or `$effect(...)`
- `on:click={handler}` — NO. Use `onclick={handler}`
- `<slot />` — NO. Use `{#snippet}` and `{@render}`
- `createEventDispatcher()` — NO. Pass callback props instead

## TailwindCSS v4
```css
/* src/app.css — this is ALL you need */
@import "tailwindcss";

/* Custom theme overrides (optional): */
@theme {
  --color-primary: #00E5B8;
  --color-secondary: #93D9FF;
}
```
Do NOT use `@tailwind base; @tailwind components; @tailwind utilities;` — that is v3.

## Drizzle ORM + SQLite
```typescript
// Schema definition (src/lib/server/db/schema.ts)
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  done: integer('done', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Usage
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const allItems = db.select().from(items).all();
const item = db.insert(items).values({ id: nanoid(), name: 'New' }).run();
db.update(items).set({ done: true }).where(eq(items.id, id)).run();
db.delete(items).where(eq(items.id, id)).run();
```

## SvelteKit Routing
```
src/routes/
  +page.svelte          → /
  +page.server.ts       → load() and form actions for /
  +layout.svelte        → layout wrapping all pages
  items/
    +page.svelte        → /items
    +page.server.ts     → load/actions for /items
    [id]/
      +page.svelte      → /items/:id
      +page.server.ts   → load/actions for /items/:id
  api/
    items/
      +server.ts        → GET/POST /api/items
      [id]/
        +server.ts      → GET/PUT/DELETE /api/items/:id
```

## SvelteKit Load Functions & Form Actions
```typescript
// +page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const items = db.select().from(schema.items).all();
  return { items };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    if (!name?.trim()) return fail(400, { error: 'Name required' });
    db.insert(schema.items).values({ id: nanoid(), name }).run();
    return { success: true };
  }
};
```

## Vitest Testing
```typescript
// src/lib/server/example.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('feature', () => {
  beforeEach(() => { /* setup */ });

  it('should do X', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

## File Structure Convention
- Server code: `src/lib/server/` (never imported from client)
- Shared types: `src/lib/types.ts`
- Components: `src/lib/components/`
- DB schema: `src/lib/server/db/schema.ts`
- DB connection: `src/lib/server/db/index.ts`
- Tests: co-located, `*.test.ts` next to the file they test
```

- [ ] **Step 3: Verify template builds successfully**

Run (from scaffold-template directory):
```bash
npm install && npm run build
```
Expected: Build succeeds with zero errors. If it doesn't, fix before proceeding.

- [ ] **Step 4: Commit**

```bash
git add scripts/scaffold-template/
git commit -m "feat: add verified SvelteKit scaffold template with tech reference"
```

---

## Chunk 3b: Builder Orchestrator with Phased Build Strategy

### Design Decision: Phased Builds, Not Monolithic

The previous plan used one agent call for the entire build. This will fail for any non-trivial app because:
1. Context window overflow
2. No incremental verification
3. Can't recover from errors in early code

**New approach: Build in layers, verify each layer.**

```
Layer 1: Database schema + DB tests          → verify: tests pass
Layer 2: Server services/logic + tests       → verify: tests pass
Layer 3: API routes + tests                  → verify: tests pass
Layer 4: UI components + pages               → verify: build succeeds
Layer 5: Integration + styling polish        → verify: full test + build
```

Each layer is a separate `opencode run` call with a fresh context. Each layer is verified before the next begins. If a layer fails, it retries up to 2 times before aborting.

### Task 5: Main Builder Orchestrator (`scripts/builder.ts`)

**Files:**
- Create: `scripts/builder.ts`

- [ ] **Step 1: Write the builder orchestrator with phased build**

```typescript
import { readFileSync, existsSync, cpSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { createWorkspace, updateMetadata, getWorkspacePath, readMetadata } from './workspace-manager.ts';
import { createVersion, markVersionBuilt, deployVersion } from './version-manager.ts';
import { runAgent, runBuildAgent, runShell } from './opencode-agent.ts';

const SCAFFOLD_TEMPLATE = resolve(import.meta.dirname, 'scaffold-template');

interface BuildResult {
  success: boolean;
  uuid: string;
  version: number;
  url: string;
  error?: string;
}

// Read the tech reference once — injected into every AI prompt
function getTechReference(versionPath: string): string {
  const refPath = join(versionPath, 'TECH_REFERENCE.md');
  if (existsSync(refPath)) return readFileSync(refPath, 'utf-8');
  return '';
}

/**
 * Run an agent phase with retry logic.
 * Retries up to maxRetries times on failure, with a fix-focused retry prompt.
 */
async function runPhaseWithRetry(
  phaseName: string,
  prompt: string,
  options: { workDir: string; timeout?: number },
  maxRetries = 2
): Promise<{ success: boolean; output: string; error?: string }> {
  console.log(`  [${phaseName}] Starting...`);
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const result = await runAgent(prompt, options);
    
    if (result.success) {
      console.log(`  [${phaseName}] Completed (attempt ${attempt})`);
      return result;
    }
    
    if (attempt <= maxRetries) {
      console.warn(`  [${phaseName}] Failed attempt ${attempt}, retrying...`);
      const retryPrompt = `The previous attempt to ${phaseName} failed with this error:

${result.error || result.output}

Read the error carefully. Identify the root cause. Fix it.
Then re-attempt the original task: ${prompt}`;
      prompt = retryPrompt;
    } else {
      console.error(`  [${phaseName}] Failed after ${maxRetries + 1} attempts`);
      return result;
    }
  }
  
  return { success: false, output: '', error: 'Exhausted retries' };
}

/**
 * Verify a build layer by running a command and checking exit code.
 */
function verifyLayer(name: string, command: string, workDir: string): boolean {
  console.log(`  [verify:${name}] Running: ${command}`);
  try {
    const output = runShell(command, workDir, 120_000);
    console.log(`  [verify:${name}] PASSED`);
    return true;
  } catch (err: any) {
    console.error(`  [verify:${name}] FAILED: ${err.message}`);
    return false;
  }
}

/**
 * Main pipeline: build and deploy an application from a specification.
 */
export async function buildFromSpec(specPath: string): Promise<BuildResult> {
  // ── Phase 0: Read & Validate Specification ──
  console.log('\n=== Phase 0: Reading & Validating Specification ===');
  if (!existsSync(specPath)) throw new Error(`Specification not found: ${specPath}`);
  const specContent = readFileSync(specPath, 'utf-8');
  console.log(`Spec loaded: ${specContent.length} characters`);

  // Validate spec has required structure before starting
  const { validateSpec } = await import('./spec-interviewer.ts');
  const validation = validateSpec(specContent);
  if (!validation.valid) {
    console.error('\n──────────────────────────────────────────');
    console.error('  The specification needs more detail before we can start building.');
    console.error('──────────────────────────────────────────');
    console.error('\nPlease add the following:\n');
    for (const m of validation.missing) console.error(`  • ${m}`);
    console.error('\nYou can either:');
    console.error('  1. Edit the specification file directly');
    console.error('  2. Use the interview assistant in the Portal to help fill in the gaps');
    throw new Error(`Specification needs more detail`);
  }
  console.log('Specification validated: all required sections present');

  // ── Phase 2: Create workspace ──
  console.log('\n=== Phase 2: Creating Workspace ===');
  const metadata = createWorkspace(specContent);
  const wsPath = getWorkspacePath(metadata.uuid);
  console.log(`Workspace: ${metadata.uuid} at ${wsPath}`);

  // ── Phase 3: Create version & scaffold ──
  console.log('\n=== Phase 3: Scaffolding Project ===');
  const { version, versionPath } = createVersion(metadata.uuid, specContent);
  cpSync(SCAFFOLD_TEMPLATE, versionPath, { recursive: true });
  
  // Ensure data dir exists for SQLite
  mkdirSync(join(versionPath, 'data'), { recursive: true });
  
  console.log('Installing dependencies...');
  runShell('npm install', versionPath, 300_000);

  // Verify scaffold builds before AI touches anything
  console.log('Verifying scaffold builds...');
  runShell('npm run build', versionPath, 120_000);
  console.log('Scaffold verified: builds successfully');

  updateMetadata(metadata.uuid, { status: 'planning' });
  const techRef = getTechReference(versionPath);
  const techRefBlock = `

---
TECH REFERENCE (read this before writing ANY code):
${techRef}
---`;

  // ── Phase 3b: AI Clarification (spec-kit pattern) ──
  console.log('\n=== Phase 3b: AI Clarification ===');
  const clarifyPrompt = `Read SPECIFICATION.md carefully. Your job is to find AMBIGUITIES and GAPS.

For each requirement, ask:
- Is the behavior fully specified, or could it be interpreted multiple ways?
- Are there edge cases not mentioned (empty states, errors, limits)?
- Are there implicit requirements the spec assumes but doesn't state?
- Are there contradictions between requirements?

Write CLARIFICATIONS.md with this structure:

## Ambiguities Found
| # | Spec Section | Ambiguity | Resolution |
|---|-------------|-----------|------------|
| 1 | "..." | "Is X or Y intended?" | "Assuming X because..." |

## Implicit Requirements Added
- List requirements that the spec implies but doesn't state

## Edge Cases Identified
- List edge cases per feature

Be aggressive — surface every possible ambiguity. Resolve each one with a reasonable default.
These resolutions will guide all subsequent planning and building.${techRefBlock}`;

  await runPhaseWithRetry('clarification', clarifyPrompt, { workDir: versionPath });

  // Initialize STATE.md (GSD pattern: cross-session memory)
  writeFileSync(join(versionPath, 'STATE.md'), `# State — Cross-Session Memory
## Status: planning
## Decisions Log
(Updated by each AI phase)
## Progress
- [x] Clarifications complete
- [ ] Architecture plan
- [ ] Task decomposition
- [ ] Review
- [ ] Build
- [ ] Test
- [ ] Deploy
`, 'utf-8');

  // ── Phase 4: AI Architecture Plan → PLAN.md (spec-kit: separate from tasks) ──
  // NOTE: The specification is written in business language by non-technical users.
  // This phase is where the AI TRANSLATES business concepts into technical architecture.
  // "What information does it work with?" → database schema
  // "What screens does it need?" → SvelteKit routes
  // "Should it work on phones?" → responsive design
  console.log('\n=== Phase 4: AI Architecture Plan ===');
  const planPrompt = `Read SPECIFICATION.md, CLARIFICATIONS.md, and TECH_REFERENCE.md.

IMPORTANT: The specification is written by a business person, not a developer.
It uses everyday language. YOUR job is to translate it into technical architecture.
- "What information does it work with?" → becomes your database schema
- "What screens does it need?" → becomes SvelteKit routes and components
- "How do we know it works" → becomes your test assertions
- "Business rules" → becomes validation logic
- "Should it work on mobile phones?" → becomes responsive TailwindCSS design

Create PLAN.md with ARCHITECTURE DECISIONS ONLY (not individual tasks):

## 1. Database Schema
- Every table, column, type, constraint
- Exact Drizzle ORM schema code (sqliteTable, text, integer)

## 2. Route Architecture
- Every route with its purpose, load function, and form actions

## 3. Component Tree
- Every UI component with its props and responsibilities

## 4. Service Layer
- Every server-side service function with inputs/outputs

## 5. Integration Mocking Strategy
- How each external integration is mocked

## 6. Build Layer Order
- Layer 1: Database → Layer 2: Services → Layer 3: API → Layer 4: UI → Layer 5: Integration
- Dependency graph between layers

RULES:
- Use Svelte 5 runes ($state, $derived, $effect, $props) — NOT stores
- Use TailwindCSS v4 (@import "tailwindcss") — NOT @tailwind directives
- Use Drizzle ORM with better-sqlite3
- Mock ALL external integrations
- This is ARCHITECTURE only. Individual tasks go in TASKS.md (next phase).

Write to PLAN.md. Then update STATE.md with key architecture decisions.${techRefBlock}`;

  const planResult = await runPhaseWithRetry('architecture', planPrompt, { workDir: versionPath });
  if (!planResult.success) {
    updateMetadata(metadata.uuid, { status: 'error', error: 'Planning failed' });
    return { success: false, uuid: metadata.uuid, version, url: '', error: planResult.error };
  }

  // ── Phase 5: AI Task Decomposition → TASKS.md (spec-kit + GSD patterns) ──
  console.log('\n=== Phase 5: AI Task Decomposition ===');
  const tasksPrompt = `Read PLAN.md, SPECIFICATION.md, CLARIFICATIONS.md, and TECH_REFERENCE.md.

Create TASKS.md: an ORDERED list of atomic tasks grouped by build layer.

Each task MUST follow this XML-inspired structure (from GSD pattern):

### Task {layer}.{n}: {name}
- **Files:** exact paths to create/modify
- **Depends on:** Task IDs this depends on (or "none")
- **Action:** Exactly what code to write (concrete, not "implement the logic")
- **Verify:** Exact command to run (e.g., \`npm run test -- --grep "task name"\`)
- **Done when:** Observable outcome (e.g., "3 tests pass", "page renders at /items")

Group tasks by layer:
## Layer 1: Database (tasks 1.1, 1.2, ...)
## Layer 2: Server Logic (tasks 2.1, 2.2, ...)
## Layer 3: API Routes (tasks 3.1, 3.2, ...)
## Layer 4: UI Pages (tasks 4.1, 4.2, ...)
## Layer 5: Integration (tasks 5.1, 5.2, ...)

RULES:
- Tasks within the same layer that don't depend on each other should be marked as parallelizable
- Each task must have a REAL verify step (not "visually inspect")
- Test tasks come BEFORE implementation tasks (TDD)
- Each task should take 2-5 minutes for an AI agent to complete

Write to TASKS.md. Update STATE.md progress.${techRefBlock}`;

  await runPhaseWithRetry('task-decomposition', tasksPrompt, { workDir: versionPath });

  // ── Phase 6: AI Critical Review ──
  console.log('\n=== Phase 6: AI Critical Review ===');
  updateMetadata(metadata.uuid, { status: 'reviewing' });

  const review1Prompt = `You are a senior engineer reviewing PLAN.md and TASKS.md against SPECIFICATION.md.
Also read CLARIFICATIONS.md and TECH_REFERENCE.md.

Check for these specific failure modes:
1. MISSING REQUIREMENTS: Go through the spec line by line. Is every feature covered in TASKS.md?
2. WRONG SYNTAX: Does the plan use $state/$derived/$effect/$props (Svelte 5)?
   Are there any on:click (should be onclick), export let (should be $props), writable stores?
3. IMPORT ERRORS: Does every import path match the file list? Is $lib/server/* used for server code?
4. UNTESTABLE TASKS: Does every task have a real <verify> step? Not just "visually check"?
5. MISSING ERROR HANDLING: Do forms validate input? Do API routes return proper error responses?
6. PHANTOM TESTS: Are there tests that would pass even if the implementation is empty? (e.g., expect(true).toBe(true))
7. DEPENDENCY ORDER: Can Layer 1 tasks run independently? Do Layer 2 tasks only depend on Layer 1?

Fix issues directly in PLAN.md and TASKS.md.
Append a review log to STATE.md listing every issue found and how you fixed it.`;

  await runPhaseWithRetry('review-1', review1Prompt, { workDir: versionPath });

  // ── Phase 7: Spec Compliance Check (spec-kit /analyze pattern) ──
  console.log('\n=== Phase 7: Spec Compliance Check ===');

  const compliancePrompt = `Cross-artifact consistency check (spec-kit /analyze pattern).

Read SPECIFICATION.md, CLARIFICATIONS.md, PLAN.md, and TASKS.md side by side.

Create a compliance matrix at the top of TASKS.md:

| # | Spec Requirement | PLAN.md Section | TASKS.md Tasks | Status |
|---|-----------------|----------------|---------------|--------|
| 1 | "requirement text" | Schema §1 | Task 1.1, 1.2 | COVERED / MISSING |

Every row must be COVERED. If any are MISSING:
1. Add architecture for it in PLAN.md
2. Add tasks for it in TASKS.md
3. Update the matrix

Also verify INTERNAL CONSISTENCY:
- Every file referenced in TASKS.md exists in PLAN.md's architecture
- Every route in PLAN.md has corresponding tasks
- Every DB table has CRUD tasks and tests`;

  await runPhaseWithRetry('compliance', compliancePrompt, { workDir: versionPath });

  // ── Phase 8: Final Review ──
  console.log('\n=== Phase 8: Final Review ===');

  const review2Prompt = `Final review of PLAN.md and TASKS.md before autonomous build.

Verify MECHANICAL EXECUTABILITY:
1. Every task says "Create file X with this content" or "Add this code to file X"
2. No task says "implement the logic" without showing what the logic IS
3. Every task has a <verify> command that can be run non-interactively
4. Tests have concrete expect() assertions against specific values (not expect(true))
5. The compliance matrix shows 100% COVERED
6. The dependency graph has no cycles
7. Every Svelte component uses $state/$derived/$props (search for banned patterns: writable, on:click, export let, $:)

Fix remaining issues. Update STATE.md. This is the last gate before build.`;

  await runPhaseWithRetry('review-2', review2Prompt, { workDir: versionPath });

  // ── Phase 8: LAYERED BUILD ──
  console.log('\n=== Phase 8: Layered Build ===');
  updateMetadata(metadata.uuid, { status: 'building' });

  const layers = [
    {
      name: 'Layer 1: Database Schema & Tests',
      verify: 'npm run test 2>&1 || true',
      prompt: `Read TASKS.md "Layer 1: Database" section. Read PLAN.md for architecture context.
Read STATE.md for decisions made so far. Read TECH_REFERENCE.md for Drizzle ORM syntax.

Do these steps IN ORDER:
1. Create src/lib/server/db/schema.ts with the EXACT schema from the plan
2. Update src/lib/server/db/index.ts if needed (it already exists with basic setup)
3. Create test file(s) for the database layer
4. Write tests that INSERT, SELECT, UPDATE, DELETE records
5. Run: npm run test
6. If tests fail, read the error, fix the code, run again
7. Do NOT proceed until tests pass

Create ONLY database-related files. Do NOT create routes or UI yet.

After completing each task, run its <verify> command from TASKS.md.
Update STATE.md with what you built and any decisions you made.${techRefBlock}`
    },
    {
      name: 'Layer 2: Server Services & Logic',
      verify: 'npm run test 2>&1 || true',
      prompt: `Read TASKS.md "Layer 2: Server Logic" section. Read PLAN.md for architecture.
Read STATE.md for decisions and progress. Read TECH_REFERENCE.md for syntax rules.

The database schema already exists in src/lib/server/db/schema.ts.

Do these steps IN ORDER:
1. Create service files in src/lib/server/services/
2. Each service function should handle one business operation
3. Write tests for each service function
4. Run: npm run test
5. Fix any failures, re-run until all pass

Create ONLY server logic files. Do NOT create routes or UI yet.

After each task, run its <verify> command. Update STATE.md.${techRefBlock}`
    },
    {
      name: 'Layer 3: API Routes',
      verify: 'npm run test 2>&1 || true',
      prompt: `Read TASKS.md "Layer 3: API Routes" section. Read PLAN.md for route architecture.
Read STATE.md for progress. Read TECH_REFERENCE.md for SvelteKit routing patterns.

Database schema and services already exist. Now create API routes.

Do these steps IN ORDER:
1. Create +server.ts files for each API endpoint
2. Use the existing service functions — import from $lib/server/services/
3. Write tests for each API endpoint
4. Run: npm run test
5. Fix any failures, re-run until all pass

Create ONLY API route files (+server.ts). Do NOT create UI pages yet.

After each task, run its <verify> command. Update STATE.md.${techRefBlock}`
    },
    {
      name: 'Layer 4: UI Pages & Components',
      verify: 'npm run build',
      prompt: `Read TASKS.md "Layer 4: UI Pages" section. Read PLAN.md for component tree.
Read STATE.md for progress. Read TECH_REFERENCE.md for Svelte 5 syntax — this is CRITICAL.

Database, services, and API routes already exist. Now build the UI.

CRITICAL SVELTE 5 RULES:
- let { prop } = $props()    NOT export let prop
- let x = $state(0)          NOT let x = 0 or writable(0)
- $derived(expr)             NOT $: x = expr
- onclick={handler}          NOT on:click={handler}
- {#snippet name()}...{/snippet} NOT <slot>

Do these steps IN ORDER:
1. Create +layout.svelte with navigation (use TailwindCSS)
2. Create +page.svelte and +page.server.ts for each route
3. Create reusable components in src/lib/components/
4. Use form actions (use:enhance) for mutations, load functions for data
5. Run: npm run build
6. If build fails, read the EXACT error message, find the file and line, fix it
7. Re-run build until it succeeds with ZERO errors

DEBUGGING BUILD ERRORS:
- "Cannot find module X" → check the import path, use $lib/ prefix
- "X is not a valid rune" → you used Svelte 4 syntax, check TECH_REFERENCE.md
- "Unexpected token" → check for syntax errors in .svelte files
- Type errors → add proper TypeScript types${techRefBlock}`
    },
    {
      name: 'Layer 5: Integration & Polish',
      verify: 'npm run test && npm run build',
      prompt: `Read TASKS.md "Layer 5: Integration" section. Read STATE.md for all progress.
This is the final integration phase. Everything is built. Now verify and polish.

Do these steps IN ORDER:
1. Run: npm run test — fix ANY failures
2. Run: npm run build — fix ANY errors
3. Run: npx svelte-check --tsconfig ./tsconfig.json — fix type errors
4. Review each page for missing functionality vs SPECIFICATION.md
5. Add any missing edge case handling (empty states, loading states, error states)
6. Verify forms validate input before submitting
7. Re-run: npm run test && npm run build
8. Repeat until ZERO errors, ZERO warnings

DEBUGGING STRATEGY (follow this exact process):
1. Read the FULL error message
2. Note the file path and line number
3. Open that file, find the line
4. Understand WHY it's wrong (don't guess)
5. Fix the root cause (not symptoms)
6. Re-run the failing command to verify${techRefBlock}`
    }
  ];

  for (const layer of layers) {
    console.log(`\n--- ${layer.name} ---`);
    
    const result = await runPhaseWithRetry(
      layer.name,
      layer.prompt,
      { workDir: versionPath, timeout: 20 * 60 * 1000 }, // 20 min per layer
      2 // retry twice
    );
    
    if (!result.success) {
      updateMetadata(metadata.uuid, { status: 'error', error: `${layer.name} failed` });
      return { success: false, uuid: metadata.uuid, version, url: '', error: `${layer.name}: ${result.error}` };
    }
    
    // Verify this layer's output
    if (!verifyLayer(layer.name, layer.verify, versionPath)) {
      // One more AI attempt to fix verification failures
      console.log(`  [${layer.name}] Verification failed, running fix agent...`);
      const fixPrompt = `The build/test verification failed. Run this command and fix ALL errors:

${layer.verify}

Read each error carefully. Fix the root cause. Re-run until it passes.
Do NOT skip errors. Do NOT comment out failing tests. Fix them properly.${techRefBlock}`;

      await runPhaseWithRetry(`${layer.name}-fix`, fixPrompt, { workDir: versionPath });
      
      if (!verifyLayer(`${layer.name}-retry`, layer.verify, versionPath)) {
        updateMetadata(metadata.uuid, { status: 'error', error: `${layer.name} verification failed` });
        return { success: false, uuid: metadata.uuid, version, url: '', error: `${layer.name} verification failed` };
      }
    }
  }

  // ── Phase 10: Loop-Until-Done Test Fix (OmO Ralph Loop pattern) ──
  console.log('\n=== Phase 10: Loop-Until-Done Test Fix ===');
  updateMetadata(metadata.uuid, { status: 'testing' });

  const MAX_FIX_LOOPS = 5;
  const FIX_LOOP_TIMEOUT = 10 * 60 * 1000; // 10 min per loop

  for (let loop = 1; loop <= MAX_FIX_LOOPS; loop++) {
    console.log(`  [fix-loop] Iteration ${loop}/${MAX_FIX_LOOPS}`);
    
    if (verifyLayer(`loop-${loop}`, 'npm run test && npm run build', versionPath)) {
      console.log('  [fix-loop] ALL PASSING — exiting loop');
      break;
    }
    
    if (loop === MAX_FIX_LOOPS) {
      updateMetadata(metadata.uuid, { status: 'error', error: 'Fix loop exhausted' });
      return { success: false, uuid: metadata.uuid, version, url: '', error: `Fix loop exhausted after ${MAX_FIX_LOOPS} iterations` };
    }
    
    const fixPrompt = `Tests or build are failing. This is fix iteration ${loop}/${MAX_FIX_LOOPS}.

Run these commands and fix EVERY error:
1. npm run test
2. npm run build

DEBUGGING STRATEGY (follow this exact process):
1. Read the FULL error message
2. Note the file path and line number
3. Open that file, find the line
4. Understand WHY it's wrong (don't guess)
5. Fix the root cause (not symptoms)
6. Re-run the failing command to verify

RULES:
- Do NOT delete or skip tests. Do NOT comment out code. Fix root causes.
- Do NOT replace real assertions with expect(true). That defeats the purpose.
- If a test is fundamentally wrong, fix the test to match the implementation's correct behavior.
- Update STATE.md with what you fixed.${techRefBlock}`;

    await runPhaseWithRetry(`fix-loop-${loop}`, fixPrompt, {
      workDir: versionPath,
      timeout: FIX_LOOP_TIMEOUT
    });
  }

  // ── Phase 11: Phantom-Completion Detection (spec-kit verify-tasks pattern) ──
  console.log('\n=== Phase 11: Phantom-Completion Detection ===');
  
  const phantomPrompt = `You are a QA auditor. Check for PHANTOM COMPLETIONS — code that looks done but isn't.

Read TASKS.md and check each completed task against the actual code:

1. PHANTOM TESTS: Find tests that always pass regardless of implementation:
   - expect(true).toBe(true)
   - Tests with no assertions
   - Tests that mock everything including the thing being tested
   - Tests that only check types, not behavior

2. PHANTOM IMPLEMENTATIONS: Find code that exists but doesn't work:
   - Functions that return hardcoded values instead of real logic
   - TODO/FIXME comments in production code
   - Catch blocks that silently swallow errors
   - Routes that return placeholder responses

3. MISSING WIRING: Find features that exist in isolation but aren't connected:
   - Components created but never imported in any page
   - API routes defined but never called from UI
   - Database tables defined but never queried

For each phantom found:
1. Fix it — write real logic, real tests, real wiring
2. Run the verify command for that task
3. Log what you found and fixed in STATE.md

Run npm run test && npm run build when done.${techRefBlock}`;

  await runPhaseWithRetry('phantom-detection', phantomPrompt, {
    workDir: versionPath,
    timeout: 15 * 60 * 1000
  });
  
  // Final verification after phantom fixes
  if (!verifyLayer('post-phantom', 'npm run test && npm run build', versionPath)) {
    // One more fix attempt
    await runPhaseWithRetry('post-phantom-fix', `npm run test && npm run build are failing after phantom-completion fixes. Fix ALL errors. Update STATE.md.${techRefBlock}`, {
      workDir: versionPath,
      timeout: 10 * 60 * 1000
    });
    if (!verifyLayer('final-check', 'npm run test && npm run build', versionPath)) {
      updateMetadata(metadata.uuid, { status: 'error', error: 'Final verification failed' });
      return { success: false, uuid: metadata.uuid, version, url: '', error: 'Final verification failed' };
    }
  }

  // ── Phase 10: Deploy ──
  console.log('\n=== Phase 10: Deploying ===');
  updateMetadata(metadata.uuid, { status: 'deploying' });

  const buildDir = join(versionPath, 'build');
  if (!existsSync(buildDir)) {
    updateMetadata(metadata.uuid, { status: 'error', error: 'No build output' });
    return { success: false, uuid: metadata.uuid, version, url: '', error: 'No build output found' };
  }

  const deployPath = deployVersion(metadata.uuid, version);
  markVersionBuilt(metadata.uuid, version);

  const hostname = process.env.HOST || 'localhost';
  const port = process.env.PORT || '3000';
  const url = `http://${hostname}:${port}/apps/${metadata.uuid}/v${version}/`;

  console.log('\n=============================');
  console.log('  DEPLOYMENT COMPLETE');
  console.log(`  URL: ${url}`);
  console.log(`  Workspace: ${wsPath}`);
  console.log(`  Version: v${version}`);
  console.log('=============================');

  return { success: true, uuid: metadata.uuid, version, url };
}

/**
 * Rebuild from an updated specification (creates new version).
 */
export async function rebuildFromSpec(uuid: string, specPath: string): Promise<BuildResult> {
  const specContent = readFileSync(specPath, 'utf-8');
  const wsPath = getWorkspacePath(uuid);

  // Update spec in workspace root
  writeFileSync(join(wsPath, 'SPECIFICATION.md'), specContent, 'utf-8');

  // Create new version (copies from previous version's source)
  const { version, versionPath } = createVersion(uuid, specContent);
  console.log(`New version ${version} created`);

  // Install deps if node_modules doesn't exist
  if (!existsSync(join(versionPath, 'node_modules'))) {
    runShell('npm install', versionPath, 300_000);
  }

  const techRef = getTechReference(versionPath);
  const techRefBlock = techRef ? `\n\n---\nTECH REFERENCE:\n${techRef}\n---` : '';

  // AI: Diff-aware rebuild — still uses layered approach
  const rebuildPrompt = `SPECIFICATION.md has been updated. A previous version of this app exists in this directory.

1. Read the NEW SPECIFICATION.md
2. Read IMPLEMENTATION_PLAN.md (from previous version)
3. Identify WHAT CHANGED between old and new spec
4. Write a CHANGES.md listing: added features, modified features, removed features
5. For each change:
   a. Write/update tests FIRST
   b. Implement the change
   c. Run: npm run test — fix failures
6. After all changes: npm run build — fix errors
7. Final: npm run test && npm run build must both pass

Do NOT rewrite unchanged code. Only modify what the spec changes require.
Do NOT ask for user input. Build autonomously.${techRefBlock}`;

  const result = await runPhaseWithRetry('rebuild', rebuildPrompt, {
    workDir: versionPath,
    timeout: 45 * 60 * 1000
  }, 2);

  if (!result.success) {
    updateMetadata(uuid, { status: 'error', error: 'Rebuild failed: ' + result.error });
    return { success: false, uuid, version, url: '', error: result.error };
  }

  // Verify build
  if (!verifyLayer('rebuild-verify', 'npm run test && npm run build', versionPath)) {
    updateMetadata(uuid, { status: 'error', error: 'Rebuild verification failed' });
    return { success: false, uuid, version, url: '', error: 'Rebuild verification failed' };
  }

  const deployPath = deployVersion(uuid, version);
  markVersionBuilt(uuid, version);

  const hostname = process.env.HOST || 'localhost';
  const port = process.env.PORT || '3000';
  const url = `http://${hostname}:${port}/apps/${uuid}/v${version}/`;

  return { success: true, uuid, version, url };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('builder.ts')) {
  const args = process.argv.slice(2);

  if (args[0] === 'build' && args[1]) {
    buildFromSpec(resolve(args[1]))
      .then(r => { console.log(r.success ? `\nSUCCESS: ${r.url}` : `\nFAILED: ${r.error}`); process.exit(r.success ? 0 : 1); })
      .catch(e => { console.error('Fatal:', e); process.exit(1); });
  } else if (args[0] === 'rebuild' && args[1] && args[2]) {
    rebuildFromSpec(args[1], resolve(args[2]))
      .then(r => { console.log(r.success ? `\nSUCCESS: ${r.url}` : `\nFAILED: ${r.error}`); process.exit(r.success ? 0 : 1); })
      .catch(e => { console.error('Fatal:', e); process.exit(1); });
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/builder.ts build <path-to-SPECIFICATION.md>');
    console.log('  npx tsx scripts/builder.ts rebuild <uuid> <path-to-SPECIFICATION.md>');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/builder.ts
git commit -m "feat: add phased builder orchestrator with retry logic and tech guardrails"
```

---

## Chunk 4: Portal Integration (Step 10: Deployment & Serving)

### Task 6: App Proxy Route in Innovation Portal

**Files:**
- Create: `src/routes/apps/[uuid]/v[version]/[...path]/+server.ts`
- Modify: `src/hooks.server.ts` (add workspace app process management)

The Innovation Portal needs to serve workspace applications under `/apps/{uuid}/v{n}/`. Since each workspace app is built with `adapter-node`, it runs as its own Node process. The Portal proxies requests to it.

- [ ] **Step 1: Create the proxy route**

```typescript
// src/routes/apps/[uuid]/v[version]/[...path]/+server.ts
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { existsSync, readFileSync } from 'fs';
import { join, resolve, extname } from 'path';

const WORKSPACES_ROOT = resolve('workspaces');

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/**
 * Serve workspace app files directly from the deployment directory.
 * For simple deployments, we serve the built static assets.
 * For dynamic apps, a separate process manager starts the Node server.
 */
const handler: RequestHandler = async ({ params }) => {
  const { uuid, version, path: subpath } = params;
  
  if (!uuid || !version) {
    throw error(400, 'Missing workspace UUID or version');
  }
  
  // Validate UUID format (prevent directory traversal)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
    throw error(400, 'Invalid workspace UUID');
  }
  
  // Validate version format
  if (!/^\d+$/.test(version)) {
    throw error(400, 'Invalid version');
  }
  
  const deployDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'deployment');
  
  if (!existsSync(deployDir)) {
    throw error(404, `Workspace ${uuid} v${version} not found or not deployed`);
  }
  
  // Resolve the requested file path
  const requestedPath = subpath || 'index.html';
  
  // Security: Prevent directory traversal
  const resolvedPath = resolve(deployDir, 'client', requestedPath);
  if (!resolvedPath.startsWith(resolve(deployDir))) {
    throw error(403, 'Access denied');
  }
  
  // Try to serve the file
  let filePath = resolvedPath;
  
  // If no extension, try .html
  if (!extname(filePath) && !existsSync(filePath)) {
    filePath = filePath + '.html';
  }
  
  // If still not found, try index.html (SPA fallback)
  if (!existsSync(filePath)) {
    filePath = join(deployDir, 'client', 'index.html');
  }
  
  if (!existsSync(filePath)) {
    // Try serving from the build root (adapter-node structure)
    const altPath = join(deployDir, requestedPath);
    if (existsSync(altPath)) {
      filePath = altPath;
    } else {
      throw error(404, 'File not found');
    }
  }
  
  const ext = extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = readFileSync(filePath);
  
  return new Response(content, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    }
  });
};

export const GET = handler;
```

- [ ] **Step 2: Create workspace listing route**

```typescript
// src/routes/apps/+page.server.ts
import type { PageServerLoad } from './$types';
import { resolve } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';

const WORKSPACES_ROOT = resolve('workspaces');

export const load: PageServerLoad = async () => {
  if (!existsSync(WORKSPACES_ROOT)) {
    return { workspaces: [] };
  }
  
  const workspaces = readdirSync(WORKSPACES_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      try {
        const metaPath = resolve(WORKSPACES_ROOT, d.name, 'metadata.json');
        if (!existsSync(metaPath)) return null;
        const metadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
        return metadata;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  
  return { workspaces };
};
```

- [ ] **Step 3: Create workspace listing page**

```svelte
<!-- src/routes/apps/+page.svelte -->
<script lang="ts">
  let { data } = $props();
</script>

<div class="container mx-auto p-8">
  <h1 class="text-3xl font-bold mb-8">Deployed Applications</h1>
  
  {#if data.workspaces.length === 0}
    <p class="text-gray-500">No applications deployed yet.</p>
  {:else}
    <div class="grid gap-6">
      {#each data.workspaces as ws}
        <div class="card glass p-6">
          <h2 class="text-xl font-semibold mb-2">Workspace: {ws.uuid}</h2>
          <p class="text-sm text-gray-400 mb-2">Status: {ws.status}</p>
          <p class="text-sm text-gray-400 mb-4">Created: {new Date(ws.createdAt).toLocaleString()}</p>
          
          <h3 class="font-medium mb-2">Versions:</h3>
          <div class="flex gap-2 flex-wrap">
            {#each ws.versions as v}
              <a 
                href="/apps/{ws.uuid}/v{v.version}/"
                class="px-3 py-1 rounded text-sm {v.status === 'deployed' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300'}"
              >
                v{v.version} ({v.status})
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/apps/
git commit -m "feat: add workspace app serving routes in Innovation Portal"
```

---

## Chunk 5: Version Management & User Workflow (Steps 11-12)

### Task 7: Spec Edit & Rebuild Flow

**Files:**
- Create: `src/routes/apps/[uuid]/+page.server.ts` - Workspace detail page with spec editor
- Create: `src/routes/apps/[uuid]/+page.svelte` - UI for viewing/editing spec and versions
- Create: `src/routes/api/apps/[uuid]/rebuild/+server.ts` - API to trigger rebuild

- [ ] **Step 1: Create workspace detail page (server)**

```typescript
// src/routes/apps/[uuid]/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const WORKSPACES_ROOT = resolve('workspaces');

export const load: PageServerLoad = async ({ params }) => {
  const { uuid } = params;
  const wsDir = resolve(WORKSPACES_ROOT, uuid);
  
  if (!existsSync(wsDir)) {
    throw error(404, 'Workspace not found');
  }
  
  const metadata = JSON.parse(readFileSync(resolve(wsDir, 'metadata.json'), 'utf-8'));
  const spec = readFileSync(resolve(wsDir, 'SPECIFICATION.md'), 'utf-8');
  
  return { metadata, spec };
};

export const actions: Actions = {
  updateSpec: async ({ params, request }) => {
    const { uuid } = params;
    const formData = await request.formData();
    const newSpec = formData.get('spec') as string;
    
    if (!newSpec?.trim()) {
      return fail(400, { error: 'Specification cannot be empty' });
    }
    
    const wsDir = resolve(WORKSPACES_ROOT, uuid);
    writeFileSync(resolve(wsDir, 'SPECIFICATION.md'), newSpec, 'utf-8');
    
    // Trigger async rebuild (non-blocking)
    // In production, this would go to a job queue
    // For now, we update status and the builder picks it up
    const metaPath = resolve(wsDir, 'metadata.json');
    const metadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
    metadata.status = 'rebuilding';
    writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
    
    return { success: true, message: 'Specification updated. Rebuild triggered.' };
  }
};
```

- [ ] **Step 2: Create workspace detail UI**

```svelte
<!-- src/routes/apps/[uuid]/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  
  let { data, form } = $props();
  let editing = $state(false);
  let specContent = $state(data.spec);
</script>

<div class="container mx-auto p-8 max-w-6xl">
  <div class="flex justify-between items-center mb-8">
    <div>
      <h1 class="text-3xl font-bold">Application Workspace</h1>
      <p class="text-gray-400 text-sm mt-1">{data.metadata.uuid}</p>
    </div>
    <span class="px-3 py-1 rounded text-sm
      {data.metadata.status === 'deployed' ? 'bg-green-600' : 
       data.metadata.status === 'error' ? 'bg-red-600' : 'bg-yellow-600'}">
      {data.metadata.status}
    </span>
  </div>
  
  <!-- Version List -->
  <section class="mb-8">
    <h2 class="text-xl font-semibold mb-4">Versions</h2>
    <div class="flex gap-3 flex-wrap">
      {#each data.metadata.versions as v}
        <a 
          href="/apps/{data.metadata.uuid}/v{v.version}/"
          class="block p-4 rounded-lg border transition-colors
            {v.status === 'deployed' ? 'border-teal-500 bg-teal-900/20' : 'border-gray-700 bg-gray-800/50'}
            hover:border-teal-400"
          target="_blank"
        >
          <div class="font-mono font-bold">v{v.version}</div>
          <div class="text-xs text-gray-400">{v.status}</div>
          <div class="text-xs text-gray-500">{new Date(v.createdAt).toLocaleDateString()}</div>
        </a>
      {/each}
    </div>
  </section>
  
  <!-- Specification Editor -->
  <section>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Specification</h2>
      <button 
        onclick={() => editing = !editing}
        class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm"
      >
        {editing ? 'Cancel' : 'Edit Specification'}
      </button>
    </div>
    
    {#if editing}
      <form method="POST" action="?/updateSpec" use:enhance>
        <textarea 
          name="spec"
          bind:value={specContent}
          class="w-full h-96 p-4 font-mono text-sm bg-gray-900 border border-gray-700 rounded-lg"
        ></textarea>
        <div class="flex justify-end gap-3 mt-4">
          <button type="button" onclick={() => editing = false}
            class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600">
            Cancel
          </button>
          <button type="submit"
            class="px-4 py-2 rounded bg-teal-600 hover:bg-teal-500 font-medium">
            Save & Rebuild
          </button>
        </div>
      </form>
    {:else}
      <div class="prose prose-invert max-w-none p-6 bg-gray-900 rounded-lg border border-gray-700">
        <pre class="whitespace-pre-wrap text-sm">{data.spec}</pre>
      </div>
    {/if}
    
    {#if form?.success}
      <div class="mt-4 p-4 bg-green-900/30 border border-green-700 rounded-lg">
        {form.message}
      </div>
    {/if}
    {#if form?.error}
      <div class="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg">
        {form.error}
      </div>
    {/if}
  </section>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/apps/
git commit -m "feat: add workspace detail page with spec editor and version browser"
```

---

### Task 8: Rebuild API Endpoint

**Files:**
- Create: `src/routes/api/apps/[uuid]/rebuild/+server.ts`

- [ ] **Step 1: Write the rebuild endpoint**

```typescript
// src/routes/api/apps/[uuid]/rebuild/+server.ts
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { exec } from 'child_process';

const WORKSPACES_ROOT = resolve('workspaces');

export const POST: RequestHandler = async ({ params }) => {
  const { uuid } = params;
  
  if (!uuid || !/^[0-9a-f-]{36}$/.test(uuid)) {
    throw error(400, 'Invalid UUID');
  }
  
  const wsDir = resolve(WORKSPACES_ROOT, uuid);
  if (!existsSync(wsDir)) {
    throw error(404, 'Workspace not found');
  }
  
  const specPath = resolve(wsDir, 'SPECIFICATION.md');
  if (!existsSync(specPath)) {
    throw error(400, 'No specification found');
  }
  
  // Trigger rebuild in background (fire-and-forget)
  const builderScript = resolve('scripts', 'builder.ts');
  const child = exec(
    `npx tsx "${builderScript}" rebuild "${uuid}" "${specPath}"`,
    { cwd: resolve('.') }
  );
  
  child.stdout?.on('data', (data) => console.log(`[rebuild:${uuid}] ${data}`));
  child.stderr?.on('data', (data) => console.error(`[rebuild:${uuid}] ${data}`));
  
  return json({ 
    status: 'rebuilding',
    message: `Rebuild triggered for workspace ${uuid}` 
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/apps/
git commit -m "feat: add rebuild API endpoint for workspace spec changes"
```

---

## Chunk 6: End-to-End Integration & Security

### Task 9: Security Hardening

**Files:**
- Modify: `src/routes/apps/[uuid]/v[version]/[...path]/+server.ts` (already created in Task 6)

Security considerations for serving workspace apps:

- [ ] **Step 1: Add path traversal protection**

The proxy route already includes UUID format validation and `resolve()` path containment check. Additional hardening:
- Reject paths containing `..`
- Reject paths with null bytes
- Rate limit (via Portal's existing middleware)
- Only serve from `versions/v{n}/deployment/` directory (never from version source code directly)

- [ ] **Step 2: Add workspace auth check**

Workspace apps should inherit the Portal's authentication. The Portal's `hooks.server.ts` already validates sessions for all routes. The `/apps/` routes will be covered by the same auth middleware.

- [ ] **Step 3: Commit**

```bash
git commit -m "security: add path traversal protection to workspace app serving"
```

---

### Task 10: Integration Test Script

**Files:**
- Create: `scripts/test-builder.ts`

- [ ] **Step 1: Write integration test**

```typescript
// scripts/test-builder.ts
// End-to-end test: create a simple spec, run the builder, verify output
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const TEST_SPEC = `# Test Application Specification

## Overview
A simple to-do list application.

## Features
1. Users can add a to-do item with a title
2. Users can mark a to-do item as complete
3. Users can delete a to-do item
4. Users can view all to-do items
5. To-do items are persisted in SQLite database

## Tech Requirements
- SvelteKit with Svelte 5
- SQLite database with Drizzle ORM
- TailwindCSS for styling
- Responsive design

## Pages
- / : Main page showing all todos with add form
`;

async function runTest() {
  console.log('=== Builder Integration Test ===');
  
  // Write test spec to temp location
  const testDir = resolve('workspaces', '_test');
  mkdirSync(testDir, { recursive: true });
  const specPath = join(testDir, 'SPECIFICATION.md');
  writeFileSync(specPath, TEST_SPEC);
  
  console.log('Test spec written to:', specPath);
  console.log('Run: npx tsx scripts/builder.ts build ' + specPath);
  console.log('This will take 30-60 minutes for the AI to complete.');
}

runTest().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/test-builder.ts
git commit -m "test: add builder integration test script"
```

---

## Chunk 7: User-Facing Workflow Summary

### Complete User Workflow

1. **User starts a new project** via the Portal (`/apps/new`) or CLI
2. **AI interviews the user** (only interactive phase, no technical knowledge required):
   - User provides initial idea in their own words (one sentence to full description)
   - AI asks follow-up questions in plain business language — no jargon, no "routes" or "data models"
   - Questions focus on: what the app does, who uses it, what it keeps track of, what screens users need, business rules
   - AI writes structured SPECIFICATION.md using business-friendly section headings
   - Wherever the user didn't specify something, AI fills in a reasonable default marked "(assumed — please change if this is wrong)"
   - AI validates completeness — if gaps remain, asks more questions
   - User reviews in the Portal, edits anything, and clicks "Build"
3. **User runs the builder (or clicks "Build" in Portal):**
   ```bash
   npx tsx scripts/builder.ts build ./workspaces/{uuid}/SPECIFICATION.md
   ```
4. **Builder validates spec structure** (rejects if missing required sections)
5. **Builder autonomously:**
   - Creates `./workspaces/{uuid}/` directory
   - Scaffolds a SvelteKit project from **verified template** (v1)
   - Installs dependencies, verifies scaffold builds
   - **Clarification (spec-kit pattern):** Surface ambiguities → CLARIFICATIONS.md
   - **Planning (spec-kit pattern):** Architecture → PLAN.md, Task decomposition → TASKS.md
   - **Review (3 AI calls):** Critical review → Spec compliance (cross-artifact) → Final review
   - **Layered build (5 AI calls, each verified, GSD per-task `<verify>`):**
     - Layer 1: Database schema + tests → verify tests pass
     - Layer 2: Server services + tests → verify tests pass
     - Layer 3: API routes + tests → verify tests pass
     - Layer 4: UI pages + components → verify build succeeds
     - Layer 5: Integration + polish → verify all tests + build pass
   - **Loop-until-done test fix (OmO Ralph Loop):** Up to 5 iterations, not just 2 retries
   - **Phantom-completion detection (spec-kit verify-tasks):** Catch fake tests, stub code, missing wiring
   - **STATE.md (GSD pattern):** Carried across all agent calls as persistent memory
   - **TECH_REFERENCE.md** injected into every AI prompt (prevents Svelte 4/TailwindCSS v3 syntax)
   - Deploys to `./workspaces/{uuid}/versions/v1/deployment/`
6. **Builder outputs the URL:**
   ```
   Application URL: http://localhost:3000/apps/{uuid}/v1/
   ```
7. **User accesses the app** through the Innovation Portal
8. **User edits the spec** via the Portal's workspace detail page (`/apps/{uuid}/`)
   - Editing is the only document user sees — all changes flow through SPECIFICATION.md
   - User can also use AI-assisted editing: describe what to change, AI updates the spec
9. **On save, a new version is created** (v2, v3, etc.) and the AI rebuilds autonomously
10. **All versions remain accessible** at `/apps/{uuid}/v{n}/` — user can compare any versions side by side

### Error Recovery

- If any AI phase fails, the workspace status is set to `error` with a description
- The user can view the error in the workspace detail page
- The user can re-trigger a rebuild after fixing their spec
- Each version is fully independent - a failed v3 doesn't affect deployed v1 or v2
- All successfully deployed versions remain live and accessible at their own URLs
- Users can compare any two versions side-by-side in separate browser tabs

### Resource Limits

| Resource | Limit | Rationale |
|----------|-------|-----------|
| AI Planning/Review (per phase) | 10 minutes | Planning, reviews are bounded tasks |
| AI Build (per layer) | 20 minutes | Each layer is a focused subset |
| AI Fix attempt | 15 minutes | Targeted fixes, not open-ended |
| `npm install` timeout | 5 minutes | Dependencies should cache |
| Node process buffer | 50 MB | Large AI outputs |
| Max retries per phase | 2 | Avoid infinite loops; fail fast |
| Total pipeline (5 layers) | ~120 minutes | Worst case with all retries |

---

## Execution Checklist

### Prerequisites
- [ ] OpenCode CLI v1.3.13+ installed and configured with a provider (verified: installed)
- [ ] Node.js v25+ and npm v11+ (verified: installed)
- [ ] Innovation Portal running locally on port 3000 (existing `npm run dev`)
- [ ] API key configured for AI provider (user's environment)

---

## Chunk 8: Ideas Pipeline Integration & Git Push

### 8.1 Revised End-to-End Pipeline

The autonomous builder is no longer standalone. It integrates into the existing Ideas -> Development pipeline:

```
Ideas (AI/Jira/User) → Votes (≥ threshold) → Development (AI Chat → Spec)
                                                        │
                                              specStatus = 'completed'
                                              specReviewStatus = 'under_review'
                                                        │
                                              Users review & edit spec sections
                                              Version history, rollback, diffs
                                                        │
                                              "Build Application" button (REPLACES "Publish to DevOps")
                                                        │
                                                        ▼
                                              ┌─────────────────────────┐
                                              │  Autonomous Build       │
                                              │  (14-phase pipeline)    │
                                              │                         │
                                              │  Clarify → Plan → Task  │
                                              │  → Review → Build       │
                                              │  → Test → Deploy        │
                                              └──────────┬──────────────┘
                                                        │
                                              ┌─────────▼──────────────┐
                                              │  Deploy to Portal      │
                                              │  /apps/{uuid}/v{n}/    │
                                              └──────────┬─────────────┘
                                                        │
                                              ┌─────────▼──────────────┐
                                              │  Push to Git (ADO)     │
                                              │  - Create repo (first) │
                                              │  - Push all source     │
                                              │  - Branch per version  │
                                              └──────────┬─────────────┘
                                                        │
                                              ┌─────────▼──────────────┐
                                              │  Create Jira Issue     │
                                              │  - Link to app URL     │
                                              │  - Link to git repo    │
                                              └────────────────────────┘
```

### 8.2 "Publish to DevOps" → "Build Application"

The existing "Publish to DevOps" button on `IdeaSpecPanel` is replaced:
- **Before:** Pushes spec markdown to a `specs/` folder in an existing ADO repo, creates PR
- **After:** Triggers the autonomous build pipeline, which:
  1. Builds a working application
  2. Deploys it to the Portal
  3. Pushes the **entire application** (source code, docs, spec, tests) to its **own ADO repository**
  4. Creates a Jira issue linking to both the deployed app and the git repo

### 8.3 Git Repository Strategy

Each application gets its **own git repository** (not a folder in a shared repo):
- Repository name: `app-{idea-slug}` (e.g., `app-weather-tracker`)
- Created via ADO REST API when the first version is built
- **Branch strategy:**
  - `main` ← v1 source (first build)
  - `v2` ← branched from main, contains v2 changes
  - `v3` ← branched from v2, contains v3 changes
- Each version push includes: full source, `SPECIFICATION.md`, `PLAN.md`, `TASKS.md`, `STATE.md`, `TECH_REFERENCE.md`

### 8.4 Database Changes

Add to `ideas` table:
```sql
ALTER TABLE ideas ADD COLUMN workspace_uuid TEXT;
ALTER TABLE ideas ADD COLUMN app_repo_url TEXT;
```

- `workspace_uuid`: Links idea to its builder workspace (null until build triggered)
- `app_repo_url`: URL of the created ADO repository (null until git push succeeds)

### 8.5 Git Push Phase (Phase 14 in builder.ts)

**New file:** `scripts/git-publisher.ts`

Uses the existing `adoService` REST API pattern (no local git needed):
1. **Create repository** via ADO REST API: `POST /_apis/git/repositories`
2. **Push initial commit** to `main`: all version files
3. **For subsequent versions:** Create branch from `main`, push changes
4. **Return repo URL** for storage on the idea record

### 8.6 UI Changes

#### IdeaSpecPanel modifications:
- Replace "Publish to DevOps" button with "Build Application" button
- "Build Application" shown when `specReviewStatus === 'under_review'` and user has participated
- Button triggers: save spec → create workspace → start builder → redirect to build progress

#### Development detail page additions:
- Show build progress panel (reads STATE.md) when `workspace_uuid` is set
- Show deployed version links when build completes
- Show git repo link when push succeeds

#### Apps listing integration:
- `/apps` page shows all workspaces (standalone + from Ideas pipeline)
- Ideas-linked workspaces show the idea title and link back to Development page

### Implementation Order
0. [x] Task 0: Specification Interview System
1. [x] Task 1: Workspace Manager
2. [x] Task 2: OpenCode Agent Wrapper (fixed: uses headless server + --attach)
3. [x] Task 3: Version Manager
4. [x] Task 4: SvelteKit Scaffold Template
5. [x] Task 5: Main Builder Orchestrator
6. [x] Task 6: App Proxy Route (Portal)
7. [x] Task 7: Spec Interview UI + Edit & Rebuild Flow (Portal)
8. [x] Task 8: Rebuild API Endpoint
9. [x] Task 9: Security Hardening
10. [x] Task 10: Integration Test Script
11. [ ] Task 11: STATE.md progress display in workspace detail page
12. [ ] Task 12: Database migration (workspace_uuid, app_repo_url on ideas)
13. [ ] Task 13: Git publisher (scripts/git-publisher.ts) using ADO REST API
14. [ ] Task 14: Add Phase 14 (git push) + Phase 15 (jira) to builder.ts
15. [ ] Task 15: Replace "Publish to DevOps" with "Build Application" on IdeaSpecPanel
16. [ ] Task 16: Show build progress on Development detail page
17. [ ] Task 17: End-to-end test via Ideas pipeline

### Post-Implementation Verification
- [ ] Verify AI planning phase completes via OpenCode CLI (--attach)
- [ ] Verify AI build phase produces working code
- [ ] Verify production build succeeds
- [ ] Verify deployment directory populated
- [ ] Verify app accessible at `/apps/{uuid}/v1/`
- [ ] Verify spec edit creates new version (new branch in git)
- [ ] Verify all versions accessible independently
- [ ] Verify git repo created with correct structure
- [ ] Verify Jira issue created with app + repo links
- [ ] Verify Development detail page shows build progress
- [ ] Verify "Build Application" button works from Ideas pipeline
- [ ] Verify Portal auth applies to workspace apps
