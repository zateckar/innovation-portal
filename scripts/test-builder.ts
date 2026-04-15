/**
 * Integration test: create a simple spec, run validation, verify workspace creation.
 * Does NOT run the full AI build pipeline (that takes 30-60 minutes).
 * Use `npx tsx scripts/builder.ts build <spec>` for a real end-to-end test.
 */
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { validateSpec } from './spec-interviewer.ts';
import { createWorkspace, getWorkspacePath, readMetadata, listWorkspaces } from './workspace-manager.ts';
import { createVersion, listVersions } from './version-manager.ts';

const TEST_SPEC = `# Task Tracker

## 1. What is this application?
A simple task tracking application where team members can create, assign, and
track tasks through to completion. It helps small teams stay organized without
needing complex project management tools.

## 2. Who will use it?
- **Team member** — can create tasks, update their own tasks, view all tasks
- **Team lead** — can do everything a team member can, plus delete any task and assign tasks to others

## 3. What information does the application work with?
- **Task**: has a title, description, status (to do / in progress / done),
  priority (low / medium / high), who created it, who it's assigned to,
  when it was created, when it was last updated
- **User**: name, email, role (team member or team lead)

## 4. What should the application do?

### Create a task
- **What the user does:** Fills in a title and optionally a description and priority, then clicks "Add task"
- **What should happen:** The task appears in the task list with status "to do"
- **What if something goes wrong:** If the title is empty, show "Please enter a task title"
- **How do we know it works:** I can type "Buy supplies" and click Add, and it appears in my list immediately

### Update task status
- **What the user does:** Clicks a status button on a task to move it to the next stage
- **What should happen:** The task status changes (to do → in progress → done)
- **What if something goes wrong:** Nothing — status always moves forward
- **How do we know it works:** I click "Start" on a to-do task and it moves to the "in progress" column

### Delete a task
- **What the user does:** Clicks the delete button on a task
- **What should happen:** The task is removed from the list
- **What if something goes wrong:** Only team leads can delete; team members see no delete button
- **How do we know it works:** As a team lead, I click delete and the task disappears

### View all tasks
- **What the user does:** Opens the main page
- **What should happen:** Sees all tasks grouped by status (to do, in progress, done)
- **What if something goes wrong:** If no tasks exist, show "No tasks yet — create one!"
- **How do we know it works:** I see three columns with tasks sorted by status

## 5. What screens does the application need?

### Dashboard
- **What is it for:** Main screen showing all tasks
- **What does it show:** Three columns: To Do, In Progress, Done, each with task cards
- **What can the user do here:** Create new task, change task status, delete task (leads only)
- **Where can the user go from here:** Click a task to see its details

### Task Detail
- **What is it for:** Viewing and editing a single task
- **What does it show:** All task fields, edit form
- **What can the user do here:** Edit title, description, priority, assignment, status
- **Where can the user go from here:** Back to dashboard

## 6. Business rules and constraints
- A task title must not be empty
- A task title must be at most 200 characters
- Only team leads can delete tasks
- Any user can change the status of any task
- Tasks cannot go backward in status (done cannot go back to in progress)

## 7. Any other requirements?
- Should work on mobile phones
- Clean, minimal design
`;

async function runTest() {
	console.log('=== Builder Integration Test ===\n');

	// Test 1: Spec validation
	console.log('--- Test 1: Spec Validation ---');
	const valid = validateSpec(TEST_SPEC);
	console.log(`  Valid: ${valid.valid}`);
	if (!valid.valid) {
		console.error('  FAILED: spec should be valid');
		console.error('  Missing:', valid.missing);
		process.exit(1);
	}
	console.log('  PASSED\n');

	// Test 2: Invalid spec detection
	console.log('--- Test 2: Invalid Spec Detection ---');
	const invalid = validateSpec('# My App\n\nJust a simple app.');
	console.log(`  Valid: ${invalid.valid} (expected: false)`);
	if (invalid.valid) {
		console.error('  FAILED: incomplete spec should be invalid');
		process.exit(1);
	}
	console.log(`  Missing sections: ${invalid.missing.length}`);
	console.log('  PASSED\n');

	// Test 3: Workspace creation
	console.log('--- Test 3: Workspace Creation ---');
	const meta = createWorkspace(TEST_SPEC);
	console.log(`  UUID: ${meta.uuid}`);
	console.log(`  Status: ${meta.status}`);
	const wsPath = getWorkspacePath(meta.uuid);
	console.log(`  Path: ${wsPath}`);
	if (!existsSync(wsPath)) {
		console.error('  FAILED: workspace directory not created');
		process.exit(1);
	}
	console.log('  PASSED\n');

	// Test 4: Version creation
	console.log('--- Test 4: Version Creation ---');
	const { version, versionPath } = createVersion(meta.uuid, TEST_SPEC);
	console.log(`  Version: ${version}`);
	console.log(`  Path: ${versionPath}`);
	if (!existsSync(versionPath)) {
		console.error('  FAILED: version directory not created');
		process.exit(1);
	}
	const versions = listVersions(meta.uuid);
	console.log(`  Total versions: ${versions.length}`);
	console.log('  PASSED\n');

	// Test 5: Workspace listing
	console.log('--- Test 5: Workspace Listing ---');
	const workspaces = listWorkspaces();
	console.log(`  Total workspaces: ${workspaces.length}`);
	const found = workspaces.find((w) => w.uuid === meta.uuid);
	if (!found) {
		console.error('  FAILED: workspace not found in listing');
		process.exit(1);
	}
	console.log('  PASSED\n');

	// Cleanup
	console.log('--- Cleanup ---');
	rmSync(wsPath, { recursive: true, force: true });
	console.log('  Test workspace removed\n');

	console.log('=== ALL TESTS PASSED ===');
	console.log('\nTo run a full AI build:');
	console.log('  bun scripts/builder.ts build <path-to-SPECIFICATION.md>');
}

runTest().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
