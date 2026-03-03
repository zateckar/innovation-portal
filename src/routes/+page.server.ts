import type { PageServerLoad } from './$types';
import { db, innovations, votes, catalogItems } from '$lib/server/db';
import { eq, desc, sql, count, or } from 'drizzle-orm';
import type { InnovationSummary, CatalogItemSummary, InnovationCategory, CatalogItemStatus } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;
	
	// Get published innovations with vote counts using LEFT JOIN
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
		.where(eq(innovations.status, 'published'))
		.groupBy(innovations.id)
		.orderBy(desc(sql`vote_count`), desc(innovations.publishedAt))
		.limit(20);
	
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
	
	// Get category counts
	const categoryCounts = await db
		.select({
			category: innovations.category,
			count: sql<number>`COUNT(*)`.as('count')
		})
		.from(innovations)
		.where(eq(innovations.status, 'published'))
		.groupBy(innovations.category);
	
	// Get recent active catalog items for the homepage showcase
	const recentCatalogItems = await db
		.select({
			id: catalogItems.id,
			slug: catalogItems.slug,
			name: catalogItems.name,
			description: catalogItems.description,
			category: catalogItems.category,
			url: catalogItems.url,
			iconUrl: catalogItems.iconUrl,
			screenshotUrl: catalogItems.screenshotUrl,
			status: catalogItems.status,
			innovationId: catalogItems.innovationId,
			createdAt: catalogItems.createdAt
		})
		.from(catalogItems)
		.where(eq(catalogItems.status, 'active'))
		.orderBy(desc(catalogItems.createdAt))
		.limit(4);

	const catalogItemsList: CatalogItemSummary[] = recentCatalogItems.map(item => ({
		...item,
		category: item.category as InnovationCategory,
		status: item.status as CatalogItemStatus
	}));
	
	return {
		innovations: innovationsList,
		categoryCounts: Object.fromEntries(categoryCounts.map(c => [c.category, c.count])),
		catalogItems: catalogItemsList
	};
};
