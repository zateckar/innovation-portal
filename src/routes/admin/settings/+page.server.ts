import type { PageServerLoad, Actions } from './$types';
import { db, settings } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { scannerService } from '$lib/server/services/scanner';
import { aiService } from '$lib/server/services/ai';
import { clearOIDCCache } from '$lib/server/services/oidc';
import { jiraService } from '$lib/server/services/jira';

export const load: PageServerLoad = async () => {
	// Ensure settings exist and return them
	const currentSettings = await scannerService.ensureSettings();
	
	return {
		settings: currentSettings
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		
		const filterPrompt = formData.get('filterPrompt') as string || null;
		const researchPrompt = formData.get('researchPrompt') as string || null;
		const newsPrompt = formData.get('newsPrompt') as string || null;
		const ideasPrompt = formData.get('ideasPrompt') as string || null;
		const evaluationPrompt = formData.get('evaluationPrompt') as string || null;
		const realizationPrompt = formData.get('realizationPrompt') as string || null;

		// LLM settings
		const llmApiKey = formData.get('llmApiKey') as string || null;
		const llmModel = formData.get('llmModel') as string || 'models/gemini-3-flash-preview';
		
		// OIDC settings
		const oidcEnabled = formData.get('oidcEnabled') === 'on';
		const oidcIssuer = formData.get('oidcIssuer') as string || null;
		const oidcClientId = formData.get('oidcClientId') as string || null;
		const oidcClientSecret = formData.get('oidcClientSecret') as string || null;

		// Jira credentials (no schedule fields — those live in Schedule page)
		const jiraUrl = formData.get('jiraUrl') as string || null;
		const jiraApimSubscriptionKey = formData.get('jiraApimSubscriptionKey') as string || null;
		const jiraMtlsCert = formData.get('jiraMtlsCert') as string || null;
		const jiraMtlsKey = formData.get('jiraMtlsKey') as string || null;
		const jiraJql = formData.get('jiraJql') as string || null;
		const jiraExtractionPrompt = formData.get('jiraExtractionPrompt') as string || null;
		
		try {
			// Clear caches if LLM or OIDC settings changed
			if (llmApiKey || llmModel) {
				await aiService.clearCache();
			}
			if (oidcEnabled || oidcIssuer || oidcClientId || oidcClientSecret) {
				clearOIDCCache();
			}
			// Clear Jira mTLS agent cache if Jira credentials changed
			if (jiraMtlsCert || jiraMtlsKey) {
				jiraService.clearCache();
			}
			
			// Update settings (prompts, LLM, OIDC, Jira credentials only)
			await db.update(settings)
				.set({
					filterPrompt: filterPrompt?.trim() || null,
					researchPrompt: researchPrompt?.trim() || null,
					newsPrompt: newsPrompt?.trim() || null,
					ideasPrompt: ideasPrompt?.trim() || null,
					evaluationPrompt: evaluationPrompt?.trim() || null,
					realizationPrompt: realizationPrompt?.trim() || null,
					llmApiKey: llmApiKey?.trim() || null,
					llmModel: llmModel?.trim() || 'models/gemini-3-flash-preview',
					oidcEnabled,
					oidcIssuer: oidcIssuer?.trim() || null,
					oidcClientId: oidcClientId?.trim() || null,
					oidcClientSecret: oidcClientSecret?.trim() || null,
					jiraUrl: jiraUrl?.trim() || null,
					jiraApimSubscriptionKey: jiraApimSubscriptionKey?.trim() || null,
					jiraMtlsCert: jiraMtlsCert?.trim() || null,
					jiraMtlsKey: jiraMtlsKey?.trim() || null,
					jiraJql: jiraJql?.trim() || null,
					jiraExtractionPrompt: jiraExtractionPrompt?.trim() || null,
					updatedAt: new Date()
				})
				.where(eq(settings.id, 'default'));
			
			// Fetch updated settings to return
			const updatedSettings = await scannerService.ensureSettings();
			
			return { success: true, message: 'Settings saved successfully', settings: updatedSettings };
		} catch (error) {
			console.error('Error saving settings:', error);
			return fail(500, { error: 'Failed to save settings' });
		}
	},
	
	resetPrompts: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			await db.update(settings)
				.set({
					filterPrompt: null,
					researchPrompt: null,
					newsPrompt: null,
					ideasPrompt: null,
					evaluationPrompt: null,
					realizationPrompt: null,
					jiraExtractionPrompt: null,
					updatedAt: new Date()
				})
				.where(eq(settings.id, 'default'));
			
			const updatedSettings = await scannerService.ensureSettings();
			return { success: true, message: 'All prompts reset to defaults', settings: updatedSettings };
		} catch (error) {
			return fail(500, { error: 'Failed to reset prompts' });
		}
	}
};
