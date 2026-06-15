/**
 * Schema Validator — verifies that the DDL in db/index.ts matches
 * the Drizzle schema in db/schema.ts.
 *
 * Parses both files and cross-references table names, column names,
 * and basic constraints (PRIMARY KEY, NOT NULL).
 *
 * This catches drift between the two files that would cause runtime
 * data integrity issues.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Database } from 'bun:sqlite';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface SchemaIssue {
	table: string;
	column?: string;
	issue: string;
	severity: 'error' | 'warning';
}

export interface SchemaValidationResult {
	issues: SchemaIssue[];
	passed: boolean;
}

interface ParsedTable {
	name: string;
	columns: {
		name: string;
		type: string;
		primaryKey: boolean;
		notNull: boolean;
	}[];
}

// ────────────────────────────────────────────────────────────────
// Parsers
// ────────────────────────────────────────────────────────────────

/**
 * Parse CREATE TABLE statements from DDL text.
 *
 * Hand-rolled paren matcher (NOT a regex) because real DDL frequently
 * contains nested parentheses — `varchar(255)`, `CHECK (x > 0)`,
 * `DEFAULT (CURRENT_TIMESTAMP)` — that the previous `[^)]+` regex
 * truncated, falsely reporting "missing column" errors and sending
 * the AI on goose chases.
 */
