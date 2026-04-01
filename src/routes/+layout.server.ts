import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { and, eq, or, sql } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: undefined, devCount: 0 };
	}

	// Omit accessToken — it is a server-side OIDC credential and must not be
	// serialised into the client-side page data.
	const { accessToken: _, ...publicUser } = locals.user;

	// Count ideas in development phase for the nav badge
	let devCount = 0;
	try {
		const [row] = await db
			.select({ count: sql<number>`count(*)` })
			.from(ideas)
			.where(
				and(
					eq(ideas.status, 'published'),
					or(
						eq(ideas.specStatus, 'in_progress'),
						eq(ideas.specStatus, 'completed')
					)
				)
			);
		devCount = Number(row?.count ?? 0);
	} catch {
		// DB error — degrade gracefully, nav badge shows 0
	}

	return {
		user: publicUser,
		devCount
	};
};
