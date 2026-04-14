import { mkdirSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync, copyFileSync, statSync } from 'fs';
import { join } from 'path';
import {
	getWorkspacePath,
	getVersionPath,
	getDeploymentPath,
	updateMetadata,
	readMetadata
} from './workspace-manager.ts';
import type { VersionInfo } from './workspace-manager.ts';

// ────────────────────────────────────────────────────────────────
// Version Creation
// ────────────────────────────────────────────────────────────────

/**
 * Create a new version directory for a workspace.
 * If a previous version exists, copies its source (minus node_modules and build).
 */
export function createVersion(
	uuid: string,
	specContent: string
): { version: number; versionPath: string } {
	const metadata = readMetadata(uuid);
	const newVersion = metadata.currentVersion + 1;
	const versionPath = getVersionPath(uuid, newVersion);

	// If there's a previous version, copy it as base (skip heavy directories)
	if (newVersion > 1) {
		const prevPath = getVersionPath(uuid, newVersion - 1);
		if (existsSync(prevPath)) {
			cpSync(prevPath, versionPath, {
				recursive: true,
				filter: (src) => {
					// Skip node_modules, build, and deployment directories during copy
					const relative = src.replace(prevPath, '');
					return (
						!relative.includes('node_modules') &&
						!relative.includes(`${sep}build${sep}`) &&
						!relative.endsWith(`${sep}build`) &&
						!relative.includes(`${sep}deployment${sep}`) &&
						!relative.endsWith(`${sep}deployment`)
					);
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
 * Node's cpSync uses Windows APIs that fail silently on paths > 260 chars.
 * This implementation uses readdirSync + copyFileSync which handle long paths
 * correctly on Windows (no silent truncation).
 *
 * @param skipNames - directory entry names to skip entirely (e.g. '.git')
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
				// Skip files that can't be copied (e.g. locked files); log but continue
				console.warn(`  [deploy] Could not copy: ${srcPath}`);
			}
		}
	}
}

/**
 * Deploy a specific version into its own deployment directory.
 * Each version is independently deployed — all versions stay live simultaneously.
 *
 * Uses long-path-safe copyRecursive instead of cpSync to avoid silent failures
 * on Windows paths > 260 characters (common in node_modules and _app/immutable).
 */
export function deployVersion(uuid: string, version: number): string {
	const versionPath = getVersionPath(uuid, version);
	const buildPath = join(versionPath, 'build');
	const deployPath = getDeploymentPath(uuid, version);

	if (!existsSync(buildPath)) {
		throw new Error(`Build output not found at ${buildPath}`);
	}

	// Copy build output to deployment (long-path-safe)
	mkdirSync(deployPath, { recursive: true });
	copyRecursive(buildPath, deployPath);

	// Also copy node_modules for runtime (adapter-node needs them)
	const nodeModulesPath = join(versionPath, 'node_modules');
	if (existsSync(nodeModulesPath)) {
		copyRecursive(nodeModulesPath, join(deployPath, 'node_modules'));
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

import { sep } from 'path';

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return hash.toString(36);
}
