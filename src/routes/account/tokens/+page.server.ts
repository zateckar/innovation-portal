import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listTokensForUser } from '$lib/server/services/apiTokens';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}
	const tokens = await listTokensForUser(locals.user.id);
	return {
		tokens: tokens.map((t) => ({
			...t,
			// Dates serialise to strings; format on the client
			expiresAt: t.expiresAt?.toISOString() ?? null,
			lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
			createdAt: t.createdAt?.toISOString() ?? null,
			revokedAt: t.revokedAt?.toISOString() ?? null
		}))
	};
};
