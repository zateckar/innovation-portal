import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ideasService } from '$lib/server/services/ideas';

/**
 * POST /api/ideas/{id}/mockups/{mockupId}/regenerate
 *
 * Re-render a single screen mockup from the CURRENT spec — used after a
 * comment has been applied so the visual reflects the updated specification.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	try {
		const mockup = await ideasService.regenerateMockup(params.id, locals.user.id, params.mockupId);
		return json(mockup);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('403')) throw error(403, message);
		if (message.includes('not found') || message.includes('No mockups') || message.includes('No spec')) {
			throw error(404, message);
		}
		console.error('[API] Mockup regeneration failed:', err);
		throw error(500, 'Failed to regenerate mockup');
	}
};
