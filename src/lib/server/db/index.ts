import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

let _db: BunSQLiteDatabase<typeof schema> | null = null;
let _rawDb: Database | null = null;

function getDatabase(): BunSQLiteDatabase<typeof schema> {
	if (_db) return _db;
	
	const dbPath = env.DATABASE_PATH || './data/innovation-radar.db';
	_rawDb = new Database(dbPath);
	_rawDb.exec('PRAGMA journal_mode = WAL');
	_rawDb.exec('PRAGMA foreign_keys = ON');
	
	_db = drizzle(_rawDb, { schema });
	return _db;
}

/** Access the underlying bun:sqlite Database instance for raw SQL operations. */
export function getRawDb(): Database {
	if (!_rawDb) getDatabase();
	return _rawDb!;
}

// Export a proxy that lazily initializes the database
// This prevents database creation during SSR build
export const db = new Proxy({} as BunSQLiteDatabase<typeof schema>, {
	get(_target, prop) {
		if (building) {
			throw new Error('Database cannot be accessed during build');
		}
		return Reflect.get(getDatabase(), prop);
	}
});

export * from './schema';
