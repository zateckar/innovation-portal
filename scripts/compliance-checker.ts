/**
 * Compliance Checker — programmatic verification that spec requirements
 * are reflected in plan and tasks.
 *
 * Parses SPECIFICATION.md, PLAN.md, and TASKS.md to cross-reference:
 * - Every feature in the spec has corresponding tasks
 * - Every screen in the spec has a planned route
 * - Every data entity is covered in the plan
 *
 * Returns structured compliance results for the builder to act on.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface ComplianceItem {
	type: 'feature' | 'screen' | 'data-entity';
	name: string;
	specSection: string;
	foundInPlan: boolean;
	foundInTasks: boolean;
	status: 'COVERED' | 'PARTIAL' | 'MISSING';
}

export interface ComplianceResult {
	items: ComplianceItem[];
	coveredCount: number;
	partialCount: number;
	missingCount: number;
	passed: boolean;
}

// ────────────────────────────────────────────────────────────────
// Parsers
// ────────────────────────────────────────────────────────────────

/**
 * Extract ### headings from a specific ## section of the spec.
 */
function extractSubheadings(content: string, sectionPattern: RegExp): string[] {
	const sectionMatch = content.match(sectionPattern);
	if (!sectionMatch) return [];

	const startIdx = sectionMatch.index! + sectionMatch[0].length;
	const nextSection = content.indexOf('\n## ', startIdx);
	const sectionContent = nextSection > 0
		? content.slice(startIdx, nextSection)
		: content.slice(startIdx);

	const headings: string[] = [];
	let m;
	const re1 = /###\s+(.+)/g;
	while ((m = re1.exec(sectionContent)) !== null) {
		headings.push(m[1].trim());
	}
	return headings;
}

/**
 * Extract bold items (e.g., **Request**: ...) from a section.
 */
function extractBoldItems(content: string, sectionPattern: RegExp): string[] {
	const sectionMatch = content.match(sectionPattern);
	if (!sectionMatch) return [];

	const startIdx = sectionMatch.index! + sectionMatch[0].length;
	const nextSection = content.indexOf('\n## ', startIdx);
	const sectionContent = nextSection > 0
		? content.slice(startIdx, nextSection)
		: content.slice(startIdx);

	const items: string[] = [];
	const seen = new Set<string>();
	let m;
	const re2 = /\*\*([^*]+)\*\*/g;
	while ((m = re2.exec(sectionContent)) !== null) {
		const name = m[1].trim().replace(/:$/, '');
		if (name.length > 2 && name.length < 60 && !seen.has(name)) {
			seen.add(name);
			items.push(name);
		}
	}
	return items;
}

// Conjunctions / articles / fillers that should NOT have to appear verbatim
// for a multi-word requirement name to count as mentioned.
const COMPLIANCE_STOPWORDS = new Set([
	'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'with', 'in', 'on', 'at',
	'by', 'from', 'is', 'are', 'be', 'this', 'that', 'it', 'its', 'as', 'via',
	'per', 'into', 'your', 'our'
]);

/**
 * Check if a term is mentioned in a document (case-insensitive fuzzy match).
 *
 * Two strategies, tried in order:
 *  1. Adjacency match — the whole term appears with only whitespace/punctuation
 *     between its words. Catches exact and near-exact mentions.
 *  2. Token coverage — every SIGNIFICANT token of the term (stopwords and
 *     parentheticals dropped) appears somewhere in the document.
 *
 * Strategy 2 is what rescues names the plan phrases differently. The adjacency
 * regex alone reported "Source Citation & Retrieval" (planned as "...citation
 * and retrieval...") and "Search Portal (Home)" (where "Home" is only a nav
 * label) as MISSING forever — sending the compliance fix agent on goose chases
 * for requirements that were already fully planned.
 */
