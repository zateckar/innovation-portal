/**
 * Git Publisher - pushes built application source code to Azure DevOps.
 *
 * Each application gets its OWN repository (not a folder in a shared repo).
 * - Repository name: app-{ideaSlug}
 * - v1 → pushed to `main` branch
 * - v2+ → pushed to `v{n}` branch (branched from main)
 *
 * Uses ADO REST API (same pattern as ado.ts) - no local git binary needed.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative, posix } from 'path';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface AdoCredentials {
	orgUrl: string;
	project: string;
	pat: string;
	targetBranch: string;
}

export interface GitPublishResult {
	repoUrl: string;
	repoId: string;
	branchName: string;
}

interface FileEntry {
	path: string; // forward-slash posix path relative to repo root
	contentBase64: string;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function buildHeaders(pat: string): Record<string, string> {
	const token = Buffer.from(`:${pat}`).toString('base64');
	return {
		Authorization: `Basic ${token}`,
		'Content-Type': 'application/json',
		Accept: 'application/json'
	};
}

/**
 * Collect all files in a directory tree, returning their relative paths and base64 content.
 * Skips node_modules, .git, build, deployment directories.
 */
function collectFiles(rootDir: string, currentDir?: string): FileEntry[] {
	const dir = currentDir || rootDir;
	const entries: FileEntry[] = [];

	const SKIP_DIRS = new Set([
		'node_modules', '.git', 'build', 'deployment', '.svelte-kit',
		'.opencode', '.agent-prompt.tmp', 'data'
	]);

	for (const item of readdirSync(dir, { withFileTypes: true })) {
		if (SKIP_DIRS.has(item.name)) continue;
		if (item.name.startsWith('.agent-')) continue;

		const fullPath = join(dir, item.name);

		if (item.isDirectory()) {
			entries.push(...collectFiles(rootDir, fullPath));
		} else if (item.isFile()) {
			const relativePath = relative(rootDir, fullPath).split('\\').join('/');
			const content = readFileSync(fullPath);
			entries.push({
				path: relativePath,
				contentBase64: content.toString('base64')
			});
		}
	}

	return entries;
}

// ────────────────────────────────────────────────────────────────
// ADO Repository Operations
// ────────────────────────────────────────────────────────────────

/**
 * Create a new ADO Git repository for the application.
 * Returns the repo ID and web URL.
 */
async function createRepository(
	repoName: string,
	creds: AdoCredentials
): Promise<{ repoId: string; repoUrl: string }> {
	const headers = buildHeaders(creds.pat);

	// First, get the project ID (required for repo creation)
	const projectUrl = `${creds.orgUrl}/_apis/projects/${encodeURIComponent(creds.project)}?api-version=7.1`;
	const projectRes = await fetch(projectUrl, { headers });
	if (!projectRes.ok) throw new Error(`Failed to get project: ${projectRes.status}`);
	const projectData = (await projectRes.json()) as { id: string };

	// Create the repository
	const createUrl = `${creds.orgUrl}/${encodeURIComponent(creds.project)}/_apis/git/repositories?api-version=7.1`;
	const createBody = {
		name: repoName,
		project: { id: projectData.id }
	};

	const createRes = await fetch(createUrl, {
		method: 'POST',
		headers,
		body: JSON.stringify(createBody)
	});

	if (!createRes.ok) {
		const body = await createRes.text();
		// If repo already exists (409 Conflict), find it
		if (createRes.status === 409) {
			return findRepository(repoName, creds);
		}
		throw new Error(`Failed to create repository: ${createRes.status} — ${body.slice(0, 300)}`);
	}

	const repoData = (await createRes.json()) as {
		id: string;
		_links?: { web?: { href: string } };
		webUrl?: string;
	};

	const repoUrl =
		repoData._links?.web?.href ||
		repoData.webUrl ||
		`${creds.orgUrl}/${encodeURIComponent(creds.project)}/_git/${repoName}`;

	return { repoId: repoData.id, repoUrl };
}

/**
 * Find an existing repository by name.
 */
async function findRepository(
	repoName: string,
	creds: AdoCredentials
): Promise<{ repoId: string; repoUrl: string }> {
	const headers = buildHeaders(creds.pat);
	const url = `${creds.orgUrl}/${encodeURIComponent(creds.project)}/_apis/git/repositories/${encodeURIComponent(repoName)}?api-version=7.1`;

	const res = await fetch(url, { headers });
	if (!res.ok) throw new Error(`Repository '${repoName}' not found: ${res.status}`);

	const data = (await res.json()) as {
		id: string;
		_links?: { web?: { href: string } };
		webUrl?: string;
	};

	const repoUrl =
		data._links?.web?.href ||
		data.webUrl ||
		`${creds.orgUrl}/${encodeURIComponent(creds.project)}/_git/${repoName}`;

	return { repoId: data.id, repoUrl };
}

