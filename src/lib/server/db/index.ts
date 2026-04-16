import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

// ─── Database initialization ────────────────────────────────────────────────
//
// The app always runs under Bun (dev via `bun --bun vite dev`, production via
// `bun build/index.js`).  During `vite build`, the build-time stub plugin in
// vite.config.ts replaces `bun:sqlite` and `drizzle-orm/bun-sqlite` with inert
// shims so the build doesn't crash on Node.js workers.  At runtime the real
// Bun modules are used.
// ─────────────────────────────────────────────────────────────────────────────

let _db: BunSQLiteDatabase<typeof schema> | null = null;
let _rawDb: Database | null = null;

function ensureInitialized(): void {
	if (_db) return;

	const dbPath = process.env.DATABASE_PATH || './data/innovation-radar.db';

	_rawDb = new Database(dbPath);
	_rawDb.exec('PRAGMA journal_mode = WAL');
	_rawDb.exec('PRAGMA foreign_keys = ON');

	_db = drizzle(_rawDb, { schema });
}

/**
 * Lazily-initialized Drizzle ORM database instance.
 *
 * Wrapped in a Proxy so that the first property access triggers initialization.
 * After initialization the Proxy transparently delegates to the real Drizzle
 * instance.
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
