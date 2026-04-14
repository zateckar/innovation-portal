/**
 * Static Analyzer — deterministic code quality checks.
 *
 * Scans generated workspace source for known bad patterns that
 * `npm run build` won't catch (missing base path, Svelte 4 syntax, etc.).
 * Returns structured findings so the builder can send targeted fix prompts.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface AnalysisFinding {
	file: string;       // relative path
	line: number;       // 1-indexed
	rule: string;       // rule ID
	message: string;    // human-readable explanation
	severity: 'error' | 'warning';
}

export interface AnalysisResult {
	findings: AnalysisFinding[];
	errorCount: number;
	warningCount: number;
}

interface PatternRule {
	id: string;
	glob: string;       // file extension filter: '.svelte', '.ts', etc.
	regex: RegExp;
	message: string;
	severity: 'error' | 'warning';
	excludeFiles?: RegExp; // skip certain files
}

// ────────────────────────────────────────────────────────────────
// Rules
// ────────────────────────────────────────────────────────────────

const RULES: PatternRule[] = [
	// Svelte 4 syntax in .svelte files
	{
		id: 'svelte4-onclick',
		glob: '.svelte',
		regex: /\bon:click\b/g,
		message: 'Svelte 4 event syntax detected. Use onclick={handler} instead of on:click={handler}',
		severity: 'error'
	},
	{
		id: 'svelte4-oninput',
		glob: '.svelte',
		regex: /\bon:(?:input|change|submit|keydown|keyup|mouseover|mouseenter|mouseleave|focus|blur)\b/g,
		message: 'Svelte 4 event syntax detected. Use the new Svelte 5 event attribute (e.g., oninput, onchange)',
		severity: 'error'
	},
	{
		id: 'svelte4-export-let',
		glob: '.svelte',
		regex: /export\s+let\s+/g,
		message: 'Svelte 4 props syntax. Use let { prop } = $props() instead of export let prop',
		severity: 'error'
	},
	{
		id: 'svelte4-reactive',
		glob: '.svelte',
		regex: /^\s*\$:\s+/gm,
		message: 'Svelte 4 reactive statement. Use $derived() or $effect() instead of $: ...',
		severity: 'error'
	},
	{
		id: 'svelte4-slot',
		glob: '.svelte',
		regex: /<slot\s*\/?\s*>/g,
		message: 'Svelte 4 slot syntax. Use {#snippet name()}...{/snippet} and {@render name()} instead',
		severity: 'error',
		excludeFiles: /\+layout\.svelte$/
	},
	{
		id: 'svelte4-stores',
		glob: '.svelte',
		regex: /import\s*\{[^}]*writable[^}]*\}\s*from\s*['"]svelte\/store['"]/g,
		message: 'Svelte stores are deprecated in Svelte 5. Use $state() instead of writable()',
		severity: 'error'
	},
	{
		id: 'svelte4-dispatch',
		glob: '.svelte',
		regex: /createEventDispatcher/g,
		message: 'Svelte 4 event dispatcher. Pass callback props instead',
		severity: 'error'
	},

	// Missing base path
	{
		id: 'missing-base-href',
		glob: '.svelte',
		regex: /href="\/(?!apps\/|https?:)/g,
		message: 'Link missing {base} prefix. Use href="{base}/route" instead of href="/route"',
		severity: 'error'
	},
	{
		id: 'missing-base-redirect',
		glob: '.ts',
		regex: /redirect\(\d+,\s*'\/(?!apps\/)/g,
		message: 'Redirect missing ${base} prefix. Use redirect(302, `${base}/route`) instead',
		severity: 'error',
		excludeFiles: /node_modules/
	},

	// TailwindCSS v3 syntax
	{
		id: 'tailwind-v3',
		glob: '.css',
		regex: /@tailwind\s+(base|components|utilities)/g,
		message: 'TailwindCSS v3 syntax detected. Use @import "tailwindcss" instead of @tailwind directives',
		severity: 'error'
	},

	// Database init safety
	{
		id: 'create-table-unsafe',
		glob: '.ts',
		regex: /CREATE TABLE(?! IF NOT EXISTS)\s+\w/g,
		message: 'Missing IF NOT EXISTS in CREATE TABLE. Use CREATE TABLE IF NOT EXISTS to prevent startup crashes',
		severity: 'error'
	},

	// Auth re-implementation
	{
		id: 'auth-route',
		glob: '.ts',
		regex: /routes\/auth\//g,
		message: 'Auth routes must not be created. Authentication is handled by the proxy',
		severity: 'error'
	},
	{
		id: 'session-cookie',
		glob: '.ts',
		regex: /cookies\.(?:get|set|delete)\s*\(\s*['"]session['"]/g,
		message: 'Session cookie handling detected. Auth is handled by the proxy — do not manage sessions',
		severity: 'error'
	},

	// Form quality
	{
		id: 'form-no-enhance',
		glob: '.svelte',
		regex: /<form[^>]*method="POST"[^>]*(?!use:enhance)/g,
		message: 'POST form missing use:enhance. Add use:enhance for SPA form submission',
		severity: 'warning'
	},

	// Phantom test patterns
	{
		id: 'phantom-test-true',
		glob: '.test.ts',
		regex: /expect\(true\)\.toBe\(true\)/g,
		message: 'Phantom test: expect(true).toBe(true) always passes regardless of implementation',
		severity: 'error'
	},
	{
		id: 'phantom-test-no-assert',
		glob: '.test.ts',
		regex: /it\(['"][^'"]+['"]\s*,\s*(?:async\s*)?\(\)\s*=>\s*\{\s*\}\)/g,
		message: 'Empty test body — test has no assertions',
		severity: 'error'
	},

	// TODO/FIXME in production code (not tests)
	{
		id: 'todo-in-code',
		glob: '.ts',
		regex: /\/\/\s*TODO(?!.*Replace with actual)/gi,
		message: 'TODO comment in production code — implement before deploying',
		severity: 'warning',
		excludeFiles: /\.test\.ts$/
	},
];

// ────────────────────────────────────────────────────────────────
// File Walking
// ────────────────────────────────────────────────────────────────

function walkDir(dir: string, rootDir: string, files: string[] = []): string[] {
	const SKIP = new Set(['node_modules', '.svelte-kit', 'build', 'deployment', '.git', 'data']);
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (SKIP.has(entry.name)) continue;
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			walkDir(fullPath, rootDir, files);
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}
	return files;
}

// ────────────────────────────────────────────────────────────────
// Main Analysis
// ────────────────────────────────────────────────────────────────

/**
 * Run static analysis on a workspace version directory.
 * Returns structured findings for each detected issue.
 */
