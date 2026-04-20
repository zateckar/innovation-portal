import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Build-info: version + git commit + build timestamp, embedded at build time
 * via Vite's `define` so it is visible to every bundled module (server &
 * client). Surfaced in the admin sidebar so operators can confirm which
 * commit is actually deployed without shelling into the container.
 *
 * Resolution order for git fields (most explicit wins):
 *   1. process.env.GIT_SHA / GIT_BRANCH (set by CI or `docker build --build-arg`)
 *   2. `git rev-parse` against the build-context .git directory
 *   3. literal "unknown" (build still succeeds)
 *
 * For Docker builds, `.dockerignore` no longer excludes `.git` so option 2
 * works automatically. CI pipelines without a checked-out repo can still
 * inject values via env vars (option 1).
 */
function readBuildInfo() {
	const tryGit = (args: string): string => {
		try {
			return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
				.toString()
				.trim();
		} catch {
			return '';
		}
	};

	let pkgVersion = '0.0.0';
	try {
		pkgVersion = JSON.parse(readFileSync('package.json', 'utf-8')).version ?? '0.0.0';
	} catch {
		// Keep default
	}

	const gitSha = process.env.GIT_SHA || tryGit('rev-parse --short HEAD') || 'unknown';
	const gitBranch =
		process.env.GIT_BRANCH || tryGit('rev-parse --abbrev-ref HEAD') || 'unknown';
	// Detect a dirty working tree only when reading from local git (not env).
	const dirty = !process.env.GIT_SHA && tryGit('status --porcelain') !== '';

	return {
		version: pkgVersion,
		gitSha,
		gitBranch,
		dirty,
		buildTime: new Date().toISOString()
	};
}

const BUILD_INFO = readBuildInfo();
// Surface to the build log so deploy logs record exactly what was bundled.
console.log(
	`[build-info] v${BUILD_INFO.version} ${BUILD_INFO.gitBranch}@${BUILD_INFO.gitSha}` +
		`${BUILD_INFO.dirty ? ' (dirty)' : ''} built ${BUILD_INFO.buildTime}`
);

/**
 * During `vite build`, Vite spawns worker threads to render SSR chunks.
 * Even with `bun --bun`, the build workers may not resolve the `bun:`
 * protocol correctly.  This plugin intercepts those imports during the
 * build phase only and replaces them with lightweight stubs.
 *
 * In dev mode, `bun:sqlite` is listed in `ssr.external` so Vite hands
 * resolution to the Bun runtime directly (which supports `bun:sqlite`
 * natively).
 */
function bunBuildCompatPlugin() {
	const STUB_BUN_SQLITE = '\0virtual:bun-sqlite';
	const STUB_DRIZZLE_BUN = '\0virtual:drizzle-orm-bun-sqlite';

	return {
		name: 'bun-build-compat',
		apply: 'build' as const,
		enforce: 'pre' as const,

		resolveId(id: string, _importer: string | undefined, options?: { ssr?: boolean }) {
			// Only stub for client-side builds; the SSR server bundle must use
			// the real modules so Bun can resolve them at runtime.
			if (options?.ssr) return;
			if (id === 'bun:sqlite') return STUB_BUN_SQLITE;
			if (id === 'drizzle-orm/bun-sqlite') return STUB_DRIZZLE_BUN;
		},

		load(id: string) {
			if (id === STUB_BUN_SQLITE) {
				return `
export class Database {
  constructor(_path, _opts) {}
  exec(_sql) {}
  prepare(_sql) {
    return { run() {}, get() {}, all() {}, finalize() {} };
  }
  query(_sql) {
    return { get() {}, all() {} };
  }
  close() {}
}
export default Database;
`;
			}
			if (id === STUB_DRIZZLE_BUN) {
				return `
export function drizzle() { return undefined; }
export class BunSQLiteDatabase {}
`;
			}
		}
	};
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), bunBuildCompatPlugin()],
	server: {
		host: '0.0.0.0'
	},
	ssr: {
		// Let the Bun runtime resolve bun:sqlite and drizzle-orm/bun-sqlite
		// natively during both dev SSR and production SSR build, instead of
		// Vite trying to bundle/transform them.
		external: ['bun:sqlite', 'drizzle-orm/bun-sqlite']
	},
	define: {
		// Inlined into every bundled module. Consumed via $lib/build-info.
		// JSON.stringify is required — `define` does literal text replacement
		// and the values must end up as valid JS expressions in the source.
		__BUILD_INFO__: JSON.stringify(BUILD_INFO)
	}
});
