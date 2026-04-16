import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

// ─── Runtime-only database initialization ──────────────────────────────────────
//
// During `vite build`, Vite replaces `bun:sqlite` and `drizzle-orm/bun-sqlite`
// with inert stubs (see vite.config.ts) because the build runs on Node.js which
// cannot handle the `bun:` protocol.  Those stubs are baked into the output
// bundle, so static `import` statements would use the stubs at runtime too.
//
// To ensure the **real** modules are used when the app runs under Bun, we load
// them lazily via `require()` with computed module names.  Vite's `resolveId`
// hook only intercepts statically-analyzable import specifiers — a `require()`
// whose argument is a variable expression falls through untouched and stays in
// the output as a genuine runtime call.  Bun's runtime resolves it from its
// built-in modules / node_modules as expected.
// ────────────────────────────────────────────────────────────────────────────────

let _db: BunSQLiteDatabase<typeof schema> | null = null;
let _rawDb: InstanceType<typeof import('bun:sqlite').Database> | null = null;

function ensureInitialized(): void {
	if (_db) return;

	// Compute module names at runtime so Vite cannot statically match them
	// against the build-time stub plugin's `resolveId` hook.
	const bunSqliteMod = ['bun', 'sqlite'].join(':');
	const drizzleMod = ['drizzle-orm', 'bun-sqlite'].join('/');

	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { Database } = require(bunSqliteMod);
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { drizzle } = require(drizzleMod);

	// Use process.env directly — $env/dynamic/private is populated by adapter-node's
	// server.init() call, which may not have run yet when this module is first imported
	// during server startup. process.env is always available immediately.
	const dbPath = process.env.DATABASE_PATH || './data/innovation-radar.db';

	_rawDb = new Database(dbPath);
	(_rawDb as any).exec('PRAGMA journal_mode = WAL');
	(_rawDb as any).exec('PRAGMA foreign_keys = ON');

	_db = drizzle(_rawDb, { schema });
}

/**
 * Lazily-initialized Drizzle ORM database instance.
 *
 * Wrapped in a Proxy so that the first property access triggers initialization
 * with the **real** `bun:sqlite` and `drizzle-orm/bun-sqlite` modules (not the
 * build-time stubs).  After initialization the Proxy transparently delegates to
 * the real Drizzle instance.
 */
export const db: BunSQLiteDatabase<typeof schema> = new Proxy(
	{} as BunSQLiteDatabase<typeof schema>,
	{
		get(_target, prop, _receiver) {
			ensureInitialized();
			const value = (_db as any)[prop];
			return typeof value === 'function' ? value.bind(_db) : value;
		}
	}
);

/** Access the underlying bun:sqlite Database instance for raw SQL operations. */
export function getRawDb() {
	ensureInitialized();
	return _rawDb!;
}

export * from './schema';
