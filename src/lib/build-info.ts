/**
 * Build-time metadata about the deployed bundle.
 *
 * Values are inlined by Vite's `define` (see `vite.config.ts → readBuildInfo`).
 * Resolution order at build time:
 *   1. `GIT_SHA` / `GIT_BRANCH` env vars (CI / `docker build --build-arg`)
 *   2. `git rev-parse` against the build context's `.git`
 *   3. literal `"unknown"`
 *
 * Surfaced in the admin sidebar so operators can confirm exactly which commit
 * is deployed without shelling into the container, and in `/api/health` for
 * external monitoring.
 */
export interface BuildInfo {
	/** Semver from package.json — bumped manually per release. */
	version: string;
	/** Short git commit hash (e.g. "a1b2c3d"), or "unknown". */
	gitSha: string;
	/** Branch name at build time, or "unknown". */
	gitBranch: string;
	/** True when the working tree had uncommitted changes at build time. */
	dirty: boolean;
	/** ISO-8601 UTC timestamp of when `vite build` ran. */
	buildTime: string;
}

// Defensive fallback — should never trigger because `define` always replaces
// __BUILD_INFO__, but guards against accidental import in a context that
// hasn't gone through Vite (e.g. raw `bun run scripts/foo.ts`).
const FALLBACK: BuildInfo = {
	version: '0.0.0',
	gitSha: 'unknown',
	gitBranch: 'unknown',
	dirty: false,
	buildTime: '1970-01-01T00:00:00.000Z'
};

export const buildInfo: BuildInfo =
	typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : FALLBACK;

/**
 * Compact, human-friendly one-liner for badges / tooltips.
 * Example: `v0.0.1 · main@a1b2c3d` (or `… (dirty)` if working tree was dirty).
 */
export function formatBuildLabel(info: BuildInfo = buildInfo): string {
	const dirty = info.dirty ? ' (dirty)' : '';
	return `v${info.version} · ${info.gitBranch}@${info.gitSha}${dirty}`;
}
