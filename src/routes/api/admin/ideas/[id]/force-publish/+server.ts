import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ideasService } from '$lib/server/services/ideas';
import { auditAsync } from '$lib/server/audit';

export const POST: RequestHandler = async (event) => {
	const { params, locals } = event;
	if (!locals.user) throw error(401, 'Unauthorized');
	if (locals.user.role !== 'admin') throw error(403, 'Admin only');

	try {
		await ideasService.forcePublishSpec(params.id);
		auditAsync({
			event,
			action: 'idea.force_publish',
			targetType: 'idea',
			targetId: params.id
		});
		return json({ success: true });
	} catch (err: unknown) {
		console.error('[API] Force publish failed:', err);
		throw error(500, 'Failed to force-publish specification');
	}
};
