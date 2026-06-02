import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ideasService } from '$lib/server/services/ideas';

/**
 * POST /api/ideas/{id}/spec-edit/apply
 *
 * Phase 2 of the enhanced spec edit: persist a proposal the user approved.
 * Snapshots the previous version into history first.
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = await request.json().catch(() => null);
	if (!body?.proposedSpec?.trim()) throw error(400, 'proposedSpec is required');

	try {
		const result = await ideasService.applySpecEdit(
			params.id,
			locals.user.id,
			body.proposedSpec,
			(body.summary ?? 'Spec change').toString(),
			body.sectionName ?? undefined
		);
		return json(result);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('403')) throw error(403, message);
		if (message.includes('not found') || message.includes('No spec') || message.includes('No proposed')) {
			throw error(400, message);
		}
		console.error('[API] Spec edit apply failed:', err);
		throw error(500, 'Failed to apply spec edit');
	}
};
