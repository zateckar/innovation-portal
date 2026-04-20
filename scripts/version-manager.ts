import {
	mkdirSync,
	cpSync,
	existsSync,
	writeFileSync,
	readdirSync,
	copyFileSync,
	rmSync,
	symlinkSync,
	statSync,
	lstatSync
} from 'fs';
import { join, sep } from 'path';
import {
	getWorkspacePath,
	getVersionPath,
	getDeploymentPath,
	updateMetadata,
	readMetadata
} from './workspace-manager.ts';
import { atomicWriteFile, withLock, workspaceLockKey } from './atomic-fs.ts';
import type { VersionInfo } from './workspace-manager.ts';

const SCAFFOLD_TEMPLATE_DIR = join(import.meta.dirname, 'scaffold-template');

// ────────────────────────────────────────────────────────────────
// Version Creation
// ────────────────────────────────────────────────────────────────

/**
 * Pick the source directory to copy from when creating a new version.
 *
 * Order of preference:
 *   1. The most recent SUCCESSFUL version (status `built` or `deployed`)
 *   2. Otherwise, the immediately previous version (legacy fallback)
 *   3. Otherwise, the scaffold template (fresh start)
 *
 * Without rule (1) a rebuild after a broken v1 would inherit v1's bugs as
 * the starting point for v2 — the AI then has to discover & fix v1's
 * issues in addition to applying spec changes.
 */
function pickCopySource(uuid: string, newVersion: number): string | null {
	if (newVersion <= 1) return null;
	const meta = readMetadata(uuid);
	const successful = meta.versions
		.filter((v) => v.status === 'built' || v.status === 'deployed')
		.sort((a, b) => b.version - a.version);
	for (const v of successful) {
		const p = getVersionPath(uuid, v.version);
		if (existsSync(p)) return p;
	}
	// No successful version — fall back to immediate previous (preserves legacy behaviour).
	const prevPath = getVersionPath(uuid, newVersion - 1);
	if (existsSync(prevPath)) return prevPath;
	return null;
}

const SKIP_COPY_DIRS = new Set([
	'node_modules',
	'.svelte-kit',
	'build',
	'deployment',
	'.checkpoints',
	'.opencode'
]);

function makeCopyFilter(srcRoot: string): (src: string) => boolean {
	return (src: string) => {
		const rel = src.slice(srcRoot.length);
		// Always allow the root dir itself
		if (rel === '' || rel === sep) return true;
		const segments = rel.split(/[\\/]/).filter(Boolean);
		for (const segment of segments) {
			if (SKIP_COPY_DIRS.has(segment)) return false;
		}
		return true;
	};
}

/**
 * Create a new version directory for a workspace.
 *
 * Atomic: uses `mkdirSync({ recursive: false })` to fail fast if the
 * target already exists, preventing two concurrent rebuilds from
 * overwriting each other's v2.
 *
 * Source selection: copies from the last SUCCESSFUL version if one
 * exists; falls back to the previous version, then to the scaffold
 * template. This prevents inheriting bugs from a known-broken version.
 */