function parseDDL(content: string): ParsedTable[] {
	const tables: ParsedTable[] = [];
	const headerRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?\s*\(/gi;
	let m: RegExpExecArray | null;

	while ((m = headerRe.exec(content)) !== null) {
		const tableName = m[1];
		const bodyStart = headerRe.lastIndex; // index of first char after the '('
		// Walk forward, balancing parens, until the matching ')' for this CREATE TABLE.
		let depth = 1;
		let i = bodyStart;
		let inString: '"' | "'" | '`' | null = null;
		while (i < content.length && depth > 0) {
			const ch = content[i];
			if (inString) {
				if (ch === inString && content[i - 1] !== '\\') inString = null;
			} else {
				if (ch === '"' || ch === "'" || ch === '`') inString = ch;
				else if (ch === '(') depth += 1;
				else if (ch === ')') depth -= 1;
			}
			i += 1;
		}
		if (depth !== 0) continue; // unbalanced — skip
		const body = content.substring(bodyStart, i - 1);

		// Split top-level commas (depth-aware)
		const colDefs: string[] = [];
		{
			let buf = '';
			let dep = 0;
			let str: '"' | "'" | '`' | null = null;
			for (let j = 0; j < body.length; j++) {
				const ch = body[j];
				if (str) {
					buf += ch;
					if (ch === str && body[j - 1] !== '\\') str = null;
					continue;
				}
				if (ch === '"' || ch === "'" || ch === '`') {
					str = ch;
					buf += ch;
					continue;
				}
				if (ch === '(') {
					dep += 1;
					buf += ch;
					continue;
				}
				if (ch === ')') {
					dep -= 1;
					buf += ch;
					continue;
				}
				if (ch === ',' && dep === 0) {
					colDefs.push(buf.trim());
					buf = '';
					continue;
				}
				buf += ch;
			}
			if (buf.trim()) colDefs.push(buf.trim());
		}

		const columns: ParsedTable['columns'] = [];
		for (const colDef of colDefs) {
			if (/^\s*(FOREIGN|PRIMARY|UNIQUE|CHECK|CONSTRAINT)\s/i.test(colDef)) continue;
			const colMatch = colDef.match(/^["'`]?(\w+)["'`]?\s+(\w+)/i);
			if (colMatch) {
				columns.push({
					name: colMatch[1],
					type: colMatch[2].toUpperCase(),
					primaryKey: /PRIMARY\s+KEY/i.test(colDef),
					notNull: /NOT\s+NULL/i.test(colDef) || /PRIMARY\s+KEY/i.test(colDef)
				});
			}
		}

		tables.push({ name: tableName, columns });
		headerRe.lastIndex = i; // continue search past this table
	}

	return tables;
}

/**
 * Parse Drizzle schema table definitions.
 * Extracts table names and column names from sqliteTable() calls.
 */
function parseDrizzleSchema(content: string): ParsedTable[] {
	const tables: ParsedTable[] = [];

	// Match: export const xxx = sqliteTable('table_name', { ... })
	const tableRegex = /sqliteTable\s*\(\s*['"](\w+)['"]\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
	let match;

	while ((match = tableRegex.exec(content)) !== null) {
		const tableName = match[1];
		const body = match[2];
		const columns: ParsedTable['columns'] = [];

		// Match column definitions: colName: text('col_name').notNull().primaryKey()
		const colRegex = /(\w+)\s*:\s*(?:text|integer|real|blob)\s*\(\s*['"](\w+)['"](?:\s*,\s*\{[^}]*\})?\s*\)([^,}]*)/g;
		let colMatch;

		while ((colMatch = colRegex.exec(body)) !== null) {
			const sqlName = colMatch[2]; // the actual SQL column name
			const modifiers = colMatch[3] || '';

			columns.push({
				name: sqlName,
				type: 'UNKNOWN', // Drizzle type is resolved at runtime
				primaryKey: /\.primaryKey\(\)/.test(modifiers),
				notNull: /\.notNull\(\)/.test(modifiers) || /\.primaryKey\(\)/.test(modifiers)
			});
		}

		tables.push({ name: tableName, columns });
	}

	return tables;
}

// ────────────────────────────────────────────────────────────────
// Runtime DDL execution
// ────────────────────────────────────────────────────────────────

/**
 * Extract the SQL strings passed to `sqlite.exec(...)` / `.run(...)` in
 * db/index.ts, in source order.
 *
 * Only static string/template literals are returned. Literals containing
 * `${...}` interpolation are skipped — we can't know their runtime value,
 * so executing them would either crash spuriously or give a false pass.
 */
function extractExecSql(content: string): string[] {
	const statements: string[] = [];
	const callRe = /\.(?:exec|run)\s*\(/g;
	let m: RegExpExecArray | null;

	while ((m = callRe.exec(content)) !== null) {
		let i = callRe.lastIndex;
		while (i < content.length && /\s/.test(content[i])) i += 1; // skip whitespace

		const quote = content[i];
		if (quote !== '`' && quote !== '"' && quote !== "'") continue; // arg isn't a literal
		i += 1;

		let buf = '';
		let interpolated = false;
		while (i < content.length) {
			const ch = content[i];
			if (ch === '\\') {
				buf += ch + (content[i + 1] ?? '');
				i += 2;
				continue;
			}
			if (quote === '`' && ch === '$' && content[i + 1] === '{') interpolated = true;
			if (ch === quote) break;
			buf += ch;
			i += 1;
		}

		if (interpolated) continue;
		const sql = buf.trim();
		if (sql) statements.push(sql);
	}

	return statements;
}

/**
 * Actually run the DDL against an in-memory bun:sqlite database.
 *
 * The static parser above only checks that the DDL *text* lines up with
 * schema.ts — it never executes it. But db/index.ts runs `sqlite.exec(...)`
 * at module-load time, so any SQL that parses-as-text but is rejected by
 * bun:sqlite (malformed DEFAULT/CHECK, reserved-word column, CREATE INDEX
 * before its table, etc.) throws at boot, before the server listens. The
 * process then dies inside the WorkspaceProcessManager's 2s startup window
 * and the smoke test reports "Could not start workspace process".
 *
 * Executing the same statements here surfaces that failure at the schema
 * gate, while the schema fixer still has DDL context.
 */
function executeDDL(indexContent: string): SchemaIssue[] {
	const statements = extractExecSql(indexContent);
	if (statements.length === 0) return []; // placeholder or dynamically-built DDL — nothing to run

	let db: Database | null = null;
	try {
		db = new Database(':memory:');
	} catch {
		return []; // can't open in-memory DB (non-bun env) — don't fail the gate on infra
	}

	try {
		for (const sql of statements) {
			try {
				db.exec(sql);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				const snippet = sql.slice(0, 200).replace(/\s+/g, ' ');
				return [
					{
						table: '*',
						issue: `DDL failed to execute against bun:sqlite — the app will crash at boot, not just on first query. ${message}. Offending SQL: ${snippet}`,
						severity: 'error'
					}
				];
			}
		}
		return [];
	} finally {
		db.close();
	}
}

// ────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────

/**
 * Validate that DDL in db/index.ts matches the Drizzle schema in db/schema.ts.
 */
export function validateSchema(versionPath: string): SchemaValidationResult {
	const schemaPath = join(versionPath, 'src', 'lib', 'server', 'db', 'schema.ts');
	const indexPath = join(versionPath, 'src', 'lib', 'server', 'db', 'index.ts');
	const issues: SchemaIssue[] = [];

	if (!existsSync(schemaPath)) {
		issues.push({ table: '*', issue: 'schema.ts not found', severity: 'error' });
		return { issues, passed: false };
	}

	if (!existsSync(indexPath)) {
		issues.push({ table: '*', issue: 'db/index.ts not found', severity: 'error' });
		return { issues, passed: false };
	}

	const schemaContent = readFileSync(schemaPath, 'utf-8');
	const indexContent = readFileSync(indexPath, 'utf-8');

	// Strongest check: actually run the DDL. Catches runtime-invalid-but-parseable
	// SQL that would otherwise only fail at boot (→ "Could not start workspace process").
	issues.push(...executeDDL(indexContent));

	const drizzleTables = parseDrizzleSchema(schemaContent);
	const ddlTables = parseDDL(indexContent);

	// Check: every table in schema.ts has a CREATE TABLE in index.ts
	for (const schemaTable of drizzleTables) {
		const ddlTable = ddlTables.find(t => t.name === schemaTable.name);

		if (!ddlTable) {
			issues.push({
				table: schemaTable.name,
				issue: `Table '${schemaTable.name}' exists in schema.ts but has no CREATE TABLE in index.ts`,
				severity: 'error'
			});
			continue;
		}

		// Check columns
		for (const schemaCol of schemaTable.columns) {
			const ddlCol = ddlTable.columns.find(c => c.name === schemaCol.name);

			if (!ddlCol) {
				issues.push({
					table: schemaTable.name,
					column: schemaCol.name,
					issue: `Column '${schemaCol.name}' in schema.ts but missing from CREATE TABLE DDL`,
					severity: 'error'
				});
				continue;
			}

			// Check NOT NULL mismatch
			if (schemaCol.notNull && !ddlCol.notNull) {
				issues.push({
					table: schemaTable.name,
					column: schemaCol.name,
					issue: `Column '${schemaCol.name}' is notNull() in schema.ts but missing NOT NULL in DDL`,
					severity: 'warning'
				});
			}

			// Check PRIMARY KEY mismatch
			if (schemaCol.primaryKey && !ddlCol.primaryKey) {
				issues.push({
					table: schemaTable.name,
					column: schemaCol.name,
					issue: `Column '${schemaCol.name}' is primaryKey() in schema.ts but missing PRIMARY KEY in DDL`,
					severity: 'error'
				});
			}
		}

		// Check for DDL columns not in schema
		for (const ddlCol of ddlTable.columns) {
			if (!schemaTable.columns.find(c => c.name === ddlCol.name)) {
				issues.push({
					table: schemaTable.name,
					column: ddlCol.name,
					issue: `Column '${ddlCol.name}' in DDL but not in schema.ts — queries won't include it`,
					severity: 'warning'
				});
			}
		}
	}

	// Check: tables in DDL but not in schema.ts
	for (const ddlTable of ddlTables) {
		if (!drizzleTables.find(t => t.name === ddlTable.name)) {
			issues.push({
				table: ddlTable.name,
				issue: `Table '${ddlTable.name}' has CREATE TABLE in index.ts but no Drizzle schema — queries can't use it`,
				severity: 'warning'
			});
		}
	}

	return {
		issues,
		passed: issues.filter(i => i.severity === 'error').length === 0
	};
}

/**
 * Format schema validation results for AI prompts or console output.
 */
export function formatSchemaIssues(result: SchemaValidationResult): string {
	if (result.issues.length === 0) {
		return 'Schema validation: PASSED (DDL matches Drizzle schema)';
	}

	const errors = result.issues.filter(i => i.severity === 'error');
	const warnings = result.issues.filter(i => i.severity === 'warning');

	const lines = [`Schema validation: ${errors.length} errors, ${warnings.length} warnings\n`];

	for (const issue of result.issues) {
		const icon = issue.severity === 'error' ? 'ERROR' : 'WARN';
		const col = issue.column ? `.${issue.column}` : '';
		lines.push(`  [${icon}] ${issue.table}${col}: ${issue.issue}`);
	}

	return lines.join('\n');
}
