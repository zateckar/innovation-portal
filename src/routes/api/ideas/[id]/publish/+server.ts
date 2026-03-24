import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ideasService } from '$lib/server/services/ideas';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	try {
		await ideasService.approveAndPublishSpec(params.id, locals.user.id);
		return json({ success: true });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('403')) throw error(403, message);
		if (message.includes('not found')) throw error(404, 'Idea not found');
		console.error('[API] Publish spec failed:', err);
		throw error(500, 'Failed to publish specification');
	}
};
