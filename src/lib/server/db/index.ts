import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

// Use process.env directly — $env/dynamic/private is populated by adapter-node's
// server.init() call, which may not have run yet when this module is first imported
// during server startup. process.env is always available immediately.
const dbPath = process.env.DATABASE_PATH || './data/innovation-radar.db';
const rawDb = new Database(dbPath);
rawDb.exec('PRAGMA journal_mode = WAL');
rawDb.exec('PRAGMA foreign_keys = ON');

export const db: BunSQLiteDatabase<typeof schema> = drizzle(rawDb, { schema });

/** Access the underlying bun:sqlite Database instance for raw SQL operations. */
export function getRawDb(): Database {
	return rawDb;
}

export * from './schema';
