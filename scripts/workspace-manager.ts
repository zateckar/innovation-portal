import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { atomicWriteFile, withLock, workspaceLockKey } from './atomic-fs.ts';

const WORKSPACES_ROOT = resolve(import.meta.dirname, '..', 'workspaces');

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface BuildLogEntry {
	timestamp: string;
	phase: string;
	message: string;
	status: 'started' | 'completed' | 'error' | 'info';
}

export interface WorkspaceMetadata {
	uuid: string;
	createdAt: string;
	specHash: string;
	versions: VersionInfo[];
	currentVersion: number;
	status:
		| 'creating'
		| 'interviewing'
		| 'planning'
		| 'reviewing'
		| 'building'
		| 'testing'
		| 'deploying'
		| 'deployed'
		| 'error';
	error?: string;
	/** Granular phase label shown in the UI (e.g. "AI Clarification", "Layer 3: API Routes") */
	currentPhase?: string;
	/** Timestamped activity log for the current build */
	buildLog?: BuildLogEntry[];
	/** PID of the build subprocess (used to detect crashes & orphans) */
	buildPid?: number | null;
	buildStartedAt?: string | null;
	/** Distinguishes initial vs rebuild vs autofix in the UI */
	buildType?: 'initial' | 'rebuild' | 'autofix';
	autofixAttempts?: number;
	/** Last captured stderr/stdout from a failed build phase */
	lastErrorOutput?: string;
	lastUpdated?: string;
}

export interface VersionInfo {
	version: number;
	createdAt: string;
	specHash: string;
	status: 'building' | 'built' | 'deployed' | 'error';
	buildLog?: string;
}

// ────────────────────────────────────────────────────────────────
// Workspace CRUD
// ────────────────────────────────────────────────────────────────

/**
 * Create a new workspace with its directory structure.
 * Writes SPECIFICATION.md and metadata.json to the workspace root.
 */
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

	atomicWriteFile(join(wsDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

	return metadata;
}

/**
 * Get the absolute path to a workspace directory.
 */
export function getWorkspacePath(uuid: string): string {
	return join(WORKSPACES_ROOT, uuid);
}

/**
 * Get the absolute path to a specific version directory.
 */
export function getVersionPath(uuid: string, version: number): string {
	return join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`);
}

/**
 * Get the deployment path for a specific version.
 * Each version has its own deployment directory — all versions stay live independently.
 */
export function getDeploymentPath(uuid: string, version: number): string {
	return join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'deployment');
}

/**
 * Update workspace metadata (partial update, merges with existing).
 *
 * IMPORTANT: This wrapper preserves the legacy synchronous signature for
 * call sites that aren't async. Internally it uses an atomic tmp+rename
 * write. For full mutex serialisation across processes/phases, prefer
 * `updateMetadataAtomic()` from `metadata-store.ts`.
 */
export function updateMetadata(
	uuid: string,
	updates: Partial<WorkspaceMetadata>
): WorkspaceMetadata {
	const metaPath = join(WORKSPACES_ROOT, uuid, 'metadata.json');
	const existing = JSON.parse(readFileSync(metaPath, 'utf-8')) as WorkspaceMetadata;
	const updated = { ...existing, ...updates, lastUpdated: new Date().toISOString() } as WorkspaceMetadata;
	atomicWriteFile(metaPath, JSON.stringify(updated, null, 2));
	return updated;
}

/**
 * Async variant that holds the per-uuid lock for the read-modify-write,
 * preventing data loss when two callers race.
 */
export async function updateMetadataLocked(
	uuid: string,
	updates: Partial<WorkspaceMetadata>
): Promise<WorkspaceMetadata> {
	return withLock(workspaceLockKey(uuid), () => updateMetadata(uuid, updates));
}

/**
 * Read workspace metadata.
 */
export function readMetadata(uuid: string): WorkspaceMetadata {
	const metaPath = join(WORKSPACES_ROOT, uuid, 'metadata.json');
	return JSON.parse(readFileSync(metaPath, 'utf-8')) as WorkspaceMetadata;
}

/**
 * List all workspaces with their metadata.
 */
export function listWorkspaces(): WorkspaceMetadata[] {
	if (!existsSync(WORKSPACES_ROOT)) return [];
	return readdirSync(WORKSPACES_ROOT, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => {
			try {
				return readMetadata(d.name);
			} catch {
				return null;
			}
		})
		.filter(Boolean) as WorkspaceMetadata[];
}

/**
 * Check if a workspace exists.
 */
export function workspaceExists(uuid: string): boolean {
	return existsSync(join(WORKSPACES_ROOT, uuid, 'metadata.json'));
}

/**
 * Get the workspaces root directory.
 */
export function getWorkspacesRoot(): string {
	return WORKSPACES_ROOT;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return hash.toString(36);
}
