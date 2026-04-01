import type { PageServerLoad, Actions } from './$types';
import { db, settings } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { scannerService } from '$lib/server/services/scanner';
import { aiService } from '$lib/server/services/ai';
import { clearOIDCCache } from '$lib/server/services/oidc';
import { jiraService } from '$lib/server/services/jira';
import { setLogLevel, type LogLevel } from '$lib/server/logger';

export const load: PageServerLoad = async () => {
	// Ensure settings exist and return them
	try {
	const currentSettings = await scannerService.ensureSettings();
	
	return {
		settings: currentSettings
	};
	} catch {
		return { settings: null };
	}
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
		const jiraWebHostname = formData.get('jiraWebHostname') as string || null;
		const jiraApimSubscriptionKey = formData.get('jiraApimSubscriptionKey') as string || null;
		const jiraMtlsCert = formData.get('jiraMtlsCert') as string || null;
		const jiraMtlsKey = formData.get('jiraMtlsKey') as string || null;
		const jiraJql = formData.get('jiraJql') as string || null;
		const jiraExtractionPrompt = formData.get('jiraExtractionPrompt') as string || null;
		const jiraProjectKey = formData.get('jiraProjectKey') as string || null;

		// Development stage settings
		const ideaVoteThresholdRaw = formData.get('ideaVoteThreshold') as string;
		const ideaVoteThreshold = ideaVoteThresholdRaw ? parseInt(ideaVoteThresholdRaw) : undefined;
		const techStackRules = formData.get('techStackRules') as string || null;

		// Azure DevOps settings
		const adoEnabled = formData.get('adoEnabled') === 'true';
		const adoOrgUrl = formData.get('adoOrgUrl') as string || null;
		const adoProject = formData.get('adoProject') as string || null;
		const adoRepoId = formData.get('adoRepoId') as string || null;
		const adoTargetBranch = formData.get('adoTargetBranch') as string || 'main';
		const adoPatRaw = formData.get('adoPat') as string;

		// Logging settings
		const logLevel = (formData.get('logLevel') as LogLevel) || 'INFO';
		const validLevels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
		const safeLogLevel: LogLevel = validLevels.includes(logLevel) ? logLevel : 'INFO';
		
		try {
			// Selectively clear caches only when the relevant settings have actually changed.
			// Comparing against the current DB values avoids unnecessary cache busting on
			// every settings save (e.g., saving OIDC settings should not flush the AI client).
			const [currentSettings] = await db.select().from(settings).where(eq(settings.id, 'default'));

			const llmChanged =
				llmApiKey !== currentSettings?.llmApiKey ||
				(llmModel?.trim() || null) !== (currentSettings?.llmModel || null);
			if (llmChanged) {
				await aiService.clearCache();
			}

			const oidcChanged =
				oidcEnabled !== (currentSettings?.oidcEnabled ?? false) ||
				oidcIssuer !== currentSettings?.oidcIssuer ||
				oidcClientId !== currentSettings?.oidcClientId ||
				oidcClientSecret !== currentSettings?.oidcClientSecret;
			if (oidcChanged) {
				clearOIDCCache();
			}

			// Clear Jira mTLS agent cache only when Jira credentials have changed
			const jiraCredChanged =
				(jiraMtlsCert?.trim() || null) !== currentSettings?.jiraMtlsCert ||
				(jiraMtlsKey?.trim() || null) !== currentSettings?.jiraMtlsKey;
			if (jiraCredChanged) {
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
				jiraWebHostname: jiraWebHostname?.trim() || null,
				jiraApimSubscriptionKey: jiraApimSubscriptionKey?.trim() || null,
					jiraMtlsCert: jiraMtlsCert?.trim() || null,
					jiraMtlsKey: jiraMtlsKey?.trim() || null,
				jiraJql: jiraJql?.trim() || null,
				jiraExtractionPrompt: jiraExtractionPrompt?.trim() || null,
				jiraProjectKey: jiraProjectKey?.trim() || null,
				// Development stage
				...(ideaVoteThreshold && !isNaN(ideaVoteThreshold) ? { ideaVoteThreshold } : {}),
				techStackRules: techStackRules?.trim() || null,
				// Azure DevOps
				adoEnabled,
				adoOrgUrl: adoOrgUrl?.trim() || null,
				adoProject: adoProject?.trim() || null,
				adoRepoId: adoRepoId?.trim() || null,
				adoTargetBranch: adoTargetBranch?.trim() || 'main',
				// Only update PAT if a new one was entered
				...(adoPatRaw?.trim() ? { adoPat: adoPatRaw.trim() } : {}),
				logLevel: safeLogLevel,
				settingsChangedAt: new Date()
			})
				.where(eq(settings.id, 'default'));
			
			// Apply log level change immediately (no restart needed)
			setLogLevel(safeLogLevel);

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
				settingsChangedAt: new Date()
				})
				.where(eq(settings.id, 'default'));
			
			const updatedSettings = await scannerService.ensureSettings();
			return { success: true, message: 'All prompts reset to defaults', settings: updatedSettings };
		} catch (error) {
			return fail(500, { error: 'Failed to reset prompts' });
		}
	}
};
