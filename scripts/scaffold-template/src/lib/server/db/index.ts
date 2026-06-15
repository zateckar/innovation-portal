import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

// Under Vitest, default to a fresh in-memory database so every test run starts
// with empty tables. Tests that INSERT rows with fixed primary keys would
// otherwise fail with "UNIQUE constraint failed" on the second and later runs,
// because the file-backed DB persists between `bun run test` invocations.
// An explicit DATABASE_PATH always wins.
const DB_PATH =
	process.env.DATABASE_PATH || (process.env.VITEST ? ':memory:' : resolve('data', 'app.db'));

// Ensure the data directory exists (only meaningful for a file-backed database)
if (DB_PATH !== ':memory:') {
	mkdirSync(resolve(DB_PATH, '..'), { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA foreign_keys = ON');

/**
 * Bootstrap tables on first run (no migrations needed for SQLite embedded apps).
 *
 * The AI builder will replace this placeholder with the actual CREATE TABLE
 * statements that match the schema defined in schema.ts.
 *
 * Example:
 *
 *   sqlite.exec(`
 *     CREATE TABLE IF NOT EXISTS items (
 *       id TEXT PRIMARY KEY,
 *       name TEXT NOT NULL,
 *       done INTEGER NOT NULL DEFAULT 0,
 *       created_at TEXT NOT NULL DEFAULT (datetime('now'))
 *     );
 *   `);
 */
// TODO: Replace with actual CREATE TABLE IF NOT EXISTS statements from your schema

export const db = drizzle(sqlite);
export { sqlite };
