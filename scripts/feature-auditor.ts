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
	type:
		| 'missing-route'
		| 'missing-endpoint'
		| 'endpoint-as-page'
		| 'missing-page-server'
		| 'unused-table'
		| 'missing-layout';
	detail: string;
	severity: 'error' | 'warning';
}

interface PlannedRoute {
	path: string;
	/** 'endpoint' = data/download route (expects +server.ts); 'page' = navigable +page.svelte. */
	kind: 'page' | 'endpoint';
}

/**
 * A route whose LAST segment is a data/download action, not a navigable page.
 * These must be SvelteKit `+server.ts` GET handlers (stream a CSV/JSON/file),
 * NOT `+page.svelte` — forcing a page makes a plain GET 400/render-empty.
 */
function isEndpointRoute(path: string): boolean {
	const last = path.split('/').filter(Boolean).pop() ?? '';
	if (/\.(csv|json|xml|pdf|txt|ics|rss|xlsx?)$/i.test(last)) return true;
	return /^(export|download|csv|json|feed|rss|sitemap|webhook|callback|raw)$/i.test(last);
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
function extractPlannedRoutes(planContent: string): PlannedRoute[] {
	const seen = new Set<string>();
	const routes: PlannedRoute[] = [];

	// Match route-like patterns: /word, /word/word, /word/[param]
	const routeRegex = /(?:^|\s|`)\/([a-z][a-z0-9-]*(?:\/(?:[a-z][a-z0-9-]*|\[[a-z]+\]))*)/gi;
	let match;
	while ((match = routeRegex.exec(planContent)) !== null) {
		const route = '/' + match[1];
		// Skip common non-route paths
		if (route.startsWith('/api/') || route.startsWith('/auth/')) continue;
		if (route === '/apps' || route.startsWith('/apps/')) continue;
		if (seen.has(route)) continue;
		seen.add(route);
		routes.push({ path: route, kind: isEndpointRoute(route) ? 'endpoint' : 'page' });
	}

	return routes;
}

/**
 * Walk the src/routes directory and collect actual route paths, split by what
 * serves each one: `pages` have a +page.svelte, `endpoints` have a +server.ts.
 * Keeping them apart lets the audit accept a +server.ts for a data/download
 * route and flag the reverse mistake (an export scaffolded as a page).
 */
function collectActualRoutes(routesDir: string): { pages: Set<string>; endpoints: Set<string> } {
	const pages = new Set<string>();
	const endpoints = new Set<string>();

	function walk(dir: string, prefix: string) {
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				const routeSegment = entry.name.replace(/^\(.*\)$/, ''); // strip groups
				const newPrefix = routeSegment ? `${prefix}/${routeSegment}` : prefix;
				walk(join(dir, entry.name), newPrefix);
			} else if (entry.name === '+page.svelte') {
				pages.add(prefix || '/');
			} else if (entry.name === '+server.ts') {
				endpoints.add(prefix || '/');
			}
		}
	}

	walk(routesDir, '');
	return { pages, endpoints };
}

interface SchemaTable {
	sqlName: string;   // the SQL table name, e.g. 'search_queries'
	constName: string; // the exported Drizzle binding, e.g. 'searchQueries'
}

/**
 * Extract tables from Drizzle schema.ts.
 *
 * Captures BOTH the exported const identifier and the SQL table-name string:
 *   export const searchQueries = sqliteTable('search_queries', { ... })
 * App code queries the table through the const (`searchQueries`), not the SQL
 * string, so usage detection must know both — checking only the SQL name made
 * every normally-used table look unused.
 */
function extractSchemaTableNames(content: string): SchemaTable[] {
	const tables: SchemaTable[] = [];
	const seen = new Set<string>();

	const exportRegex = /export\s+const\s+(\w+)\s*=\s*sqliteTable\s*\(\s*['"]([\w]+)['"]/g;
	let match;
	while ((match = exportRegex.exec(content)) !== null) {
		tables.push({ constName: match[1], sqlName: match[2] });
		seen.add(match[2]);
	}

	// Fallback for tables not bound to an export const (rare).
	const bareRegex = /sqliteTable\s*\(\s*['"]([\w]+)['"]/g;
	while ((match = bareRegex.exec(content)) !== null) {
		if (!seen.has(match[1])) {
			tables.push({ constName: match[1], sqlName: match[1] });
			seen.add(match[1]);
		}
	}

	return tables;
}

/**
 * Check if any of a table's aliases (Drizzle const or SQL name) is referenced
 * in the codebase (outside schema.ts and db/index.ts).
 */
function isTableUsed(aliases: string[], srcDir: string): boolean {
	const needles = aliases.filter(Boolean);

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
					if (needles.some((n) => content.includes(n))) return true;
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
		const { pages: actualPages, endpoints: actualEndpoints } = collectActualRoutes(routesDir);

		// Membership test with the existing normalization + fuzzy param matching
		// (/items/[id] matches /items/[slug]).
		const matchInSet = (route: string, set: Set<string>): boolean => {
			const normalized = route.replace(/^\//, '');
			if (set.has(route) || set.has(`/${normalized}`)) return true;
			return Array.from(set).some((r) => {
				const planParts = route.split('/');
				const actualParts = r.split('/');
				if (planParts.length !== actualParts.length) return false;
				return planParts.every(
					(p, i) =>
						p === actualParts[i] ||
						(p.startsWith('[') && actualParts[i].startsWith('['))
				);
			});
		};

		routesTotal = plannedRoutes.length;

		for (const { path: route, kind } of plannedRoutes) {
			if (kind === 'endpoint') {
				// Data/download routes are satisfied by a +server.ts GET handler.
				if (matchInSet(route, actualEndpoints)) {
					routesCovered++;
				} else if (matchInSet(route, actualPages)) {
					// Scaffolded as a page — this is the bug that 400s on a plain GET.
					findings.push({
						type: 'endpoint-as-page',
						detail: `Route '${route}' is a data/download endpoint but was built as +page.svelte. Replace it with a +server.ts GET handler that returns the file/JSON (e.g. a CSV with Content-Disposition).`,
						severity: 'error'
					});
				} else {
					findings.push({
						type: 'missing-endpoint',
						detail: `Planned endpoint '${route}' has no +server.ts in src/routes/`,
						severity: 'error'
					});
				}
			} else {
				if (matchInSet(route, actualPages)) {
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
	}

	// 2. Check +page.svelte files have corresponding +page.server.ts
	const checkServerFiles = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				checkServerFiles(join(dir, entry.name));
			} else if (entry.name === '+page.svelte') {
				const relDir = relative(versionPath, dir).replace(/\\/g, '/');
				// An endpoint dir (…/export) wrongly built as a page is already
				// reported as 'endpoint-as-page'; don't also nag about its load fn.
				const routePath =
					'/' + relDir.replace(/^src\/routes\/?/, '').replace(/\/?$/, '');
				if (isEndpointRoute(routePath)) continue;
				const serverTs = join(dir, '+page.server.ts');
				if (!existsSync(serverTs)) {
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
			if (!isTableUsed([table.constName, table.sqlName], srcDir)) {
				findings.push({
					type: 'unused-table',
					detail: `DB table '${table.sqlName}' is defined in schema.ts but never referenced in services or routes`,
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
