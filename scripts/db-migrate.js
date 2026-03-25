/**
 * Database migration script for production Docker deployment.
 * Runs Drizzle ORM migrations from the drizzle/ folder.
 * Uses only production dependencies (drizzle-orm, better-sqlite3).
 *
 * Handles the "untracked existing database" case: if the database was
 * previously set up outside the Drizzle migration system (e.g. via schema
 * push or manual SQL), __drizzle_migrations will be empty even though all
 * tables exist. In that case we:
 *   1. Apply any schema changes that were never applied (missing columns/tables).
 *   2. Populate __drizzle_migrations for all 0000-0019 entries.
 *   3. Let Drizzle migrate() run — it will find nothing pending.
 *
 * Fresh databases go through the normal Drizzle migration path (0000-0019).
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { mkdirSync, existsSync, readFileSync } from 'fs';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasColumn(table, column) {
	return sqlite
		.prepare(`PRAGMA table_info("${table}")`)
		.all()
		.some((c) => c.name === column);
}

function hasTable(tableName) {
	return !!sqlite
		.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
		.get(tableName);
}

// ── Detect untracked existing database ───────────────────────────────────────
// If tables already exist but __drizzle_migrations is empty, the database was
// set up outside Drizzle. We repair missing schema gaps and pre-populate
// migration history so the normal migrator has nothing left to do.

const migrationsTableExists = hasTable('__drizzle_migrations');
const sessionsTableExists = hasTable('sessions');

if (migrationsTableExists && sessionsTableExists) {
	const { count } = sqlite
		.prepare(`SELECT COUNT(*) as count FROM "__drizzle_migrations"`)
		.get();

	if (count === 0) {
		console.log('Detected existing database without migration tracking.');
		console.log('Applying missing schema changes...');

		// Disable FK checks while altering schema
		sqlite.pragma('foreign_keys = OFF');

		// sessions: last_active_at (from 0016_code_review_fixes)
		if (!hasColumn('sessions', 'last_active_at')) {
			sqlite.exec(`ALTER TABLE "sessions" ADD COLUMN "last_active_at" INTEGER`);
			console.log('  + Added sessions.last_active_at');
		}

		// ideas: spec / ADO fields (from 0017_good_colleen_wing)
		if (!hasColumn('ideas', 'spec_status')) {
			sqlite.exec(`ALTER TABLE "ideas" ADD COLUMN "spec_status" TEXT NOT NULL DEFAULT 'not_started'`);
			console.log('  + Added ideas.spec_status');
		}
		if (!hasColumn('ideas', 'spec_document')) {
			sqlite.exec(`ALTER TABLE "ideas" ADD COLUMN "spec_document" TEXT`);
			console.log('  + Added ideas.spec_document');
		}
		if (!hasColumn('ideas', 'ado_pr_url')) {
			sqlite.exec(`ALTER TABLE "ideas" ADD COLUMN "ado_pr_url" TEXT`);
			console.log('  + Added ideas.ado_pr_url');
		}
		if (!hasColumn('ideas', 'jira_escalation_key')) {
			sqlite.exec(`ALTER TABLE "ideas" ADD COLUMN "jira_escalation_key" TEXT`);
			console.log('  + Added ideas.jira_escalation_key');
		}

		// settings: ADO / dev-stage fields (from 0017_good_colleen_wing)
		if (!hasColumn('settings', 'jira_project_key')) {
			sqlite.exec(`ALTER TABLE "settings" ADD COLUMN "jira_project_key" TEXT`);
			console.log('  + Added settings.jira_project_key');
		}
		if (!hasColumn('settings', 'idea_vote_threshold')) {
			sqlite.exec(`ALTER TABLE "settings" ADD COLUMN "idea_vote_threshold" INTEGER DEFAULT 5`);
			console.log('  + Added settings.idea_vote_threshold');
		}
		if (!hasColumn('settings', 'tech_stack_rules')) {
			sqlite.exec(`ALTER TABLE "settings" ADD COLUMN "tech_stack_rules" TEXT`);
			console.log('  + Added settings.tech_stack_rules');
		}
		if (!hasColumn('settings', 'ado_enabled')) {
			sqlite.exec(`ALTER TABLE "settings" ADD COLUMN "ado_enabled" INTEGER DEFAULT false`);
			console.log('  + Added settings.ado_enabled');
		}
		if (!hasColumn('settings', 'ado_org_url')) {
			sqlite.exec(`ALTER TABLE "settings" ADD COLUMN "ado_org_url" TEXT`);
			console.log('  + Added settings.ado_org_url');
		}
		if (!hasColumn('settings', 'ado_project')) {
			sqlite.exec(`ALTER TABLE "settings" ADD COLUMN "ado_project" TEXT`);
			console.log('  + Added settings.ado_project');
		}
		if (!hasColumn('settings', 'ado_repo_id')) {
			sqlite.exec(`ALTER TABLE "settings" ADD COLUMN "ado_repo_id" TEXT`);
			console.log('  + Added settings.ado_repo_id');
		}
		if (!hasColumn('settings', 'ado_pat')) {
			sqlite.exec(`ALTER TABLE "settings" ADD COLUMN "ado_pat" TEXT`);
			console.log('  + Added settings.ado_pat');
		}
		if (!hasColumn('settings', 'ado_target_branch')) {
			sqlite.exec(`ALTER TABLE "settings" ADD COLUMN "ado_target_branch" TEXT DEFAULT 'main'`);
			console.log('  + Added settings.ado_target_branch');
		}

		// idea_chats table (from 0017_good_colleen_wing)
		if (!hasTable('idea_chats')) {
			sqlite.exec(`
				CREATE TABLE \`idea_chats\` (
					\`id\` text PRIMARY KEY NOT NULL,
					\`idea_id\` text NOT NULL,
					\`role\` text NOT NULL,
					\`user_id\` text,
					\`content\` text NOT NULL,
					\`created_at\` integer,
					FOREIGN KEY (\`idea_id\`) REFERENCES \`ideas\`(\`id\`) ON UPDATE no action ON DELETE cascade,
					FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
				)
			`);
			console.log('  + Created idea_chats table');
		}

		sqlite.pragma('foreign_keys = ON');

		// Populate __drizzle_migrations so Drizzle finds all entries already applied
		console.log('Initializing migration tracking...');
		const journal = JSON.parse(readFileSync('./drizzle/meta/_journal.json').toString());
		const insertMig = sqlite.prepare(
			`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)`
		);

		for (const entry of journal.entries) {
			const sqlPath = `./drizzle/${entry.tag}.sql`;
			if (!existsSync(sqlPath)) {
				console.warn(`  Warning: no SQL file for "${entry.tag}", skipping`);
				continue;
			}
			const sql = readFileSync(sqlPath).toString();
			const hash = crypto.createHash('sha256').update(sql).digest('hex');
			insertMig.run(hash, entry.when);
			console.log(`  Marked as applied: ${entry.tag}`);
		}

		console.log('Migration history initialized.');
	}
}

// ── Run pending migrations ────────────────────────────────────────────────────

const db = drizzle(sqlite);

try {
	migrate(db, { migrationsFolder: './drizzle' });
	console.log('Migrations completed successfully!');
} catch (error) {
	console.error('Migration failed:', error);
	process.exit(1);
} finally {
	sqlite.close();
}
