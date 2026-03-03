import type { PageServerLoad } from './$types';
import { db, innovations, votes } from '$lib/server/db';
import { eq, desc, sql, and, count } from 'drizzle-orm';
import type { InnovationSummary } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;
	
	// Get trending innovations - sorted by recent votes (last 7 days weighted higher)
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
	const sevenDaysAgoTs = Math.floor(sevenDaysAgo.getTime() / 1000);
	
	const innovationsData = await db
		.select({
			id: innovations.id,
			slug: innovations.slug,
			title: innovations.title,
			tagline: innovations.tagline,
			category: innovations.category,
			heroImageUrl: innovations.heroImageUrl,
			isOpenSource: innovations.isOpenSource,
			isSelfHosted: innovations.isSelfHosted,
			hasAiComponent: innovations.hasAiComponent,
			maturityLevel: innovations.maturityLevel,
			relevanceScore: innovations.relevanceScore,
			actionabilityScore: innovations.actionabilityScore,
			publishedAt: innovations.publishedAt,
			voteCount: count(votes.id).as('vote_count'),
			recentVoteCount: sql<number>`SUM(CASE WHEN ${votes.createdAt} >= ${sevenDaysAgoTs} THEN 1 ELSE 0 END)`.as('recent_vote_count')
		})
		.from(innovations)
		.leftJoin(votes, eq(votes.innovationId, innovations.id))
		.where(eq(innovations.status, 'published'))
		.groupBy(innovations.id)
		.orderBy(desc(sql`recent_vote_count`), desc(sql`vote_count`))
		.limit(50);
	
	// Get user's votes if logged in
	let userVotes: string[] = [];
	if (userId) {
		const votesData = await db
			.select({ innovationId: votes.innovationId })
			.from(votes)
			.where(eq(votes.userId, userId));
		userVotes = votesData.map(v => v.innovationId);
	}
	
	// Transform to InnovationSummary
	const trendingInnovations: InnovationSummary[] = innovationsData.map(i => ({
		id: i.id,
		slug: i.slug,
		title: i.title,
		tagline: i.tagline,
		category: i.category as InnovationSummary['category'],
		heroImageUrl: i.heroImageUrl,
		isOpenSource: i.isOpenSource ?? false,
		isSelfHosted: i.isSelfHosted ?? false,
		hasAiComponent: i.hasAiComponent ?? false,
		maturityLevel: i.maturityLevel as InnovationSummary['maturityLevel'],
		relevanceScore: i.relevanceScore,
		actionabilityScore: i.actionabilityScore,
		voteCount: i.voteCount,
		hasVoted: userVotes.includes(i.id),
		publishedAt: i.publishedAt
	}));
	
	return {
		innovations: trendingInnovations
	};
};
