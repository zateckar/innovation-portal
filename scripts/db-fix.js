/**
 * Database fix script — repairs schema gaps and re-establishes migration tracking.
 *
 * Problem: The __drizzle_migrations table was empty (no migration tracking), and
 * several schema changes from migrations 0016 and 0017 were never applied to the DB.
 *
 * What this script does:
 *  1. Adds all missing columns (sessions.last_active_at, ideas.spec_*, settings.ado_*, etc.)
 *  2. Creates the missing idea_chats table
 *  3. Populates __drizzle_migrations with SHA-256 hashes of all journal entries so that
 *     the normal migrator (db-migrate.js) can run safely going forward.
 */

import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';

const dbPath = process.env.DATABASE_PATH || './data/innovation-radar.db';

console.log(`=== Database Fix Script ===`);
console.log(`Database: ${dbPath}\n`);

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = OFF'); // Disable FK checks for ALTER TABLE safety

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasColumn(table, column) {
	const cols = sqlite.prepare(`PRAGMA table_info("${table}")`).all();
	return cols.some((c) => c.name === column);
}

function hasTable(tableName) {
	const result = sqlite
		.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
		.get(tableName);
	return !!result;
}

function addColumnIfMissing(table, column, definition) {
	if (!hasColumn(table, column)) {
		console.log(`  + Adding ${table}.${column} ...`);
		sqlite.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
		console.log(`    ✓ Done`);
	} else {
		console.log(`  ✓ ${table}.${column} already exists`);
	}
}

// ── 1. Fix sessions table ─────────────────────────────────────────────────────

console.log('--- sessions ---');
addColumnIfMissing('sessions', 'last_active_at', 'INTEGER');

// ── 2. Fix ideas table ───────────────────────────────────────────────────────

console.log('\n--- ideas ---');
addColumnIfMissing('ideas', 'spec_status', "TEXT NOT NULL DEFAULT 'not_started'");
addColumnIfMissing('ideas', 'spec_document', 'TEXT');
addColumnIfMissing('ideas', 'ado_pr_url', 'TEXT');
addColumnIfMissing('ideas', 'jira_escalation_key', 'TEXT');

// ── 3. Fix settings table ─────────────────────────────────────────────────────

console.log('\n--- settings ---');
addColumnIfMissing('settings', 'jira_project_key', 'TEXT');
addColumnIfMissing('settings', 'idea_vote_threshold', 'INTEGER DEFAULT 5');
addColumnIfMissing('settings', 'tech_stack_rules', 'TEXT');
addColumnIfMissing('settings', 'ado_enabled', 'INTEGER DEFAULT false');
addColumnIfMissing('settings', 'ado_org_url', 'TEXT');
addColumnIfMissing('settings', 'ado_project', 'TEXT');
addColumnIfMissing('settings', 'ado_repo_id', 'TEXT');
addColumnIfMissing('settings', 'ado_pat', 'TEXT');
addColumnIfMissing('settings', 'ado_target_branch', "TEXT DEFAULT 'main'");

// ── 4. Create idea_chats table if missing ─────────────────────────────────────

console.log('\n--- idea_chats table ---');
if (!hasTable('idea_chats')) {
	console.log('  + Creating idea_chats table ...');
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
	console.log('    ✓ Done');
} else {
	console.log('  ✓ idea_chats already exists');
}

// ── 5. Populate __drizzle_migrations ─────────────────────────────────────────

console.log('\n--- __drizzle_migrations ---');

const journalPath = './drizzle/meta/_journal.json';
const journal = JSON.parse(fs.readFileSync(journalPath).toString());

// Get hashes already tracked
const existingHashes = new Set(
	sqlite.prepare(`SELECT hash FROM "__drizzle_migrations"`).all().map((r) => r.hash)
);

const insertMigration = sqlite.prepare(
	`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)`
);

let inserted = 0;
let skipped = 0;

for (const entry of journal.entries) {
	const sqlPath = `./drizzle/${entry.tag}.sql`;
	if (!fs.existsSync(sqlPath)) {
		console.log(`  ⚠ Missing SQL file for journal entry: ${entry.tag} — skipping`);
		continue;
	}
	const sql = fs.readFileSync(sqlPath).toString();
	const hash = crypto.createHash('sha256').update(sql).digest('hex');

	if (!existingHashes.has(hash)) {
		insertMigration.run(hash, entry.when);
		inserted++;
		console.log(`  + Registered: ${entry.tag}`);
	} else {
		skipped++;
		console.log(`  ✓ Already registered: ${entry.tag}`);
	}
}

console.log(`\n  Inserted ${inserted} new migration records, ${skipped} already present.`);

// ── Done ──────────────────────────────────────────────────────────────────────

sqlite.pragma('foreign_keys = ON');
sqlite.close();

console.log('\n=== Fix complete! Run "node scripts/db-migrate.js" to verify. ===');
