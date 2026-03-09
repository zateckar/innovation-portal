import type { PageServerLoad } from './$types';
import { db, innovations, votes, catalogItems } from '$lib/server/db';
import { news, ideas, ideaVotes } from '$lib/server/db/schema';
import { eq, desc, sql, count, and } from 'drizzle-orm';
import type { InnovationSummary, CatalogItemSummary, InnovationCategory, CatalogItemStatus, NewsSummary, IdeaSummary, DepartmentCategory, IdeaStatus } from '$lib/types';

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
		.limit(4);
	
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

	// Get latest published news items
	const recentNewsData = await db
		.select({
			id: news.id,
			slug: news.slug,
			title: news.title,
			summary: news.summary,
			category: news.category,
			relevanceScore: news.relevanceScore,
			publishedAt: news.publishedAt,
			createdAt: news.createdAt
		})
		.from(news)
		.where(eq(news.status, 'published'))
		.orderBy(desc(news.publishedAt))
		.limit(4);

	const newsList: NewsSummary[] = recentNewsData.map(n => ({
		id: n.id,
		slug: n.slug,
		title: n.title,
		summary: n.summary,
		category: n.category as DepartmentCategory,
		relevanceScore: n.relevanceScore,
		publishedAt: n.publishedAt,
		createdAt: n.createdAt
	}));

	// Get top-scored published ideas with vote counts
	const recentIdeasData = await db
		.select({
			id: ideas.id,
			slug: ideas.slug,
			title: ideas.title,
			summary: ideas.summary,
			department: ideas.department,
			evaluationScore: ideas.evaluationScore,
			status: ideas.status,
			rank: ideas.rank,
			batchId: ideas.batchId,
			source: ideas.source,
			jiraIssueKey: ideas.jiraIssueKey,
			jiraIssueUrl: ideas.jiraIssueUrl,
			proposedByEmail: ideas.proposedByEmail,
			createdAt: ideas.createdAt,
			voteCount: count(ideaVotes.id).as('vote_count')
		})
		.from(ideas)
		.leftJoin(ideaVotes, eq(ideaVotes.ideaId, ideas.id))
		.where(eq(ideas.status, 'published'))
		.groupBy(ideas.id)
		.orderBy(desc(count(ideaVotes.id)), desc(ideas.evaluationScore))
		.limit(4);

	// Get user's idea votes
	let userIdeaVotes: string[] = [];
	if (userId) {
		const ideaVotesData = await db
			.select({ ideaId: ideaVotes.ideaId })
			.from(ideaVotes)
			.where(eq(ideaVotes.userId, userId));
		userIdeaVotes = ideaVotesData.map(v => v.ideaId);
	}

	const ideasList: IdeaSummary[] = recentIdeasData.map(i => ({
		id: i.id,
		slug: i.slug,
		title: i.title,
		summary: i.summary,
		department: i.department as DepartmentCategory,
		evaluationScore: i.evaluationScore,
		status: i.status as IdeaStatus,
		rank: i.rank,
		batchId: i.batchId,
		source: i.source as 'ai' | 'jira' | 'user',
		jiraIssueKey: i.jiraIssueKey,
		jiraIssueUrl: i.jiraIssueUrl,
		proposedByEmail: i.proposedByEmail,
		voteCount: i.voteCount,
		hasVoted: userIdeaVotes.includes(i.id),
		createdAt: i.createdAt
	}));
	
	return {
		innovations: innovationsList,
		categoryCounts: Object.fromEntries(categoryCounts.map(c => [c.category, c.count])),
		catalogItems: catalogItemsList,
		news: newsList,
		ideas: ideasList
	};
};
