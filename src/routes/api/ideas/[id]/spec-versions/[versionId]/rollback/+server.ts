import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ideasService } from '$lib/server/services/ideas';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	try {
		const result = await ideasService.rollbackSpecToVersion(
			params.id,
			locals.user.id,
			params.versionId
		);
		return json(result);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('403')) throw error(403, message);
		if (message.includes('not found')) throw error(404, 'Version not found');
		throw error(500, 'Rollback failed');
	}
};
