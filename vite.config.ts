import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

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
	}
});
