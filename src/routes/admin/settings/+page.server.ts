import type { PageServerLoad, Actions } from './$types';
import { db, settings } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { scannerService } from '$lib/server/services/scanner';

export const load: PageServerLoad = async () => {
	// Ensure settings exist and return them
	const currentSettings = await scannerService.ensureSettings();
	
	return {
		settings: currentSettings
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const formData = await request.formData();
		
		const filterPrompt = formData.get('filterPrompt') as string || null;
		const researchPrompt = formData.get('researchPrompt') as string || null;
		const autoModeEnabled = formData.get('autoModeEnabled') === 'on';
		const autoPublishThreshold = parseFloat(formData.get('autoPublishThreshold') as string) || 7.0;
		const autoInnovationsPerRun = parseInt(formData.get('autoInnovationsPerRun') as string) || 3;
		const autoRunIntervalMinutes = parseInt(formData.get('autoRunIntervalMinutes') as string) || 60;
		const scanIntervalMinutes = parseInt(formData.get('scanIntervalMinutes') as string) || 120;
		const filterIntervalMinutes = parseInt(formData.get('filterIntervalMinutes') as string) || 30;
		
		// Validate thresholds
		if (autoPublishThreshold < 1 || autoPublishThreshold > 10) {
			return fail(400, { error: 'Auto-publish threshold must be between 1 and 10' });
		}
		
		if (autoInnovationsPerRun < 1 || autoInnovationsPerRun > 20) {
			return fail(400, { error: 'Innovations per run must be between 1 and 20' });
		}
		
		try {
			// Update settings
			await db.update(settings)
				.set({
					filterPrompt: filterPrompt?.trim() || null,
					researchPrompt: researchPrompt?.trim() || null,
					autoModeEnabled,
					autoPublishThreshold,
					autoInnovationsPerRun,
					autoRunIntervalMinutes,
					scanIntervalMinutes,
					filterIntervalMinutes,
					updatedAt: new Date()
				})
				.where(eq(settings.id, 'default'));
			
			return { success: true, message: 'Settings saved successfully' };
		} catch (error) {
			console.error('Error saving settings:', error);
			return fail(500, { error: 'Failed to save settings' });
		}
	},
	
	resetPrompts: async () => {
		try {
			await db.update(settings)
				.set({
					filterPrompt: null,
					researchPrompt: null,
					updatedAt: new Date()
				})
				.where(eq(settings.id, 'default'));
			
			return { success: true, message: 'Prompts reset to defaults' };
		} catch (error) {
			return fail(500, { error: 'Failed to reset prompts' });
		}
	}
};
