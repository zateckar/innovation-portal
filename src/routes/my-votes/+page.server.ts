import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db, innovations, votes } from '$lib/server/db';
import { eq, desc, count, inArray } from 'drizzle-orm';
import type { InnovationSummary, DepartmentCategory } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}
	
	const userId = locals.user.id;
	
	try {
	// Get innovations the user has voted for
	const votedInnovations = await db
		.select({
			id: innovations.id,
			slug: innovations.slug,
			title: innovations.title,
			tagline: innovations.tagline,
			category: innovations.category,
			department: innovations.department,
			heroImageUrl: innovations.heroImageUrl,
			isOpenSource: innovations.isOpenSource,
			isSelfHosted: innovations.isSelfHosted,
			hasAiComponent: innovations.hasAiComponent,
			maturityLevel: innovations.maturityLevel,
			relevanceScore: innovations.relevanceScore,
			actionabilityScore: innovations.actionabilityScore,
			publishedAt: innovations.publishedAt,
			votedAt: votes.createdAt
		})
		.from(votes)
		.innerJoin(innovations, eq(votes.innovationId, innovations.id))
		.where(eq(votes.userId, userId))
		.orderBy(desc(votes.createdAt));
	
	// Get vote counts only for innovations the user voted for
	const innovationIds = votedInnovations.map(i => i.id);
	const voteCounts: Record<string, number> = {};
	
	if (innovationIds.length > 0) {
		const counts = await db
			.select({
				innovationId: votes.innovationId,
				count: count(votes.id).as('count')
			})
			.from(votes)
			.where(inArray(votes.innovationId, innovationIds))
			.groupBy(votes.innovationId);
		
		counts.forEach(c => {
			voteCounts[c.innovationId] = c.count;
		});
	}
	
	// Transform to InnovationSummary
	const innovationsList: InnovationSummary[] = votedInnovations.map(i => ({
		id: i.id,
		slug: i.slug,
		title: i.title,
		tagline: i.tagline,
		category: i.category as InnovationSummary['category'],
		department: (i.department as DepartmentCategory) ?? null,
		heroImageUrl: i.heroImageUrl,
		isOpenSource: i.isOpenSource ?? false,
		isSelfHosted: i.isSelfHosted ?? false,
		hasAiComponent: i.hasAiComponent ?? false,
		maturityLevel: i.maturityLevel as InnovationSummary['maturityLevel'],
		relevanceScore: i.relevanceScore,
		actionabilityScore: i.actionabilityScore,
		voteCount: voteCounts[i.id] || 0,
		hasVoted: true,
		publishedAt: i.publishedAt
	}));
	
	return {
		innovations: innovationsList
	};
	} catch {
		return { innovations: [] as InnovationSummary[] };
	}
};