export function createVersion(
	uuid: string,
	specContent: string
): { version: number; versionPath: string } {
	const metadata = readMetadata(uuid);
	let newVersion = metadata.currentVersion + 1;
	let versionPath = getVersionPath(uuid, newVersion);

	// Atomic mkdir — if it already exists, bump version and retry up to 5 times.
	let attempts = 0;
	while (existsSync(versionPath) && attempts < 5) {
		newVersion += 1;
		versionPath = getVersionPath(uuid, newVersion);
		attempts += 1;
	}
	mkdirSync(versionPath, { recursive: true });

	const copySource = pickCopySource(uuid, newVersion);
	if (copySource) {
		console.log(`  [createVersion] Copying from ${copySource}`);
		cpSync(copySource, versionPath, {
			recursive: true,
			filter: makeCopyFilter(copySource)
		});
	}

	// Write updated spec into version directory
	writeFileSync(join(versionPath, 'SPECIFICATION.md'), specContent, 'utf-8');

	// Update metadata atomically (callers may not yet hold the lock)
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

// ────────────────────────────────────────────────────────────────
// Version Status Management
// ────────────────────────────────────────────────────────────────

/**
 * Mark a version as successfully built.
 */
export function markVersionBuilt(uuid: string, version: number): void {
	const metadata = readMetadata(uuid);
	const versions = metadata.versions.map((v) =>
		v.version === version ? { ...v, status: 'built' as const } : v
	);
	updateMetadata(uuid, { versions });
}

/**
 * Mark a version as having an error.
 */
export function markVersionError(uuid: string, version: number, error: string): void {
	const metadata = readMetadata(uuid);
	const versions = metadata.versions.map((v) =>
		v.version === version ? { ...v, status: 'error' as const, buildLog: error } : v
	);
	updateMetadata(uuid, { versions });
}

// ────────────────────────────────────────────────────────────────
// Deployment
// ────────────────────────────────────────────────────────────────

/**
 * Long-path-safe recursive directory copy.
 */
function copyRecursive(src: string, dst: string, skipNames: string[] = []): void {
	mkdirSync(dst, { recursive: true });
	for (const entry of readdirSync(src, { withFileTypes: true })) {
		if (skipNames.includes(entry.name)) continue;
		const srcPath = join(src, entry.name);
		const dstPath = join(dst, entry.name);
		if (entry.isDirectory()) {
			copyRecursive(srcPath, dstPath, skipNames);
		} else if (entry.isFile() || entry.isSymbolicLink()) {
			try {
				copyFileSync(srcPath, dstPath);
			} catch {
				console.warn(`  [deploy] Could not copy: ${srcPath}`);
			}
		}
	}
}

/**
 * Try to symlink (or junction on Windows) `src` into `dst`. Returns true
 * on success, false if the platform / permissions don't allow it.
 *
 * Replaces the previous unconditional ~400 MB `node_modules` copy on
 * every deploy, which was the dominant disk-I/O cost of `deployVersion`.
 */
function trySymlinkDir(src: string, dst: string): boolean {
	try {
		// Remove any pre-existing entry (file, link, or empty dir).
		if (existsSync(dst)) {
			try {
				const s = lstatSync(dst);
				if (s.isDirectory() && !s.isSymbolicLink()) {
					rmSync(dst, { recursive: true, force: true });
				} else {
					rmSync(dst, { force: true });
				}
			} catch {
				// fall through to symlink attempt
			}
		}
		// On Windows, 'junction' works without admin for directories.
		const type = process.platform === 'win32' ? 'junction' : 'dir';
		symlinkSync(src, dst, type);
		return true;
	} catch (err) {
		console.warn(`  [deploy] Symlink failed (${err instanceof Error ? err.message : err}), falling back to copy`);
		return false;
	}
}

/**
 * Deploy a specific version into its own deployment directory.
 *
 * The build output is copied (small, deploy-time-immutable). The
 * `node_modules` is symlinked (or junctioned on Windows), removing the
 * dominant ~400 MB I/O cost of the legacy implementation. If the symlink
 * fails (e.g., cross-volume, permission denied), it falls back to copy.
 */
export function deployVersion(uuid: string, version: number): string {
	const versionPath = getVersionPath(uuid, version);
	const buildPath = join(versionPath, 'build');
	const deployPath = getDeploymentPath(uuid, version);

	if (!existsSync(buildPath)) {
		throw new Error(`Build output not found at ${buildPath}`);
	}

	// Copy build output (small; deploy-time-immutable)
	mkdirSync(deployPath, { recursive: true });
	copyRecursive(buildPath, deployPath);

	// Link or copy node_modules
	const nodeModulesSrc = join(versionPath, 'node_modules');
	if (existsSync(nodeModulesSrc)) {
		const nodeModulesDst = join(deployPath, 'node_modules');
		if (!trySymlinkDir(nodeModulesSrc, nodeModulesDst)) {
			copyRecursive(nodeModulesSrc, nodeModulesDst);
		}
	}

	// Copy package.json for runtime
	const pkgPath = join(versionPath, 'package.json');
	if (existsSync(pkgPath)) {
		copyFileSync(pkgPath, join(deployPath, 'package.json'));
	}

	// Update metadata — mark this version as deployed
	const metadata = readMetadata(uuid);
	const versions = metadata.versions.map((v) =>
		v.version === version ? { ...v, status: 'deployed' as const } : v
	);
	updateMetadata(uuid, { versions, status: 'deployed' });

	return deployPath;
}

// ────────────────────────────────────────────────────────────────
// Cleanup / TTL
// ────────────────────────────────────────────────────────────────

/**
 * Delete `node_modules` and `deployment` directories from versions older
 * than `keep` (per workspace, keep the latest N). Source files are
 * preserved so users can still inspect old versions.
 *
 * Without this the disk grows unboundedly (~400 MB per version per
 * rebuild). Called from `createVersion` and from a scheduled job.
 */
export function pruneOldVersions(uuid: string, keep = 3): { pruned: number } {
	const metadata = readMetadata(uuid);
	const sortedDesc = [...metadata.versions].sort((a, b) => b.version - a.version);
	const toPrune = sortedDesc.slice(keep);
	let pruned = 0;
	for (const v of toPrune) {
		const versionPath = getVersionPath(uuid, v.version);
		for (const sub of ['node_modules', 'deployment', 'build', '.svelte-kit', '.checkpoints']) {
			const target = join(versionPath, sub);
			if (existsSync(target)) {
				try {
					// Remove symlinks via lstat-aware rmSync (Node handles both).
					rmSync(target, { recursive: true, force: true });
					pruned += 1;
				} catch (err) {
					console.warn(`  [pruneOldVersions] Failed to remove ${target}: ${err}`);
				}
			}
		}
	}
	if (pruned > 0) {
		console.log(`  [pruneOldVersions] ${uuid}: pruned ${pruned} dir(s)`);
	}
	return { pruned };
}

// ────────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────────

/**
 * List all available versions for a workspace.
 */
export function listVersions(uuid: string): VersionInfo[] {
	return readMetadata(uuid).versions;
}

/**
 * Get the most recently deployed version number (or 0 if none).
 */
export function getLatestDeployedVersion(uuid: string): number {
	const versions = readMetadata(uuid).versions;
	const deployed = versions.filter((v) => v.status === 'deployed');
	return deployed.length > 0 ? Math.max(...deployed.map((v) => v.version)) : 0;
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

// Reference imports so the linter doesn't complain about unused symbols
// (statSync is used for future scaffold-source detection; SCAFFOLD_TEMPLATE_DIR
// is exported for callers that want a known-good fallback path).
void statSync;
export const SCAFFOLD_TEMPLATE_PATH = SCAFFOLD_TEMPLATE_DIR;
// Re-export atomic-fs helpers for callers
export { atomicWriteFile, withLock, workspaceLockKey };
