import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ideasService } from '$lib/server/services/ideas';
import type { SpecEditTurn } from '$lib/types';

/**
 * POST /api/ideas/{id}/spec-edit/propose
 *
 * Phase 1 of the enhanced spec edit: the AI analyses the requested change and
 * returns an analysis + implications + a complete proposed spec. NOTHING is
 * persisted — the client reviews (and may keep discussing) before applying.
 */

// Maximum proposed-spec size we'll send back in a single response. Beyond this
// the full doc still lives on the server side (we just cap the wire payload
// so a malicious / runaway prompt cannot turn this endpoint into a bandwidth
// amplifier). The client receives a `truncated` flag plus the omitted length
// and can ask the user to scope the change to a smaller section.
const MAX_PROPOSED_SPEC_BYTES = 256 * 1024;

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = await request.json().catch(() => null);
	if (!body?.instruction?.trim()) throw error(400, 'instruction is required');

	const discussion = Array.isArray(body.messages)
		? (body.messages as SpecEditTurn[]).filter((m) => m && typeof m.content === 'string')
		: undefined;

	try {
		const result = await ideasService.proposeSpecEdit(
			params.id,
			locals.user.id,
			body.instruction.trim(),
			body.sectionName ?? undefined,
			discussion,
			typeof body.sourceContext === 'string' ? body.sourceContext : undefined
		);
		const full = result.proposedSpec;
		const fullBytes = Buffer.byteLength(full, 'utf-8');
		if (fullBytes > MAX_PROPOSED_SPEC_BYTES) {
			const truncated = full.slice(0, MAX_PROPOSED_SPEC_BYTES);
			return json({
				...result,
				proposedSpec: truncated,
				truncated: true,
				totalBytes: fullBytes
			});
		}
		return json({ ...result, truncated: false, totalBytes: fullBytes });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('403')) throw error(403, message);
		if (message.includes('not found') || message.includes('No spec')) throw error(404, message);
		console.error('[API] Spec edit propose failed:', err);
		throw error(500, 'Failed to analyse spec change');
	}
};
