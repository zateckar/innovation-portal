import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _rawDb: Database.Database | null = null;

function getDatabase(): BetterSQLite3Database<typeof schema> {
	if (_db) return _db;
	
	const dbPath = env.DATABASE_PATH || './data/innovation-radar.db';
	_rawDb = new Database(dbPath);
	_rawDb.pragma('journal_mode = WAL');
	_rawDb.pragma('foreign_keys = ON');
	
	_db = drizzle(_rawDb, { schema });
	return _db;
}

/** Access the underlying better-sqlite3 Database instance for raw SQL operations. */
export function getRawDb(): Database.Database {
	if (!_rawDb) getDatabase();
	return _rawDb!;
}

// Export a proxy that lazily initializes the database
// This prevents database creation during SSR build
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
	get(_target, prop) {
		if (building) {
			throw new Error('Database cannot be accessed during build');
		}
		return Reflect.get(getDatabase(), prop);
	}
});

export * from './schema';
