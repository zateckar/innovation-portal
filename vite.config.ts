import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * During `vite build`, Vite spawns Node.js worker threads to render SSR
 * chunks. Node.js v20 cannot resolve the `bun:` URL scheme, so any module
 * that imports `bun:sqlite` (directly or via `drizzle-orm/bun-sqlite`) will
 * crash the build.
 *
 * This plugin intercepts those imports during the build phase only and
 * replaces them with lightweight stubs. The real modules are never evaluated
 * at build time (the `building` flag in db/index.ts prevents actual DB
 * access), so the stubs just need to be syntactically valid exports.
 * At runtime the app runs under Bun, which resolves `bun:sqlite` natively.
 */
function bunBuildCompatPlugin() {
	const STUB_BUN_SQLITE = '\0virtual:bun-sqlite';
	const STUB_DRIZZLE_BUN = '\0virtual:drizzle-orm-bun-sqlite';

	return {
		name: 'bun-build-compat',
		apply: 'build' as const,
		enforce: 'pre' as const,

		resolveId(id: string) {
			if (id === 'bun:sqlite') return STUB_BUN_SQLITE;
			if (id === 'drizzle-orm/bun-sqlite') return STUB_DRIZZLE_BUN;
		},

		load(id: string) {
			if (id === STUB_BUN_SQLITE) {
				// Minimal stub — only needs to be importable, not functional.
				return `
export class Database {
  constructor(_path, _opts) {}
  exec(_sql) {}
  prepare(_sql) {
    return { run() {}, get() {}, all() {}, finalize() {} };
  }
  close() {}
}
export default Database;
`;
			}
			if (id === STUB_DRIZZLE_BUN) {
				return `
export function drizzle(_db, _opts) {
  return new Proxy({}, { get() { return () => {}; } });
}
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
	}
});