/**
 * Push files to a branch in the repository.
 * For the first push (empty repo), creates the initial commit on main.
 * For subsequent versions, creates a new branch from main.
 */
async function pushFiles(
	repoId: string,
	files: FileEntry[],
	branchName: string,
	commitMessage: string,
	creds: AdoCredentials,
	isInitial: boolean
): Promise<void> {
	const headers = buildHeaders(creds.pat);
	const apiVersion = 'api-version=7.1';
	const repoApiBase = `${creds.orgUrl}/${encodeURIComponent(creds.project)}/_apis/git/repositories/${encodeURIComponent(repoId)}`;

	let oldObjectId = '0000000000000000000000000000000000000000';

	if (!isInitial) {
		// Get the tip of main to branch from
		const refsUrl = `${repoApiBase}/refs?filter=heads/main&${apiVersion}`;
		const refsRes = await fetch(refsUrl, { headers });
		if (refsRes.ok) {
			const refsData = (await refsRes.json()) as { value: { objectId: string }[] };
			if (refsData.value?.[0]?.objectId) {
				oldObjectId = refsData.value[0].objectId;
			}
		}
	}

	// Build the push with all file changes
	const changes = files.map((f) => ({
		changeType: 'add' as const,
		item: { path: `/${f.path}` },
		newContent: { content: f.contentBase64, contentType: 'base64Encoded' as const }
	}));

	// ADO has a limit on push size. Batch if needed (typically up to 100 changes per push).
	const BATCH_SIZE = 80;
	const batches: typeof changes[] = [];
	for (let i = 0; i < changes.length; i += BATCH_SIZE) {
		batches.push(changes.slice(i, i + BATCH_SIZE));
	}

	const refName = `refs/heads/${branchName}`;

	for (let i = 0; i < batches.length; i++) {
		const pushUrl = `${repoApiBase}/pushes?${apiVersion}`;
		const pushBody = {
			refUpdates: [
				{
					name: refName,
					oldObjectId: i === 0 ? oldObjectId : undefined
				}
			],
			commits: [
				{
					comment: i === 0 ? commitMessage : `${commitMessage} (part ${i + 1})`,
					changes: batches[i]
				}
			]
		};

		// For subsequent batches, we need the new tip
		if (i > 0) {
			const refsUrl = `${repoApiBase}/refs?filter=heads/${branchName}&${apiVersion}`;
			const refsRes = await fetch(refsUrl, { headers });
			if (refsRes.ok) {
				const refsData = (await refsRes.json()) as { value: { objectId: string }[] };
				pushBody.refUpdates[0].oldObjectId = refsData.value[0]?.objectId;
			}
		}

		const pushRes = await fetch(pushUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(pushBody)
		});

		if (!pushRes.ok) {
			const body = await pushRes.text();
			throw new Error(
				`Failed to push files (batch ${i + 1}/${batches.length}): ${pushRes.status} — ${body.slice(0, 300)}`
			);
		}
	}
}

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Publish a built application to its own ADO Git repository.
 *
 * @param ideaSlug - Used for repo naming: app-{slug}
 * @param ideaTitle - Used in commit messages
 * @param versionPath - Path to the version directory to push
 * @param version - Version number (1 = main, 2+ = branch)
 * @param creds - ADO credentials (from settings DB)
 */
export async function publishToGit(
	ideaSlug: string,
	ideaTitle: string,
	versionPath: string,
	version: number,
	creds: AdoCredentials
): Promise<GitPublishResult> {
	const repoName = `app-${ideaSlug}`;
	const isInitial = version === 1;
	const branchName = isInitial ? 'main' : `v${version}`;

	console.log(`  [git] Publishing v${version} to repo '${repoName}' branch '${branchName}'...`);

	// Collect all files from the version directory
	const files = collectFiles(versionPath);
	console.log(`  [git] Collected ${files.length} files`);

	if (files.length === 0) {
		throw new Error('No files to push');
	}

	// Create or find the repository
	let repoId: string;
	let repoUrl: string;

	if (isInitial) {
		const result = await createRepository(repoName, creds);
		repoId = result.repoId;
		repoUrl = result.repoUrl;
		console.log(`  [git] Repository created: ${repoUrl}`);
	} else {
		const result = await findRepository(repoName, creds);
		repoId = result.repoId;
		repoUrl = result.repoUrl;
		console.log(`  [git] Using existing repository: ${repoUrl}`);
	}

	// Push files
	const commitMessage = isInitial
		? `feat: initial build of "${ideaTitle}" (v${version})`
		: `feat: version ${version} of "${ideaTitle}"`;

	await pushFiles(repoId, files, branchName, commitMessage, creds, isInitial);
	console.log(`  [git] Push complete: ${files.length} files to '${branchName}'`);

	return { repoUrl, repoId, branchName };
}