function isMentioned(term: string, content: string): boolean {
	const haystack = content.toLowerCase();

	// Strategy 1: adjacency regex (original behaviour, trimmed of leading/trailing dots).
	const normalized = term.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
	if (normalized) {
		const escaped = normalized.replace(/\./g, '[\\s\\-_./]*');
		try {
			if (new RegExp(escaped, 'i').test(content)) return true;
		} catch {
			if (haystack.includes(term.toLowerCase())) return true;
		}
	}

	// Strategy 2: every significant token present (parentheticals dropped).
	const tokens = term
		.replace(/\([^)]*\)/g, ' ') // drop "(Home)" and similar qualifiers
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length >= 3 && !COMPLIANCE_STOPWORDS.has(t));
	if (tokens.length === 0) return false;
	// Leading word boundary only, so plurals/suffixes still match (portal → portals).
	return tokens.every((t) => new RegExp(`\\b${t}`, 'i').test(haystack));
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

/**
 * Run compliance check on a workspace version.
 */
export function checkCompliance(versionPath: string): ComplianceResult {
	const specPath = join(versionPath, 'SPECIFICATION.md');
	const planPath = join(versionPath, 'PLAN.md');
	const tasksPath = join(versionPath, 'TASKS.md');

	const items: ComplianceItem[] = [];

	if (!existsSync(specPath)) {
		return { items, coveredCount: 0, partialCount: 0, missingCount: 0, passed: true };
	}

	const spec = readFileSync(specPath, 'utf-8');
	const plan = existsSync(planPath) ? readFileSync(planPath, 'utf-8') : '';
	const tasks = existsSync(tasksPath) ? readFileSync(tasksPath, 'utf-8') : '';

	// 1. Check features (section 4)
	const features = extractSubheadings(spec, /##\s*4\.\s*What should the application do/i);
	for (const feature of features) {
		const inPlan = isMentioned(feature, plan);
		const inTasks = isMentioned(feature, tasks);
		items.push({
			type: 'feature',
			name: feature,
			specSection: '4. Features',
			foundInPlan: inPlan,
			foundInTasks: inTasks,
			status: inPlan && inTasks ? 'COVERED' : inPlan || inTasks ? 'PARTIAL' : 'MISSING'
		});
	}

	// 2. Check screens (section 5)
	const screens = extractSubheadings(spec, /##\s*5\.\s*What screens/i);
	for (const screen of screens) {
		const inPlan = isMentioned(screen, plan);
		const inTasks = isMentioned(screen, tasks);
		items.push({
			type: 'screen',
			name: screen,
			specSection: '5. Screens',
			foundInPlan: inPlan,
			foundInTasks: inTasks,
			status: inPlan && inTasks ? 'COVERED' : inPlan || inTasks ? 'PARTIAL' : 'MISSING'
		});
	}

	// 3. Check data entities (section 3)
	const entities = extractBoldItems(spec, /##\s*3\.\s*What information/i);
	for (const entity of entities) {
		const inPlan = isMentioned(entity, plan);
		const inTasks = isMentioned(entity, tasks);
		items.push({
			type: 'data-entity',
			name: entity,
			specSection: '3. Data',
			foundInPlan: inPlan,
			foundInTasks: inTasks,
			status: inPlan && inTasks ? 'COVERED' : inPlan || inTasks ? 'PARTIAL' : 'MISSING'
		});
	}

	const coveredCount = items.filter(i => i.status === 'COVERED').length;
	const partialCount = items.filter(i => i.status === 'PARTIAL').length;
	const missingCount = items.filter(i => i.status === 'MISSING').length;

	return {
		items,
		coveredCount,
		partialCount,
		missingCount,
		passed: missingCount === 0
	};
}

/**
 * Format compliance results for AI prompts or console output.
 */
export function formatCompliance(result: ComplianceResult): string {
	if (result.items.length === 0) {
		return 'Compliance check: no requirements extracted from spec (check spec format)';
	}

	const lines = [
		`Compliance: ${result.coveredCount} covered, ${result.partialCount} partial, ${result.missingCount} missing\n`,
		'| Type | Name | Spec Section | Plan | Tasks | Status |',
		'|------|------|-------------|------|-------|--------|'
	];

	for (const item of result.items) {
		lines.push(
			`| ${item.type} | ${item.name} | ${item.specSection} | ${item.foundInPlan ? 'YES' : 'NO'} | ${item.foundInTasks ? 'YES' : 'NO'} | ${item.status} |`
		);
	}

	if (result.missingCount > 0) {
		lines.push('\nMISSING items must be added to PLAN.md and TASKS.md before building.');
	}

	return lines.join('\n');
}
