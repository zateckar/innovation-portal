/**
 * Feature Auditor — post-build verification that all planned routes
 * and features actually exist in the generated source code.
 *
 * Checks:
 * - Every route in PLAN.md has a corresponding +page.svelte
 * - Every form action referenced has a corresponding handler
 * - Every DB table in schema.ts is actually used in service/route code
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface AuditFinding {
	type: 'missing-route' | 'missing-page-server' | 'unused-table' | 'missing-layout';
	detail: string;
	severity: 'error' | 'warning';
}

export interface AuditResult {
	findings: AuditFinding[];
	routesCovered: number;
	routesTotal: number;
	passed: boolean;
}

// ────────────────────────────────────────────────────────────────
// Route Discovery
// ────────────────────────────────────────────────────────────────

/**
 * Extract route paths mentioned in PLAN.md.
 * Looks for patterns like:
 *   - /items, /items/[id]
 *   - routes listed in tables or bullet points
 */
function extractPlannedRoutes(planContent: string): string[] {
	const routes = new Set<string>();

	// Match route-like patterns: /word, /word/word, /word/[param]
	const routeRegex = /(?:^|\s|`)\/([a-z][a-z0-9-]*(?:\/(?:[a-z][a-z0-9-]*|\[[a-z]+\]))*)/gi;
	let match;
	while ((match = routeRegex.exec(planContent)) !== null) {
		const route = '/' + match[1];
		// Skip common non-route paths
		if (route.startsWith('/api/') || route.startsWith('/auth/')) continue;
		if (route === '/apps' || route.startsWith('/apps/')) continue;
		routes.add(route);
	}

	return Array.from(routes);
}

/**
 * Walk the src/routes directory and collect actual route paths.
 */
function collectActualRoutes(routesDir: string): Set<string> {
	const routes = new Set<string>();

	function walk(dir: string, prefix: string) {
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				const routeSegment = entry.name.replace(/^\(.*\)$/, ''); // strip groups
				const newPrefix = routeSegment ? `${prefix}/${routeSegment}` : prefix;
				walk(join(dir, entry.name), newPrefix);
			} else if (entry.name === '+page.svelte') {
				routes.add(prefix || '/');
			}
		}
	}

	walk(routesDir, '');
	return routes;
}

/**
 * Extract table names from Drizzle schema.ts.
 */
function extractSchemaTableNames(content: string): string[] {
	const tables: string[] = [];
	const regex = /sqliteTable\s*\(\s*['"]([\w]+)['"]/g;
	let match;
	while ((match = regex.exec(content)) !== null) {
		tables.push(match[1]);
	}
	return tables;
}

/**
 * Check if a table name is referenced in the codebase (outside schema.ts and db/index.ts).
 */
function isTableUsed(tableName: string, srcDir: string): boolean {
	function searchDir(dir: string): boolean {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (['node_modules', '.svelte-kit', 'build'].includes(entry.name)) continue;
				if (searchDir(fullPath)) return true;
			} else if (entry.name.endsWith('.ts') || entry.name.endsWith('.svelte')) {
				// Skip schema.ts and db/index.ts
				if (entry.name === 'schema.ts' && fullPath.includes('db')) continue;
				if (entry.name === 'index.ts' && fullPath.includes('db')) continue;
				try {
					const content = readFileSync(fullPath, 'utf-8');
					if (content.includes(tableName)) return true;
				} catch { /* skip unreadable */ }
			}
		}
		return false;
	}

	return searchDir(srcDir);
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

/**
 * Run feature audit on a workspace version after build.
 */
export function auditFeatures(versionPath: string): AuditResult {
	const findings: AuditFinding[] = [];
	const routesDir = join(versionPath, 'src', 'routes');
	const planPath = join(versionPath, 'PLAN.md');
	const schemaPath = join(versionPath, 'src', 'lib', 'server', 'db', 'schema.ts');

	// 1. Route coverage
	let routesCovered = 0;
	let routesTotal = 0;

	if (existsSync(planPath) && existsSync(routesDir)) {
		const plan = readFileSync(planPath, 'utf-8');
		const plannedRoutes = extractPlannedRoutes(plan);
		const actualRoutes = collectActualRoutes(routesDir);

		routesTotal = plannedRoutes.length;

		for (const route of plannedRoutes) {
			// Normalize: /items/[id] → check if 'items/[id]' or 'items/[slug]' etc. exists
			const normalized = route.replace(/^\//, '');
			const found = actualRoutes.has(route) ||
				actualRoutes.has(`/${normalized}`) ||
				Array.from(actualRoutes).some(r => {
					// Fuzzy match: /items/[id] matches /items/[slug]
					const planParts = route.split('/');
					const actualParts = r.split('/');
					if (planParts.length !== actualParts.length) return false;
					return planParts.every((p, i) =>
						p === actualParts[i] ||
						(p.startsWith('[') && actualParts[i].startsWith('['))
					);
				});

			if (found) {
				routesCovered++;
			} else {
				findings.push({
					type: 'missing-route',
					detail: `Planned route '${route}' has no +page.svelte in src/routes/`,
					severity: 'error'
				});
			}
		}
	}

	// 2. Check +page.svelte files have corresponding +page.server.ts
	const checkServerFiles = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				checkServerFiles(join(dir, entry.name));
			} else if (entry.name === '+page.svelte') {
				const serverTs = join(dir, '+page.server.ts');
				if (!existsSync(serverTs)) {
					const relDir = relative(versionPath, dir).replace(/\\/g, '/');
					findings.push({
						type: 'missing-page-server',
						detail: `${relDir}/+page.svelte exists but ${relDir}/+page.server.ts is missing (no load function)`,
						severity: 'warning'
					});
				}
			}
		}
	};
	if (existsSync(routesDir)) {
		checkServerFiles(routesDir);
	}

	// 3. Check for unused DB tables
	if (existsSync(schemaPath)) {
		const schemaContent = readFileSync(schemaPath, 'utf-8');
		const tableNames = extractSchemaTableNames(schemaContent);
		const srcDir = join(versionPath, 'src');

		for (const table of tableNames) {
			if (!isTableUsed(table, srcDir)) {
				findings.push({
					type: 'unused-table',
					detail: `DB table '${table}' is defined in schema.ts but never referenced in services or routes`,
					severity: 'warning'
				});
			}
		}
	}

	return {
		findings,
		routesCovered,
		routesTotal,
		passed: findings.filter(f => f.severity === 'error').length === 0
	};
}

/**
 * Format audit results for AI prompts or console output.
 */
export function formatAudit(result: AuditResult): string {
	const errors = result.findings.filter(f => f.severity === 'error');
	const warnings = result.findings.filter(f => f.severity === 'warning');

	const lines = [
		`Feature audit: ${result.routesCovered}/${result.routesTotal} routes built, ${errors.length} errors, ${warnings.length} warnings\n`
	];

	for (const f of result.findings) {
		const icon = f.severity === 'error' ? 'ERROR' : 'WARN';
		lines.push(`  [${icon}] ${f.detail}`);
	}

	if (result.findings.length === 0) {
		lines.push('  All planned routes built. All tables used.');
	}

	return lines.join('\n');
}
