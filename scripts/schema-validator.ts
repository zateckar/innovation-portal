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
 */
function parseDDL(content: string): ParsedTable[] {
	const tables: ParsedTable[] = [];
	const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([^)]+)\)/gi;
	let match;

	while ((match = tableRegex.exec(content)) !== null) {
		const tableName = match[1];
		const body = match[2];
		const columns: ParsedTable['columns'] = [];

		// Split by comma, but not commas inside parentheses
		const colDefs = body.split(/,(?![^(]*\))/).map(s => s.trim()).filter(s => s.length > 0);

		for (const colDef of colDefs) {
			// Skip constraints like FOREIGN KEY, PRIMARY KEY(...), UNIQUE(...), CHECK(...)
			if (/^\s*(FOREIGN|PRIMARY|UNIQUE|CHECK|CONSTRAINT)\s/i.test(colDef)) continue;

			const colMatch = colDef.match(/^(\w+)\s+(\w+)/i);
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
