import type { PageServerLoad } from './$types';
import { db, innovations, votes } from '$lib/server/db';
import { eq, desc, sql, and, count, like, or } from 'drizzle-orm';
import type { InnovationSummary, InnovationCategory } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.user?.id;
	const category = url.searchParams.get('category') as InnovationCategory | null;
	const search = url.searchParams.get('q');
	const sort = url.searchParams.get('sort') || 'votes';
	
	// Build base query with LEFT JOIN for vote counts
	let conditions = [eq(innovations.status, 'published')];
	
	// Apply filters
	if (category) {
		conditions.push(eq(innovations.category, category));
	}
	
	if (search) {
		conditions.push(
			or(
				like(innovations.title, `%${search}%`),
				like(innovations.tagline, `%${search}%`)
			)!
		);
	}
	
	// Determine order
	let orderClause;
	if (sort === 'recent') {
		orderClause = desc(innovations.publishedAt);
	} else if (sort === 'relevance') {
		orderClause = desc(innovations.relevanceScore);
	} else {
		orderClause = desc(sql`vote_count`);
	}
	
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
			voteCount: count(votes.id).as('vote_count')
		})
		.from(innovations)
		.leftJoin(votes, eq(votes.innovationId, innovations.id))
		.where(and(...conditions))
		.groupBy(innovations.id)
		.orderBy(orderClause)
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
	const innovationsList: InnovationSummary[] = innovationsData.map(i => ({
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
		innovations: innovationsList,
		filters: {
			category,
			search,
			sort
		}
	};
};
