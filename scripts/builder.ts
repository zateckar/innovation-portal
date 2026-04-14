import { readFileSync, existsSync, cpSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { createWorkspace, updateMetadata, getWorkspacePath, getVersionPath } from './workspace-manager.ts';
import type { BuildLogEntry } from './workspace-manager.ts';
import { createVersion, markVersionBuilt, deployVersion } from './version-manager.ts';
import { runPhaseWithRetry, runShell, verifyLayer, setHeartbeatPath } from './opencode-agent.ts';
import { validateSpec } from './spec-interviewer.ts';
import { publishToGit } from './git-publisher.ts';
import type { AdoCredentials } from './git-publisher.ts';
import { analyzeWorkspace, formatFindings } from './static-analyzer.ts';
import { checkCompliance, formatCompliance } from './compliance-checker.ts';
import { validateSchema, formatSchemaIssues } from './schema-validator.ts';
import { auditFeatures, formatAudit } from './feature-auditor.ts';
import { parseErrors, formatParsedErrors } from './opencode-agent.ts';

const SCAFFOLD_TEMPLATE = resolve(import.meta.dirname, 'scaffold-template');

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface BuildResult {
	success: boolean;
	uuid: string;
	version: number;
	url: string;
	repoUrl?: string;
	error?: string;
}

interface BuildOptions {
	existingUuid?: string; // Use pre-created workspace UUID instead of generating new one
	ideaSlug?: string; // For git repo naming (app-{slug})
	ideaTitle?: string; // For commit messages
	adoCredentials?: AdoCredentials; // For git push (null = skip git phase)
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Append a timestamped log entry to workspace metadata.
 * Used to give users a real-time activity feed in the UI.
 */
function logBuildPhase(
	uuid: string,
	phase: string,
	message: string,
	status: BuildLogEntry['status'] = 'info'
): void {
	try {
		const metaPath = join(getWorkspacePath(uuid), 'metadata.json');
		if (!existsSync(metaPath)) return;
		const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
		if (!Array.isArray(meta.buildLog)) meta.buildLog = [];
		meta.buildLog.push({
			timestamp: new Date().toISOString(),
			phase,
			message,
			status
		});
		meta.currentPhase = phase;
		writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
	} catch {
		// Non-critical — don't let logging failures break the build
	}
}

function getTechReference(versionPath: string): string {
	const refPath = join(versionPath, 'TECH_REFERENCE.md');
	if (existsSync(refPath)) return readFileSync(refPath, 'utf-8');
	return '';
}

function makeTechRefBlock(versionPath: string): string {
	const techRef = getTechReference(versionPath);
	return techRef
		? `\n\n---\nTECH REFERENCE (read this before writing ANY code):\n${techRef}\n---`
		: '';
}

// ────────────────────────────────────────────────────────────────
// Layer definitions
// ────────────────────────────────────────────────────────────────

function getBuildLayers(techRefBlock: string) {
	return [
		{
			name: 'Layer 1: Database Schema & Tests',
			verify: 'npm run test 2>&1 || true',
			prompt: `Read TASKS.md "Layer 1: Database" section. Read PLAN.md for architecture context.
Read STATE.md for decisions made so far. Read TECH_REFERENCE.md for Drizzle ORM syntax.

Do these steps IN ORDER:
1. Create src/lib/server/db/schema.ts with the EXACT schema from the plan
2. Update src/lib/server/db/index.ts:
   - Keep all existing imports and setup
   - Add sqlite.exec(\`CREATE TABLE IF NOT EXISTS ...\`) for EVERY table in schema.ts
   - The DDL must exactly match the Drizzle schema column names and types
   - Use "CREATE TABLE IF NOT EXISTS" (NOT "CREATE TABLE") so startup is safe
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

CRITICAL AUTH RULE: The user is always authenticated. Get the current user from
event.locals.user (set by hooks.server.ts). Never check session cookies yourself.
Never redirect to /auth/login.

Do these steps IN ORDER:
1. Create +server.ts files for each API endpoint
2. Use event.locals.user for the current user identity
3. Use the existing service functions — import from $lib/server/services/
4. Write tests for each API endpoint
5. Run: npm run test
6. Fix any failures, re-run until all pass

Create ONLY API route files (+server.ts). Do NOT create UI pages yet.

After each task, run its <verify> command. Update STATE.md.${techRefBlock}`
		},
		{
			name: 'Layer 4: UI Pages & Components',
			verify: 'npm run build',
			prompt: `Read TASKS.md "Layer 4: UI Pages" section. Read PLAN.md for component tree.
Read STATE.md for progress. Read TECH_REFERENCE.md for Svelte 5 syntax — this is CRITICAL.

Database, services, and API routes already exist. Now build the UI.

CRITICAL AUTH RULE: Do NOT create any login/logout/callback routes or pages.
The user is always authenticated. The current user is available as:
- In +layout.server.ts / +page.server.ts: event.locals.user
- In Svelte components: data.user (passed from load function)

CRITICAL BASE PATH RULE: ALL links and redirects must use the base path:
- import { base } from '$app/paths'
- <a href="{base}/route"> NOT <a href="/route">
- throw redirect(302, \`\${base}/route\`) NOT throw redirect(302, '/route')

CRITICAL SVELTE 5 RULES:
- let { prop } = $props()    NOT export let prop
- let x = $state(0)          NOT let x = 0 or writable(0)
- $derived(expr)             NOT $: x = expr
- onclick={handler}          NOT on:click={handler}
- {#snippet name()}...{/snippet} NOT <slot>

Do these steps IN ORDER:
1. Create src/routes/+layout.server.ts that returns { user: locals.user }
2. Create +layout.svelte with navigation showing user name (use TailwindCSS, import base)
3. Create +page.svelte and +page.server.ts for each route
4. Create reusable components in src/lib/components/
5. Use form actions (use:enhance) for mutations, load functions for data
6. Run: npm run build
7. If build fails, read the EXACT error message, find the file and line, fix it
8. Re-run build until it succeeds with ZERO errors

DEBUGGING BUILD ERRORS:
- "Cannot find module X" → check the import path, use $lib/ prefix
- "X is not a valid rune" → you used Svelte 4 syntax, check TECH_REFERENCE.md
- "Unexpected token" → check for syntax errors in .svelte files
- Type errors → add proper TypeScript types

UI QUALITY REQUIREMENTS — every page must meet these:
1. RESPONSIVE: Use Tailwind responsive classes (sm:, md:, lg:). Test at mobile and desktop.
2. EMPTY STATES: Every list/table shows EmptyState component from $lib/components/ui when data is empty.
3. LOADING STATES: Every form uses use:enhance with a loading indicator.
4. ERROR DISPLAY: Form validation errors appear inline next to the field using FormField component.
5. DELETE CONFIRMS: Every delete action shows a Modal confirmation first.
6. SUCCESS FEEDBACK: After create/update/delete, show an Alert with a success message.
7. NAVIGATION: Add all routes to the navItems array in +layout.svelte. Current page must be highlighted.
8. ACCESSIBILITY: Every input has a <label> (use FormField), every image has alt, every icon button has aria-label.
9. USE PRE-BUILT COMPONENTS: Import from $lib/components/ui/ (Button, Card, Table, Modal, FormField, Alert, Badge, EmptyState, PageHeader, Spinner).
10. PAGE TITLES: Every page sets <svelte:head><title>Page - App</title></svelte:head>.
11. DELETE BUTTONS: Use variant="danger" (red styling) for delete/remove buttons.${techRefBlock}`
		},
		{
			name: 'Layer 5: Integration & Polish',
			verify: 'npm run test && npm run build && npm run check 2>&1 || true',
			prompt: `Read TASKS.md "Layer 5: Integration" section. Read STATE.md for all progress.
This is the final integration phase. Everything is built. Now verify and polish.

Do these steps IN ORDER:
1. Run: npm run test — fix ANY failures
2. Run: npm run build — fix ANY errors
3. Run: npx svelte-check --tsconfig ./tsconfig.json — fix type errors (if check script exists)
4. Review each page for missing functionality vs SPECIFICATION.md
5. Add any missing edge case handling (empty states, loading states, error states)
6. Verify forms validate input before submitting
7. Verify ALL links use {base}/route format (import base from '$app/paths')
8. Verify ALL redirects use \`\${base}/route\` format
9. Re-run: npm run test && npm run build
10. Repeat until ZERO errors, ZERO warnings

DEBUGGING STRATEGY (follow this exact process):
1. Read the FULL error message
2. Note the file path and line number
3. Open that file, find the line
4. Understand WHY it's wrong (don't guess)
5. Fix the root cause (not symptoms)
6. Re-run the failing command to verify${techRefBlock}`
		}
	];
}

// ────────────────────────────────────────────────────────────────
// Main Pipeline
// ────────────────────────────────────────────────────────────────

export async function buildFromSpec(specPath: string, options: BuildOptions = {}): Promise<BuildResult> {
	// ── Phase 0: Read & Validate Specification ──
	console.log('\n=== Phase 0: Reading & Validating Specification ===');
	if (!existsSync(specPath)) throw new Error(`Specification not found: ${specPath}`);
	const specContent = readFileSync(specPath, 'utf-8');
	console.log(`Spec loaded: ${specContent.length} characters`);

	const validation = validateSpec(specContent);
	if (!validation.valid) {
		console.error('\n──────────────────────────────────────────');
		console.error('  The specification needs more detail before we can start building.');
		console.error('──────────────────────────────────────────');
		console.error('\nPlease add the following:\n');
		for (const m of validation.missing) console.error(`  • ${m}`);
		console.error('\nYou can either:');
		console.error('  1. Edit the specification file directly');
		console.error(
			'  2. Use the interview assistant in the Portal to help fill in the gaps'
		);
		throw new Error('Specification needs more detail');
	}
	console.log('Specification validated: all required sections present');

	// ── Phase 1: Create or use existing workspace ──
	console.log('\n=== Phase 1: Creating Workspace ===');
	// Archive previous buildLog (if any) and start fresh.
	// This preserves logs from failed builds for debugging while
	// keeping the active log clean for the new attempt.
	const _resetUuid = options.existingUuid;
	if (_resetUuid) {
		try {
			const metaPath = join(getWorkspacePath(_resetUuid), 'metadata.json');
			if (existsSync(metaPath)) {
				const m = JSON.parse(readFileSync(metaPath, 'utf-8'));
				// Archive previous log if it exists
				if (Array.isArray(m.buildLog) && m.buildLog.length > 0) {
					if (!Array.isArray(m.previousBuildLogs)) m.previousBuildLogs = [];
					m.previousBuildLogs.push({
						archivedAt: new Date().toISOString(),
						status: m.status ?? 'unknown',
						error: m.error ?? null,
						entries: m.buildLog
					});
					// Keep only the last 5 archived logs to avoid unbounded growth
					if (m.previousBuildLogs.length > 5) {
						m.previousBuildLogs = m.previousBuildLogs.slice(-5);
					}
				}
				m.buildLog = [];
				m.currentPhase = 'Initializing';
				m.error = undefined;
				writeFileSync(metaPath, JSON.stringify(m, null, 2), 'utf-8');
			}
		} catch { /* non-critical */ }
	}
	let metadata;
	if (options.existingUuid && existsSync(join(getWorkspacePath(options.existingUuid), 'metadata.json'))) {
		// Use pre-created workspace (from build API)
		const { readMetadata } = await import('./workspace-manager.ts');
		metadata = readMetadata(options.existingUuid);
		// Update spec in workspace root
		writeFileSync(join(getWorkspacePath(options.existingUuid), 'SPECIFICATION.md'), specContent, 'utf-8');
		console.log(`Using existing workspace: ${metadata.uuid}`);
	} else {
		metadata = createWorkspace(specContent);
	}
	const wsPath = getWorkspacePath(metadata.uuid);
	console.log(`Workspace: ${metadata.uuid} at ${wsPath}`);
	logBuildPhase(metadata.uuid, 'Workspace Setup', 'Workspace created, initializing build environment', 'started');

	// Initialize heartbeat file for external monitoring
	const heartbeatFile = join(wsPath, 'heartbeat.json');
	setHeartbeatPath(heartbeatFile);

	// ── Phase 2: Create version & scaffold ──
	console.log('\n=== Phase 2: Scaffolding Project ===');
	logBuildPhase(metadata.uuid, 'Scaffolding', 'Creating project structure and installing dependencies', 'started');
	const { version, versionPath } = createVersion(metadata.uuid, specContent);
	cpSync(SCAFFOLD_TEMPLATE, versionPath, { recursive: true });

	// Set BASE_PATH so every subsequent npm run build (including AI-triggered ones)
	// bakes the correct base into the SvelteKit manifest. Must use PowerShell-safe env
	// injection; we set process.env here so runShell and opencode-agent inherit it.
	const basePath = `/apps/${metadata.uuid}/v${version}`;
	process.env.BASE_PATH = basePath;
	console.log(`BASE_PATH set: ${basePath}`);

	// Ensure data dir exists for SQLite
	mkdirSync(join(versionPath, 'data'), { recursive: true });

	console.log('Installing dependencies...');
	runShell('npm install', versionPath, 300_000);

	// Verify scaffold builds before AI touches anything
	console.log('Verifying scaffold builds...');
	try {
		runShell('npm run build', versionPath, 120_000);
		console.log('Scaffold verified: builds successfully');
	} catch (err) {
		console.error('Scaffold build failed — fixing before proceeding');
	}

	logBuildPhase(metadata.uuid, 'Scaffolding', 'Project scaffolded and dependencies installed', 'completed');
	updateMetadata(metadata.uuid, { status: 'planning' });
	const techRefBlock = makeTechRefBlock(versionPath);

	// ── Phase 3: AI Clarification (spec-kit pattern) ──
	console.log('\n=== Phase 3: AI Clarification ===');
	logBuildPhase(metadata.uuid, 'AI Clarification', 'Analyzing specification for ambiguities and gaps', 'started');
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
	writeFileSync(
		join(versionPath, 'STATE.md'),
		`# State — Cross-Session Memory
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
`,
		'utf-8'
	);

	logBuildPhase(metadata.uuid, 'AI Clarification', 'Specification analysis complete', 'completed');

	// ── Phase 4: AI Architecture Plan → PLAN.md ──
	console.log('\n=== Phase 4: AI Architecture Plan ===');
	logBuildPhase(metadata.uuid, 'Architecture Plan', 'Designing database schema, routes, and component tree', 'started');
	const planPrompt = `Read SPECIFICATION.md, CLARIFICATIONS.md, and TECH_REFERENCE.md.

IMPORTANT: The specification is written by a business person, not a developer.
It uses everyday language. YOUR job is to translate it into technical architecture.
- "What information does it work with?" → becomes your database schema
- "What screens does it need?" → becomes SvelteKit routes and components
- "How do we know it works" → becomes your test assertions
- "Business rules" → becomes validation logic
- "Should it work on mobile phones?" → becomes responsive TailwindCSS design

CRITICAL RULES — before writing anything:
1. NO AUTH: The user is always authenticated by the proxy. Get user from event.locals.user.
   Never create /auth/login, /auth/logout, /auth/callback routes. Never handle session cookies.
2. BASE PATH: All links use {base}/route syntax. All redirects use \`\${base}/route\` syntax.
   Import base from '$app/paths' in every file that has links or redirects.
3. DB INIT: Tables are created in db/index.ts with sqlite.exec(CREATE TABLE IF NOT EXISTS ...).
   There are no migration files. The DDL must match the Drizzle schema exactly.

Create PLAN.md with ARCHITECTURE DECISIONS ONLY (not individual tasks):

## 1. Database Schema
- Every table, column, type, constraint
- Exact Drizzle ORM schema code (sqliteTable, text, integer)
- The DDL for CREATE TABLE IF NOT EXISTS (to be added in db/index.ts)

## 2. Route Architecture
- Every route with its purpose, load function, and form actions
- Root +layout.server.ts must return { user: locals.user }
- No auth routes

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

	const planResult = await runPhaseWithRetry('architecture', planPrompt, {
		workDir: versionPath
	});
	if (!planResult.success) {
		logBuildPhase(metadata.uuid, 'Architecture Plan', 'Planning failed', 'error');
		updateMetadata(metadata.uuid, { status: 'error', error: 'Planning failed' });
		return { success: false, uuid: metadata.uuid, version, url: '', error: planResult.error };
	}

	logBuildPhase(metadata.uuid, 'Architecture Plan', 'Architecture plan complete', 'completed');

	// ── Phase 5: AI Task Decomposition → TASKS.md ──
	console.log('\n=== Phase 5: AI Task Decomposition ===');
	logBuildPhase(metadata.uuid, 'Task Decomposition', 'Breaking architecture into atomic build tasks', 'started');
	const tasksPrompt = `Read PLAN.md, SPECIFICATION.md, CLARIFICATIONS.md, and TECH_REFERENCE.md.

Create TASKS.md: an ORDERED list of atomic tasks grouped by build layer.

Each task MUST have:
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
- Tasks within the same layer that don't depend on each other can be parallel
- Each task must have a REAL verify step (not "visually inspect")
- Test tasks come BEFORE implementation tasks (TDD)
- Each task should take 2-5 minutes for an AI agent to complete

Write to TASKS.md. Update STATE.md progress.${techRefBlock}`;

	await runPhaseWithRetry('task-decomposition', tasksPrompt, { workDir: versionPath });

	logBuildPhase(metadata.uuid, 'Task Decomposition', 'Task list created', 'completed');

	// ── Phase 6: AI Critical Review ──
	console.log('\n=== Phase 6: AI Critical Review ===');
	logBuildPhase(metadata.uuid, 'Critical Review', 'Senior engineer reviewing plan for issues', 'started');
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
6. PHANTOM TESTS: Are there tests that would pass even if the implementation is empty?
7. DEPENDENCY ORDER: Can Layer 1 tasks run independently? Do Layer 2 tasks only depend on Layer 1?

Fix issues directly in PLAN.md and TASKS.md.
Append a review log to STATE.md listing every issue found and how you fixed it.`;

	await runPhaseWithRetry('review-1', review1Prompt, { workDir: versionPath });

	logBuildPhase(metadata.uuid, 'Critical Review', 'Review complete, issues resolved', 'completed');

	// ── Phase 7: Spec Compliance Check ──
	console.log('\n=== Phase 7: Spec Compliance Check ===');
	logBuildPhase(metadata.uuid, 'Compliance Check', 'Verifying all spec requirements are covered', 'started');

	const compliancePrompt = `Cross-artifact consistency check.

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

	// Augment with programmatic compliance verification
	console.log('  [compliance] Running programmatic compliance check...');
	const complianceResult = checkCompliance(versionPath);
	console.log(formatCompliance(complianceResult));

	if (!complianceResult.passed) {
		const complianceFixPrompt = `Programmatic compliance check found MISSING requirements:

${formatCompliance(complianceResult)}

For each MISSING item:
1. Add architecture for it in PLAN.md
2. Add tasks for it in TASKS.md
3. Ensure the feature/screen/data entity is fully planned

Update the compliance matrix in TASKS.md.${techRefBlock}`;

		await runPhaseWithRetry('compliance-fix', complianceFixPrompt, { workDir: versionPath });
	}

	logBuildPhase(metadata.uuid, 'Compliance Check', 'All requirements verified', 'completed');

	// ── Phase 8: Final Review ──
	console.log('\n=== Phase 8: Final Review ===');
	logBuildPhase(metadata.uuid, 'Final Review', 'Last gate check before autonomous build', 'started');

	const review2Prompt = `Final review of PLAN.md and TASKS.md before autonomous build.

Verify MECHANICAL EXECUTABILITY:
1. Every task says "Create file X with this content" or "Add this code to file X"
2. No task says "implement the logic" without showing what the logic IS
3. Every task has a <verify> command that can be run non-interactively
4. Tests have concrete expect() assertions against specific values (not expect(true))
5. The compliance matrix shows 100% COVERED
6. The dependency graph has no cycles
7. Every Svelte component uses $state/$derived/$props (search for banned patterns)

Fix remaining issues. Update STATE.md. This is the last gate before build.`;

	await runPhaseWithRetry('review-2', review2Prompt, { workDir: versionPath });

	logBuildPhase(metadata.uuid, 'Final Review', 'Build plan approved', 'completed');

	// ── Phase 9: Layered Build ──
	console.log('\n=== Phase 9: Layered Build ===');
	updateMetadata(metadata.uuid, { status: 'building' });

	const layers = getBuildLayers(techRefBlock);

	for (const layer of layers) {
		console.log(`\n--- ${layer.name} ---`);
		logBuildPhase(metadata.uuid, layer.name, `Building ${layer.name.toLowerCase()}`, 'started');

		const result = await runPhaseWithRetry(
			layer.name,
			layer.prompt,
			{ workDir: versionPath, timeout: 20 * 60 * 1000 },
			2
		);

		if (!result.success) {
			updateMetadata(metadata.uuid, {
				status: 'error',
				error: `${layer.name} failed`
			});
			return {
				success: false,
				uuid: metadata.uuid,
				version,
				url: '',
				error: `${layer.name}: ${result.error}`
			};
		}

		// Verify this layer's output
		if (!verifyLayer(layer.name, layer.verify, versionPath)) {
			console.log(`  [${layer.name}] Verification failed, running fix agent...`);
			const fixPrompt = `The build/test verification failed. Run this command and fix ALL errors:

${layer.verify}

Read each error carefully. Fix the root cause. Re-run until it passes.
Do NOT skip errors. Do NOT comment out failing tests. Fix them properly.${techRefBlock}`;

			await runPhaseWithRetry(`${layer.name}-fix`, fixPrompt, { workDir: versionPath });

			if (!verifyLayer(`${layer.name}-retry`, layer.verify, versionPath)) {
				updateMetadata(metadata.uuid, {
					status: 'error',
					error: `${layer.name} verification failed`
				});
				return {
					success: false,
					uuid: metadata.uuid,
					version,
					url: '',
					error: `${layer.name} verification failed`
				};
			}
		}

		// Inter-layer validation: after DB layer, verify schema consistency
		if (layer.name.includes('Layer 1')) {
			console.log('  [schema-check] Validating DDL ↔ Drizzle schema consistency...');
			const schemaResult = validateSchema(versionPath);
			if (!schemaResult.passed) {
				console.log(formatSchemaIssues(schemaResult));
				const schemaFixPrompt = `Schema validation found issues between db/index.ts DDL and db/schema.ts:

${formatSchemaIssues(schemaResult)}

Fix the DDL in src/lib/server/db/index.ts to exactly match the Drizzle schema in src/lib/server/db/schema.ts.
Every column must match: same name, same type, same NOT NULL, same PRIMARY KEY.${techRefBlock}`;
				await runPhaseWithRetry('schema-fix', schemaFixPrompt, { workDir: versionPath });
			}
		}

		logBuildPhase(metadata.uuid, layer.name, `${layer.name} complete`, 'completed');

		// Checkpoint: save a backup after each successful layer
		const checkpointDir = join(versionPath, '.checkpoints', layer.name.replace(/[^a-zA-Z0-9]/g, '-'));
		try {
			cpSync(join(versionPath, 'src'), join(checkpointDir, 'src'), { recursive: true });
			console.log(`  [checkpoint] Saved checkpoint for ${layer.name}`);
		} catch (err) {
			console.warn(`  [checkpoint] Failed to save checkpoint: ${err}`);
		}
	}

	// ── Phase 9.5: UI Quality Audit ──
	console.log('\n=== Phase 9.5: UI Quality Audit ===');
	logBuildPhase(metadata.uuid, 'UI Quality Audit', 'Auditing UI for accessibility, responsiveness, and UX', 'started');
	const uiAuditPrompt = `You are a UI quality auditor. Review every +page.svelte file for these requirements:

1. Does it import and use components from $lib/components/ui/ (Button, Card, Table, FormField, Alert, etc.)?
2. Does it have responsive Tailwind classes (sm:, md:, lg:)?
3. Does it handle the empty state for every list/table (using EmptyState component)?
4. Does every form have use:enhance?
5. Does every form show inline validation errors using FormField with the error prop?
6. Does every delete button have a confirmation Modal?
7. Does it set <svelte:head><title>...</title></svelte:head>?
8. Does every <img> have an alt attribute?
9. Are navItems in +layout.svelte updated with all routes?
10. Does every successful action show a success Alert?

For each issue found, fix it. Import components from $lib/components/ui/.
Run npm run build after all fixes to verify.${techRefBlock}`;

	await runPhaseWithRetry('ui-quality-audit', uiAuditPrompt, {
		workDir: versionPath,
		timeout: 15 * 60 * 1000
	});

	logBuildPhase(metadata.uuid, 'UI Quality Audit', 'UI audit complete', 'completed');

	// ── Phase 10: Loop-Until-Done Test Fix ──
	console.log('\n=== Phase 10: Loop-Until-Done Test Fix ===');
	logBuildPhase(metadata.uuid, 'Testing & Fixing', 'Running test suite and fixing failures', 'started');
	updateMetadata(metadata.uuid, { status: 'testing' });

	const MAX_FIX_LOOPS = 5;
	const FIX_LOOP_TIMEOUT = 10 * 60 * 1000;

	for (let loop = 1; loop <= MAX_FIX_LOOPS; loop++) {
		console.log(`  [fix-loop] Iteration ${loop}/${MAX_FIX_LOOPS}`);

		if (verifyLayer(`loop-${loop}`, 'npm run test && npm run build && npm run check 2>&1 || true', versionPath)) {
			console.log('  [fix-loop] ALL PASSING — exiting loop');
			break;
		}

		if (loop === MAX_FIX_LOOPS) {
			updateMetadata(metadata.uuid, { status: 'error', error: 'Fix loop exhausted' });
			return {
				success: false,
				uuid: metadata.uuid,
				version,
				url: '',
				error: `Fix loop exhausted after ${MAX_FIX_LOOPS} iterations`
			};
		}

		const escalationStrategies = [
			// Iteration 1: targeted fix
			`Tests or build are failing. Fix iteration ${loop}/${MAX_FIX_LOOPS}.

Run: npm run test && npm run build && npm run check 2>&1 || true

Fix each specific error at the exact file and line. Read the FULL error message before fixing.
Do NOT delete tests. Do NOT comment out code. Fix root causes.
Update STATE.md.${techRefBlock}`,
			// Iteration 2: rewrite failing files
			`Tests or build STILL failing after previous fix attempt. Iteration ${loop}/${MAX_FIX_LOOPS}.

Run: npm run test && npm run build

For each failing file:
1. Read the original task in TASKS.md that created it
2. Read PLAN.md for the intended design
3. REWRITE the failing file from scratch following the plan
4. Do NOT patch — start fresh for that specific file
Update STATE.md.${techRefBlock}`,
			// Iteration 3: simplify
			`Tests or build STILL failing. Iteration ${loop}/${MAX_FIX_LOOPS}.

Take a simpler approach:
1. Remove any overly complex logic
2. Use the most straightforward implementation possible
3. If a test is testing an edge case that's hard to implement, simplify the test to test core behavior
4. Run: npm run test && npm run build
Update STATE.md.${techRefBlock}`,
			// Iteration 4: alternative approach
			`Tests or build STILL failing. Iteration ${loop}/${MAX_FIX_LOOPS}.

The current approach isn't working. Try a COMPLETELY different solution:
1. Read the error messages carefully
2. Think about what ALTERNATIVE approach could work
3. Implement the alternative
4. Run: npm run test && npm run build
Update STATE.md.${techRefBlock}`,
			// Iteration 5: minimal viable
			`FINAL attempt. Iteration ${loop}/${MAX_FIX_LOOPS}.

Get the app building by any means necessary:
1. If a test is fundamentally wrong, fix the test to match actual behavior
2. If a feature is too complex to implement correctly, create a simplified version
3. Document any simplifications in STATE.md under "Known Limitations"
4. Run: npm run test && npm run build — this MUST pass
Update STATE.md.${techRefBlock}`
		];

		const fixPrompt = escalationStrategies[Math.min(loop - 1, escalationStrategies.length - 1)];

		await runPhaseWithRetry(`fix-loop-${loop}`, fixPrompt, {
			workDir: versionPath,
			timeout: FIX_LOOP_TIMEOUT
		});
	}

	logBuildPhase(metadata.uuid, 'Testing & Fixing', 'All tests passing', 'completed');

	// ── Phase 11: Phantom-Completion Detection ──
	console.log('\n=== Phase 11: Phantom-Completion Detection ===');
	logBuildPhase(metadata.uuid, 'Quality Assurance', 'Detecting phantom completions and missing wiring', 'started');

	const phantomPrompt = `You are a QA auditor. Check for PHANTOM COMPLETIONS — code that looks done but isn't.

Read TASKS.md and check each completed task against the actual code:

1. PHANTOM TESTS: Find tests that always pass regardless of implementation:
   - expect(true).toBe(true)
   - Tests with no assertions
   - Tests that mock everything including the thing being tested

2. PHANTOM IMPLEMENTATIONS: Find code that exists but doesn't work:
   - Functions that return hardcoded values instead of real logic
   - TODO/FIXME comments in production code
   - Catch blocks that silently swallow errors

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
		await runPhaseWithRetry(
			'post-phantom-fix',
			`npm run test && npm run build are failing after phantom-completion fixes. Fix ALL errors. Update STATE.md.${techRefBlock}`,
			{ workDir: versionPath, timeout: 10 * 60 * 1000 }
		);
		if (!verifyLayer('final-check', 'npm run test && npm run build', versionPath)) {
			updateMetadata(metadata.uuid, {
				status: 'error',
				error: 'Final verification failed'
			});
			return {
				success: false,
				uuid: metadata.uuid,
				version,
				url: '',
				error: 'Final verification failed'
			};
		}
	}

	logBuildPhase(metadata.uuid, 'Quality Assurance', 'Phantom detection complete', 'completed');

	// ── Phase 11.5: Static Analysis ──
	console.log('\n=== Phase 11.5: Static Analysis ===');
	logBuildPhase(metadata.uuid, 'Static Analysis', 'Analyzing code quality and patterns', 'started');
	const analysisResult = analyzeWorkspace(versionPath);
	console.log(formatFindings(analysisResult));

	if (analysisResult.errorCount > 0) {
		const staticFixPrompt = `Static analysis found code quality issues that must be fixed:

${formatFindings(analysisResult)}

Fix each issue at the exact file and line listed above. These are CRITICAL issues:
- Svelte 4 syntax must be converted to Svelte 5
- Missing {base} prefix in links causes 404 errors in production
- Missing IF NOT EXISTS in CREATE TABLE causes startup crashes
- Auth routes must not exist — auth is handled by the proxy

After fixing, run: npm run build to verify.${techRefBlock}`;

		await runPhaseWithRetry('static-analysis-fix', staticFixPrompt, {
			workDir: versionPath,
			timeout: 10 * 60 * 1000
		});
	}

	logBuildPhase(metadata.uuid, 'Static Analysis', 'Static analysis complete', 'completed');

	// ── Phase 11.6: Feature Audit ──
	console.log('\n=== Phase 11.6: Feature Audit ===');
	logBuildPhase(metadata.uuid, 'Feature Audit', 'Verifying all features are implemented and connected', 'started');
	const auditResult = auditFeatures(versionPath);
	console.log(formatAudit(auditResult));

	if (!auditResult.passed) {
		const auditFixPrompt = `Feature audit found missing features:

${formatAudit(auditResult)}

For each missing route:
1. Read PLAN.md to understand what the route should do
2. Create the +page.svelte and +page.server.ts files
3. Import and use components from $lib/components/ui/
4. Follow the patterns from existing pages

After fixing, run: npm run build to verify.${techRefBlock}`;

		await runPhaseWithRetry('feature-audit-fix', auditFixPrompt, {
			workDir: versionPath,
			timeout: 15 * 60 * 1000
		});
	}

	logBuildPhase(metadata.uuid, 'Feature Audit', 'Feature audit complete', 'completed');

	// ── Phase 12: Deploy ──
	console.log('\n=== Phase 12: Deploying ===');
	logBuildPhase(metadata.uuid, 'Deploying', 'Packaging and deploying application', 'started');
	updateMetadata(metadata.uuid, { status: 'deploying' });

	const buildDir = join(versionPath, 'build');
	if (!existsSync(buildDir)) {
		updateMetadata(metadata.uuid, { status: 'error', error: 'No build output' });
		return {
			success: false,
			uuid: metadata.uuid,
			version,
			url: '',
			error: 'No build output found'
		};
	}

	const deployPath = deployVersion(metadata.uuid, version);
	markVersionBuilt(metadata.uuid, version);

	const hostname = process.env.HOST || 'localhost';
	const port = process.env.PORT || '3000';
	const url = `http://${hostname}:${port}/apps/${metadata.uuid}/v${version}/`;

	// ── Phase 12.5: E2E Smoke Test ──
	console.log('\n=== Phase 12.5: Post-Deployment E2E Smoke Test ===');
	logBuildPhase(metadata.uuid, 'Smoke Test', 'Starting post-deployment verification', 'started');
	try {
		// Start the workspace process to verify it boots
		const { startWorkspaceProcess, stopWorkspaceProcess } = await import(
			'../src/lib/server/services/workspaceProcessManager.ts'
		);
		const smokePort = await startWorkspaceProcess(metadata.uuid, version);
		if (smokePort) {
			// Wait for the process to fully initialize
			await new Promise(r => setTimeout(r, 3000));

			const smokeBaseUrl = `http://127.0.0.1:${smokePort}${basePath}`;
			const smokeResults: Array<{ route: string; status: number | string; ok: boolean }> = [];

			// 1. Check index page
			try {
				const res = await fetch(`${smokeBaseUrl}/`, { signal: AbortSignal.timeout(10_000) });
				smokeResults.push({ route: '/', status: res.status, ok: res.ok });
			} catch (e) {
				smokeResults.push({ route: '/', status: String(e), ok: false });
			}

			// 2. Discover and test all routes from PLAN.md
			const planPath = join(versionPath, 'PLAN.md');
			if (existsSync(planPath)) {
				const planContent = readFileSync(planPath, 'utf-8');
				// Extract routes like /items, /items/[id], /dashboard, etc.
				const routeMatches = planContent.match(/\/[a-z][a-z0-9-/[\]]*(?=[\s,)`|])/gi) ?? [];
				const uniqueRoutes = [...new Set(routeMatches)]
					.filter(r => !r.includes('[') && r !== '/') // skip parameterized & root (already tested)
					.slice(0, 20); // cap at 20 routes

				for (const route of uniqueRoutes) {
					try {
						const res = await fetch(`${smokeBaseUrl}${route}`, {
							signal: AbortSignal.timeout(8_000),
							redirect: 'follow'
						});
						smokeResults.push({ route, status: res.status, ok: res.ok || res.status === 303 });
					} catch (e) {
						smokeResults.push({ route, status: 'timeout', ok: false });
					}
				}
			}

			// 3. Report results
			const passed = smokeResults.filter(r => r.ok).length;
			const failed = smokeResults.filter(r => !r.ok).length;
			console.log(`  [smoke-test] ${passed} passed, ${failed} failed out of ${smokeResults.length} routes`);
			for (const r of smokeResults) {
				console.log(`    ${r.ok ? '✓' : '✗'} ${r.route} → ${r.status}`);
			}

			logBuildPhase(metadata.uuid, 'Smoke Test',
				`${passed}/${smokeResults.length} routes responding (${failed} issues)`,
				failed > 0 ? 'info' : 'completed');

			// Stop the process (it will be restarted on-demand by the proxy)
			stopWorkspaceProcess(metadata.uuid, version);
		} else {
			console.warn('  [smoke-test] Could not start workspace process — WARNING');
			logBuildPhase(metadata.uuid, 'Smoke Test', 'Could not start workspace process', 'error');
		}
	} catch (smokeErr) {
		console.warn(`  [smoke-test] Smoke test failed (non-fatal): ${smokeErr}`);
		logBuildPhase(metadata.uuid, 'Smoke Test', `Non-fatal error: ${smokeErr}`, 'error');
	}

	logBuildPhase(metadata.uuid, 'Deploying', 'Application deployed', 'completed');

	// ── Phase 13: Seed Data ──
	console.log('\n=== Phase 13: Seed Data Generation ===');
	logBuildPhase(metadata.uuid, 'Seed Data', 'Generating realistic sample data', 'started');
	const seedPrompt = `Read SPECIFICATION.md and the database schema in src/lib/server/db/schema.ts.

Generate realistic sample data for the application:
1. Create a file src/lib/server/db/seed.ts that exports a seedDatabase() function
2. The function should insert 5-10 realistic records per table
3. Use the Drizzle ORM db.insert() API — NOT raw SQL
4. Use realistic names, descriptions, dates — NOT "test1", "test2"
5. Respect foreign key relationships (create parent records before children)
6. Import and call seedDatabase() at the end of src/lib/server/db/index.ts (after table creation)
7. Guard with a check: only seed if tables are empty
8. Run: npm run build to verify

Example seed guard:
const count = db.select().from(schema.items).all().length;
if (count === 0) seedDatabase();${techRefBlock}`;

	await runPhaseWithRetry('seed-data', seedPrompt, {
		workDir: versionPath,
		timeout: 10 * 60 * 1000
	});

	// Verify build still works after seeding
	if (!verifyLayer('post-seed', 'npm run build', versionPath)) {
		await runPhaseWithRetry(
			'post-seed-fix',
			`npm run build is failing after seed data was added. Fix the build errors. Do not remove the seed data — fix the code.${techRefBlock}`,
			{ workDir: versionPath }
		);
	}

	logBuildPhase(metadata.uuid, 'Seed Data', 'Sample data generated', 'completed');

	// ── Phase 14: Push to Git Repository ──
	let repoUrl: string | undefined;
	if (options.adoCredentials && options.ideaSlug) {
		console.log('\n=== Phase 14: Pushing to Git Repository ===');
		try {
			const gitResult = await publishToGit(
				options.ideaSlug,
				options.ideaTitle || 'Application',
				versionPath,
				version,
				options.adoCredentials
			);
			repoUrl = gitResult.repoUrl;
			console.log(`  Git repo: ${repoUrl}`);
			console.log(`  Branch: ${gitResult.branchName}`);
		} catch (err: unknown) {
			const gitErr = err as { message: string };
			console.warn(`  [git] Push failed (non-fatal): ${gitErr.message}`);
			// Git push failure is non-fatal — the app is already deployed
		}
	} else {
		console.log('\n=== Phase 14: Git Push SKIPPED (no ADO credentials or idea slug) ===');
	}

	logBuildPhase(metadata.uuid, 'Build Complete', 'Application built and deployed successfully', 'completed');

	console.log('\n=============================');
	console.log('  DEPLOYMENT COMPLETE');
	console.log(`  URL: ${url}`);
	if (repoUrl) console.log(`  Repo: ${repoUrl}`);
	console.log(`  Workspace: ${wsPath}`);
	console.log(`  Version: v${version}`);
	console.log('=============================');

	return { success: true, uuid: metadata.uuid, version, url, repoUrl };
}

// ────────────────────────────────────────────────────────────────
// Rebuild from updated specification
// ────────────────────────────────────────────────────────────────

export async function rebuildFromSpec(uuid: string, specPath: string): Promise<BuildResult> {
	const specContent = readFileSync(specPath, 'utf-8');
	const wsPath = getWorkspacePath(uuid);

	// Update spec in workspace root
	writeFileSync(join(wsPath, 'SPECIFICATION.md'), specContent, 'utf-8');

	// Create new version (copies from previous version's source)
	const { version, versionPath } = createVersion(uuid, specContent);
	console.log(`New version ${version} created`);

	// Ensure BASE_PATH is set for all subsequent builds
	const basePath = `/apps/${uuid}/v${version}`;
	process.env.BASE_PATH = basePath;
	console.log(`BASE_PATH set: ${basePath}`);

	// Install deps if node_modules doesn't exist
	if (!existsSync(join(versionPath, 'node_modules'))) {
		runShell('npm install', versionPath, 300_000);
	}

	const techRefBlock = makeTechRefBlock(versionPath);

	// Compute spec diff for targeted rebuild
	const prevSpecPath = join(getVersionPath(uuid, version - 1), 'SPECIFICATION.md');
	let specDiffSection = '';
	if (existsSync(prevSpecPath)) {
		const prevSpec = readFileSync(prevSpecPath, 'utf-8');
		const newSpec = specContent;
		
		// Extract section-level changes
		const sections = ['1. What is this application', '2. Who will use it', '3. What information', '4. What should the application do', '5. What screens', '6. Business rules', '7. Any other'];
		const diffs: string[] = [];
		
		for (const section of sections) {
			const sectionRegex = new RegExp(`##\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n## |$)`, 'i');
			const prevMatch = prevSpec.match(sectionRegex);
			const newMatch = newSpec.match(sectionRegex);
			
			if (!prevMatch && newMatch) {
				diffs.push(`ADDED: Section "${section}" is new`);
			} else if (prevMatch && !newMatch) {
				diffs.push(`REMOVED: Section "${section}" was removed`);
			} else if (prevMatch && newMatch && prevMatch[0].trim() !== newMatch[0].trim()) {
				diffs.push(`CHANGED: Section "${section}" was modified`);
			}
		}
		
		if (diffs.length > 0) {
			specDiffSection = `\n\nSPEC CHANGES DETECTED:\n${diffs.map(d => `- ${d}`).join('\n')}\n\nFocus your changes on these sections. Do NOT rewrite unchanged code.`;
		}
	}

	// AI: Diff-aware rebuild
	const rebuildPrompt = `SPECIFICATION.md has been updated. A previous version of this app exists.

1. Read the NEW SPECIFICATION.md
2. Read PLAN.md and TASKS.md (from previous version)
3. Identify WHAT CHANGED between old and new spec
${specDiffSection}
4. For each change:
   a. Update PLAN.md with new/modified architecture
   b. Write/update tests FIRST for changed features
   c. Implement the change following the plan
   d. Run: npm run test — fix failures
5. After all changes: npm run build — fix errors
6. Run: npm run check 2>&1 || true — fix type errors
7. Final: npm run test && npm run build must both pass

Do NOT rewrite unchanged code. Only modify what the spec changes require.
Do NOT ask for user input. Build autonomously.
Update STATE.md with progress.${techRefBlock}`;

	const result = await runPhaseWithRetry(
		'rebuild',
		rebuildPrompt,
		{ workDir: versionPath, timeout: 45 * 60 * 1000 },
		2
	);

	if (!result.success) {
		updateMetadata(uuid, { status: 'error', error: 'Rebuild failed: ' + result.error });
		return { success: false, uuid, version, url: '', error: result.error };
	}

	// Verify build
	if (!verifyLayer('rebuild-verify', 'npm run test && npm run build', versionPath)) {
		updateMetadata(uuid, { status: 'error', error: 'Rebuild verification failed' });
		return { success: false, uuid, version, url: '', error: 'Rebuild verification failed' };
	}

	deployVersion(uuid, version);
	markVersionBuilt(uuid, version);

	const hostname = process.env.HOST || 'localhost';
	const port = process.env.PORT || '3000';
	const url = `http://${hostname}:${port}/apps/${uuid}/v${version}/`;

	return { success: true, uuid, version, url };
}

// ────────────────────────────────────────────────────────────────
// CLI entry point
// ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

// Parse --uuid flag from args
function extractFlag(flag: string): string | undefined {
	const idx = args.indexOf(flag);
	if (idx >= 0 && args[idx + 1]) {
		const val = args[idx + 1];
		args.splice(idx, 2); // remove flag and value from args
		return val;
	}
	return undefined;
}
const existingUuid = extractFlag('--uuid');

/**
 * Mark workspace as error on unhandled crash.
 * This is the safety net — ensures metadata never stays "building" forever.
 */
function markBuildError(uuid: string | undefined, error: string): void {
	if (!uuid) return;
	try {
		updateMetadata(uuid, {
			status: 'error',
			error: `Build crashed: ${error}`
		} as any);
	} catch {
		// Last resort: write directly to metadata.json
		try {
			const metaPath = join(getWorkspacePath(uuid), 'metadata.json');
			if (existsSync(metaPath)) {
				const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
				meta.status = 'error';
				meta.error = `Build crashed: ${error}`;
				meta.lastUpdated = new Date().toISOString();
				writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
			}
		} catch {
			// Truly nothing we can do
		}
	}
}

// Global crash handlers — ensure metadata is updated even on unexpected errors
process.on('uncaughtException', (err) => {
	console.error('UNCAUGHT EXCEPTION:', err);
	markBuildError(existingUuid, err.message);
	process.exit(1);
});

process.on('unhandledRejection', (reason) => {
	console.error('UNHANDLED REJECTION:', reason);
	markBuildError(existingUuid, String(reason));
	process.exit(1);
});

// Handle SIGTERM/SIGINT gracefully (e.g., process killed by OS or user)
process.on('SIGTERM', () => {
	console.warn('Received SIGTERM — marking build as error');
	markBuildError(existingUuid, 'Process terminated by SIGTERM');
	process.exit(1);
});

process.on('SIGINT', () => {
	console.warn('Received SIGINT — marking build as error');
	markBuildError(existingUuid, 'Process interrupted by SIGINT');
	process.exit(1);
});

if (args[0] === 'build' && args[1]) {
	buildFromSpec(resolve(args[1]), { existingUuid })
		.then((r) => {
			console.log(r.success ? `\nSUCCESS: ${r.url}` : `\nFAILED: ${r.error}`);
			if (!r.success) markBuildError(existingUuid, r.error || 'Unknown error');
			process.exit(r.success ? 0 : 1);
		})
		.catch((e) => {
			console.error('Fatal:', e.message || e);
			markBuildError(existingUuid, e.message || String(e));
			process.exit(1);
		});
} else if (args[0] === 'rebuild' && args[1] && args[2]) {
	rebuildFromSpec(args[1], resolve(args[2]))
		.then((r) => {
			console.log(r.success ? `\nSUCCESS: ${r.url}` : `\nFAILED: ${r.error}`);
			process.exit(r.success ? 0 : 1);
		})
		.catch((e) => {
			console.error('Fatal:', e.message || e);
			process.exit(1);
		});
} else if (args[0]) {
	console.log('Usage:');
	console.log('  npx tsx scripts/builder.ts build <path-to-SPECIFICATION.md>');
	console.log('  npx tsx scripts/builder.ts rebuild <uuid> <path-to-SPECIFICATION.md>');
}
