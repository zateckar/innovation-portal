import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ideasService } from '$lib/server/services/ideas';

/** GET /api/ideas/{id}/mockups — fetch the stored mockup set (or null). */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const set = await ideasService.getMockups(params.id);
	return json(set);
};

/**
 * POST /api/ideas/{id}/mockups — (re)generate the full set of HTML/CSS screen
 * mockups from the current specification. Participant-only. This is slow
 * (one model call per screen), so callers should show a progress indicator.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	try {
		const set = await ideasService.generateSpecMockups(params.id, locals.user.id);
		return json(set);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('403')) throw error(403, message);
		if (message.includes('not ready') || message.includes('No spec')) throw error(400, message);
		console.error('[API] Mockup generation failed:', err);
		throw error(500, 'Failed to generate mockups');
	}
};
