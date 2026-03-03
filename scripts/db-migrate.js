/**
 * Database migration script for production Docker deployment.
 * Runs Drizzle ORM migrations from the drizzle/ folder.
 * Uses only production dependencies (drizzle-orm, better-sqlite3).
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const dbPath = process.env.DATABASE_PATH || './data/innovation-radar.db';

// Ensure data directory exists
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
	mkdirSync(dbDir, { recursive: true });
	console.log(`Created database directory: ${dbDir}`);
}

console.log(`Running migrations on database: ${dbPath}`);

const sqlite = new Database(dbPath);

// Enable WAL mode and foreign keys
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite);

// Run migrations from the drizzle folder
try {
	migrate(db, { migrationsFolder: './drizzle' });
	console.log('Migrations completed successfully!');
} catch (error) {
	console.error('Migration failed:', error);
	process.exit(1);
} finally {
	sqlite.close();
}