export function analyzeWorkspace(versionPath: string): AnalysisResult {
	const findings: AnalysisFinding[] = [];
	const srcDir = join(versionPath, 'src');

	try {
		statSync(srcDir);
	} catch {
		return { findings, errorCount: 0, warningCount: 0 };
	}

	const files = walkDir(srcDir, versionPath);

	for (const filePath of files) {
		const ext = extname(filePath);
		const relPath = relative(versionPath, filePath).replace(/\\/g, '/');
		let content: string;
		try {
			content = readFileSync(filePath, 'utf-8');
		} catch {
			continue;
		}
		const lines = content.split('\n');

		for (const rule of RULES) {
			// Skip the special missing-page-title rule (handled below)
			if (rule.id === 'missing-page-title') continue;

			// Check file extension match
			if (rule.glob === '.test.ts') {
				if (!filePath.endsWith('.test.ts')) continue;
			} else if (ext !== rule.glob) {
				continue;
			}

			// Check exclusion pattern
			if (rule.excludeFiles && rule.excludeFiles.test(filePath)) continue;

			// Check each line for the pattern
			for (let i = 0; i < lines.length; i++) {
				// Reset regex lastIndex for global regexes
				rule.regex.lastIndex = 0;
				if (rule.regex.test(lines[i])) {
					findings.push({
						file: relPath,
						line: i + 1,
						rule: rule.id,
						message: rule.message,
						severity: rule.severity
					});
				}
			}
		}

		// Special check: +page.svelte files should have <svelte:head>
		if (filePath.endsWith('+page.svelte') && !content.includes('<svelte:head>')) {
			findings.push({
				file: relPath,
				line: 1,
				rule: 'missing-page-title',
				message: 'Page is missing <svelte:head><title> tag. Every page should set a title.',
				severity: 'warning'
			});
		}
	}

	// Special check: verify +layout.server.ts exists at root
	const layoutServerPath = join(srcDir, 'routes', '+layout.server.ts');
	try {
		statSync(layoutServerPath);
	} catch {
		findings.push({
			file: 'src/routes/+layout.server.ts',
			line: 1,
			rule: 'missing-root-layout-server',
			message: 'Root +layout.server.ts is missing. It must exist and return { user: locals.user }',
			severity: 'error'
		});
	}

	return {
		findings,
		errorCount: findings.filter(f => f.severity === 'error').length,
		warningCount: findings.filter(f => f.severity === 'warning').length
	};
}

/**
 * Format analysis findings as a string for AI prompts or console output.
 */
export function formatFindings(result: AnalysisResult): string {
	if (result.findings.length === 0) {
		return 'Static analysis: PASSED (no issues found)';
	}

	const lines = [
		`Static analysis: ${result.errorCount} errors, ${result.warningCount} warnings\n`
	];

	for (const f of result.findings) {
		const icon = f.severity === 'error' ? 'ERROR' : 'WARN';
		lines.push(`  [${icon}] ${f.file}:${f.line} — ${f.message} (${f.rule})`);
	}

	return lines.join('\n');
}
