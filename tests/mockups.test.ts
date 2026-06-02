/**
 * Tests for the spec-mockup generation flow in src/lib/server/services/ai.ts.
 *
 * The bug: extractJson() always preferred '{' over '[' as the outermost
 * bracket, so when Gemini returned a JSON ARRAY (e.g. for the screen list
 * extraction) the parser would slice out just the first object. The caller
 * then saw a non-array and silently fell back to a single generic
 * "Main Screen" mockup, regardless of how many screens the spec actually
 * described.
 *
 * These tests stub the private getClientAsync/getSettings on the
 * aiService singleton and exercise generateMockups end-to-end.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';

// Stub the SvelteKit virtual module that ai.ts transitively imports via
// `$env/dynamic/private`. bun test runs the source as plain TS, so the
// resolver doesn't know about SvelteKit's $env aliases.
mock.module('$env/dynamic/private', () => ({
	env: {}
}));

const { aiService } = await import('../src/lib/server/services/ai.ts');

type JsonResponse = { text: () => string };
type ModelStub = { generateContent: (prompt: string) => Promise<{ response: JsonResponse }> };
type ClientStub = { getGenerativeModel: (config: Record<string, unknown>) => ModelStub };

interface Stub {
	calls: Array<{ prompt: string; config: Record<string, unknown> }>;
	respondWith: string[];
}

function stubClient(responses: string[]): Stub {
	const stub: Stub = { calls: [], respondWith: [...responses] };
	const client: ClientStub = {
		getGenerativeModel: (config) => ({
			generateContent: async (prompt: string) => {
				stub.calls.push({ prompt, config });
				const text = stub.respondWith.shift() ?? '';
				return { response: { text: () => text } };
			}
		})
	};
	// Bypass the real Gemini client and the DB-backed settings cache.
	(aiService as unknown as { genAI: ClientStub }).genAI = client;
	(aiService as unknown as { getSettings: () => Promise<{ llmApiKey: string; llmModel: string }> }).getSettings =
		async () => ({ llmApiKey: 'test-key', llmModel: 'test-model' });
	return stub;
}

afterEach(() => {
	// Reset stubs so a failed test can't poison the singleton for the next one.
	(aiService as unknown as { genAI: ClientStub | null }).genAI = null;
	(aiService as unknown as { cachedSettings: unknown }).cachedSettings = null;
});

// A valid design-system JSON response (the second model call in generateMockups,
// after screen extraction and before the per-screen HTML calls).
const SHARED_CSS = ':root{--accent:#3b82f6;}.nav-link.active{background:var(--accent);}';
function designSystemResponse(navItems: string[], appName = 'Cohesive App'): string {
	return JSON.stringify({
		appName,
		layout: 'sidebar',
		navItems,
		sharedCss: SHARED_CSS,
		shellHtml: '<aside class="sidebar"><div class="brand">Cohesive App</div></aside>'
	});
}

describe('aiService.generateMockups — screen extraction', () => {
	test('returns the real screens from the spec, not the generic fallback', async () => {
		// The shape the extractScreens prompt asks for: a top-level JSON ARRAY
		// of {screenName, purpose} objects, no code fences.
		const extractionResponse = JSON.stringify([
			{ screenName: 'Dashboard', purpose: 'Overview of weather alerts.' },
			{ screenName: 'Map View', purpose: 'Live precipitation map.' },
			{ screenName: 'Settings', purpose: 'User preferences.' }
		]);
		// generateMockups issues: 1 extraction call, 1 design-system call, then
		// one generateSingleMockup call per extracted screen (concurrency 2).
		// The exact HTML doesn't matter here — we only care about the screen list.
		const stub = stubClient([
			extractionResponse,
			designSystemResponse(['Dashboard', 'Map View', 'Settings']),
			'<!DOCTYPE html><html><body>screen 1</body></html>',
			'<!DOCTYPE html><html><body>screen 2</body></html>',
			'<!DOCTYPE html><html><body>screen 3</body></html>'
		]);

		const { designSystem, screens } = await aiService.generateMockups('Test App', 'irrelevant spec body');

		expect(screens).toHaveLength(3);
		expect(screens.map((s) => s.screenName)).toEqual(['Dashboard', 'Map View', 'Settings']);
		// 1 extract + 1 design system + 3 screens = 5 generateContent calls.
		expect(stub.calls).toHaveLength(5);
		// The shared design system is returned and injected into every screen
		// prompt so screens read as one cohesive application.
		expect(designSystem.appName).toBe('Cohesive App');
		const screenPrompts = stub.calls.slice(2).map((c) => c.prompt);
		for (const p of screenPrompts) {
			expect(p).toContain(SHARED_CSS);
		}
	});

	test('handles an array response that the model wrapped in a code fence', async () => {
		const extractionResponse =
			'```json\n' +
			JSON.stringify([
				{ screenName: 'Login', purpose: 'Auth screen.' },
				{ screenName: 'Home', purpose: 'After login.' }
			]) +
			'\n```';
		const stub = stubClient([
			extractionResponse,
			designSystemResponse(['Login', 'Home']),
			'<!DOCTYPE html><html><body>1</body></html>',
			'<!DOCTYPE html><html><body>2</body></html>'
		]);

		const { screens } = await aiService.generateMockups('Test App', 'spec');
		expect(screens.map((s) => s.screenName)).toEqual(['Login', 'Home']);
		// 1 extract + 1 design system + 2 screens.
		expect(stub.calls).toHaveLength(4);
	});

	test('falls back to a single generic screen when the response is unparseable', async () => {
		const stub = stubClient([
			'not json at all, sorry',
			// design-system call also fails to parse → code fallback design system.
			'still not json',
			'<!DOCTYPE html><html><body>fallback</body></html>'
		]);

		const { designSystem, screens } = await aiService.generateMockups('Test App', 'spec');
		expect(screens).toHaveLength(1);
		expect(screens[0].screenName).toBe('Main Screen');
		// Even on parse failure a cohesive shell is built in code from the title.
		expect(designSystem.appName).toBe('Test App');
		expect(designSystem.sharedCss.length).toBeGreaterThan(0);
		expect(designSystem.shellHtml.length).toBeGreaterThan(0);
	});
});

describe('aiService.generateSingleMockup — shared shell injection', () => {
	test('reuses the provided design system verbatim and marks the active screen', async () => {
		const stub = stubClient(['<!DOCTYPE html><html><body>regenerated</body></html>']);
		const designSystem = {
			appName: 'Cohesive App',
			layout: 'sidebar' as const,
			navItems: ['Dashboard', 'Settings'],
			sharedCss: SHARED_CSS,
			shellHtml: '<aside class="sidebar"><a data-screen="Settings">Settings</a></aside>'
		};

		const mockup = await aiService.generateSingleMockup(
			designSystem.appName,
			'spec',
			'Settings',
			'User preferences.',
			designSystem
		);

		expect(mockup.screenName).toBe('Settings');
		expect(stub.calls).toHaveLength(1);
		const prompt = stub.calls[0].prompt;
		// The exact shared CSS + shell markup and the active-screen instruction
		// are injected so the regenerated screen stays consistent with the set.
		expect(prompt).toContain(SHARED_CSS);
		expect(prompt).toContain(designSystem.shellHtml);
		expect(prompt).toContain('data-screen equals "Settings"');
	});
});
