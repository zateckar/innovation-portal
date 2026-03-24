import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ideasService } from '$lib/server/services/ideas';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = await request.json().catch(() => null);
	if (!body?.instruction?.trim()) throw error(400, 'instruction is required');

	try {
		const result = await ideasService.requestSpecEdit(
			params.id,
			locals.user.id,
			body.instruction.trim(),
			body.sectionName ?? undefined
		);
		return json(result);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('403')) throw error(403, message);
		if (message.includes('not found')) throw error(404, 'Idea not found');
		console.error('[API] Spec edit failed:', err);
		throw error(500, 'Failed to apply spec edit');
	}
};
