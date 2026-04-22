import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, innovations, votes, catalogItems, users } from '$lib/server/db';
import { news, ideas, ideaVotes, trends } from '$lib/server/db/schema';
import { eq, desc, sql, count, and, or, isNull, like } from 'drizzle-orm';
import { ideasService } from '$lib/server/services/ideas';
import type { InnovationSummary, CatalogItemSummary, InnovationCategory, CatalogItemStatus, NewsSummary, IdeaSummary, DepartmentCategory, IdeaStatus, IdeaSpecStatus, IdeaSpecReviewStatus, TrendSummary, TrendCategoryGroup, TrendMaturityLevel, TrendTimeHorizon } from '$lib/types';
import { DEPARTMENTS } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;

	// Determine active department filter:
	// 1. URL param ?dept=xxx (temporary override / from selector)
	// 2. User's saved preference
	// 3. null = show all
	const deptParam = url.searchParams.get('dept');
	const activeDept: DepartmentCategory | null =
		deptParam && (DEPARTMENTS as readonly string[]).includes(deptParam)
			? (deptParam as DepartmentCategory)
			: (locals.user.department as DepartmentCategory | null) ?? null;

	// Build optional department WHERE conditions.
	// For 'general', also match NULL rows (backfill guard — pre-migration rows may be NULL).
	const innovationDeptFilter = activeDept
		? (activeDept === 'general'
			? or(eq(innovations.department, activeDept), isNull(innovations.department))
			: eq(innovations.department, activeDept))
		: undefined;
	const catalogDeptFilter = activeDept
		? (activeDept === 'general'
			? or(eq(catalogItems.department, activeDept), isNull(catalogItems.department))
			: eq(catalogItems.department, activeDept))
		: undefined;
	const newsDeptFilter = activeDept ? eq(news.category, activeDept) : undefined;
	const ideaDeptFilter = activeDept ? eq(ideas.department, activeDept) : undefined;

	try {
	// Get published innovations with vote counts using LEFT JOIN
	const innovationsData = await db
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
			voteCount: count(votes.id).as('vote_count')
		})
		.from(innovations)
		.leftJoin(votes, eq(votes.innovationId, innovations.id))
		.where(innovationDeptFilter
			? and(eq(innovations.status, 'published'), innovationDeptFilter)
			: eq(innovations.status, 'published'))
		.groupBy(innovations.id)
		.orderBy(desc(sql`vote_count`), desc(innovations.publishedAt))
		.limit(4);
	
	// Get user's votes
	const votesData = await db
		.select({ innovationId: votes.innovationId })
		.from(votes)
		.where(eq(votes.userId, userId));
	const userVotes = votesData.map(v => v.innovationId);
	
	// Transform to InnovationSummary
	const innovationsList: InnovationSummary[] = innovationsData.map(i => ({
		id: i.id,
		slug: i.slug,
		title: i.title,
		tagline: i.tagline,
		category: i.category as InnovationSummary['category'],
		department: (i.department ?? null) as DepartmentCategory | null,
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
	
	// Filtered innovations count — respects the active department filter
	const innovationsCountData = await db
		.select({ count: count() })
		.from(innovations)
		.where(innovationDeptFilter
			? and(eq(innovations.status, 'published'), innovationDeptFilter)
			: eq(innovations.status, 'published'));
	const innovationsCount = innovationsCountData[0]?.count ?? 0;

	// Get department counts for published innovations (always unfiltered — gives the radar full picture)
	const innovationDeptCounts = await db
		.select({
			department: innovations.department,
			count: sql<number>`COUNT(*)`.as('count')
		})
		.from(innovations)
		.where(eq(innovations.status, 'published'))
		.groupBy(innovations.department);
	
	// Get recent active catalog items for the homepage showcase
	const recentCatalogItems = await db
		.select({
			id: catalogItems.id,
			slug: catalogItems.slug,
			name: catalogItems.name,
			description: catalogItems.description,
			category: catalogItems.category,
			department: catalogItems.department,
			url: catalogItems.url,
			iconUrl: catalogItems.iconUrl,
			screenshotUrl: catalogItems.screenshotUrl,
			status: catalogItems.status,
			innovationId: catalogItems.innovationId,
			createdAt: catalogItems.createdAt
		})
		.from(catalogItems)
		.where(catalogDeptFilter
			? and(eq(catalogItems.status, 'active'), catalogDeptFilter)
			: eq(catalogItems.status, 'active'))
		.orderBy(desc(catalogItems.createdAt))
		.limit(4);

	const catalogItemsList: CatalogItemSummary[] = recentCatalogItems.map(item => ({
		...item,
		category: item.category as InnovationCategory,
		department: (item.department ?? null) as DepartmentCategory | null,
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
		.where(newsDeptFilter
			? and(eq(news.status, 'published'), newsDeptFilter)
			: eq(news.status, 'published'))
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

	// Total published news count — matches /news listing (status='published' + optional dept)
	const newsCountData = await db
		.select({ count: count() })
		.from(news)
		.where(newsDeptFilter
			? and(eq(news.status, 'published'), newsDeptFilter)
			: eq(news.status, 'published'));
	const newsCount = newsCountData[0]?.count ?? 0;

	// Total active catalog items — matches /catalog default view (status IN ('active','maintenance') + optional dept)
	const catalogStatusFilter = or(eq(catalogItems.status, 'active'), eq(catalogItems.status, 'maintenance'));
	const catalogCountData = await db
		.select({ count: count() })
		.from(catalogItems)
		.where(catalogDeptFilter
			? and(catalogStatusFilter, catalogDeptFilter)
			: catalogStatusFilter);
	const catalogCount = catalogCountData[0]?.count ?? 0;

	// Total published ideas — matches /ideas listing (no specStatus filter, optional dept)
	const ideasCountData = await db
		.select({ count: count() })
		.from(ideas)
		.where(ideaDeptFilter
			? and(eq(ideas.status, 'published'), ideaDeptFilter)
			: eq(ideas.status, 'published'));
	const ideasCount = ideasCountData[0]?.count ?? 0;

	// Total ideas in development — uses the same bucketing as /development so the count matches
	// what the user sees on the page (ideas not fitting any bucket are excluded from both).
	const devBuckets = await ideasService.getIdeasInDevelopment(userId);
	const devIdeasCount =
		devBuckets.inProgress.length +
		devBuckets.underReview.length +
		devBuckets.building.length +
		devBuckets.deployed.length;

	// Get top trends — most relevant by impactScore (Trends are cross-cutting, not filtered by department)
	const recentTrendsData = await db
		.select({
			id: trends.id,
			slug: trends.slug,
			title: trends.title,
			summary: trends.summary,
			category: trends.category,
			categoryGroup: trends.categoryGroup,
			maturityLevel: trends.maturityLevel,
			impactScore: trends.impactScore,
			timeHorizon: trends.timeHorizon,
			publishedAt: trends.publishedAt,
			createdAt: trends.createdAt
		})
		.from(trends)
		.where(eq(trends.status, 'published'))
		.orderBy(desc(trends.impactScore), desc(trends.publishedAt))
		.limit(4);

	const trendsList: TrendSummary[] = recentTrendsData.map(t => ({
		id: t.id,
		slug: t.slug,
		title: t.title,
		summary: t.summary,
		category: t.category,
		categoryGroup: t.categoryGroup as TrendCategoryGroup,
		maturityLevel: t.maturityLevel as TrendMaturityLevel | null,
		impactScore: t.impactScore,
		timeHorizon: t.timeHorizon as TrendTimeHorizon | null,
		publishedAt: t.publishedAt,
		createdAt: t.createdAt
	}));

	// Total published trends count (cross-cutting — not affected by department filter)
	const trendsCountData = await db
		.select({ count: count() })
		.from(trends)
		.where(eq(trends.status, 'published'));
	const trendsCount = trendsCountData[0]?.count ?? 0;

	// Get top published ideas (voteable, not yet in development)
	const topIdeasData = await db
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
		.where(
			ideaDeptFilter
				? and(eq(ideas.status, 'published'), eq(ideas.specStatus, 'not_started'), ideaDeptFilter)
				: and(eq(ideas.status, 'published'), eq(ideas.specStatus, 'not_started'))
		)
		.groupBy(ideas.id)
		.orderBy(desc(ideas.evaluationScore))
		.limit(4);

	const topIdeasVotesData = await db
		.select({ ideaId: ideaVotes.ideaId })
		.from(ideaVotes)
		.where(eq(ideaVotes.userId, userId));
	const userTopIdeaVotes = topIdeasVotesData.map(v => v.ideaId);

	const ideasList: IdeaSummary[] = topIdeasData.map(i => ({
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
		hasVoted: userTopIdeaVotes.includes(i.id),
		createdAt: i.createdAt
	}));

	// Get development ideas (in_progress + completed), limited to 4
	const devIdeasData = await db
		.select({
			id: ideas.id,
			slug: ideas.slug,
			title: ideas.title,
			summary: ideas.summary,
			department: ideas.department,
			evaluationScore: ideas.evaluationScore,
			status: ideas.status,
			specStatus: ideas.specStatus,
			specReviewStatus: ideas.specReviewStatus,
			specDocument: ideas.specDocument,
			rank: ideas.rank,
			batchId: ideas.batchId,
			source: ideas.source,
			jiraIssueKey: ideas.jiraIssueKey,
			jiraIssueUrl: ideas.jiraIssueUrl,
			proposedByEmail: ideas.proposedByEmail,
			workspaceUuid: ideas.workspaceUuid,
			createdAt: ideas.createdAt,
			voteCount: count(ideaVotes.id).as('vote_count')
		})
		.from(ideas)
		.leftJoin(ideaVotes, eq(ideaVotes.ideaId, ideas.id))
		.where(
			ideaDeptFilter
				? and(
					eq(ideas.status, 'published'),
					or(
						eq(ideas.specStatus, 'in_progress'),
						eq(ideas.specStatus, 'completed')
					),
					ideaDeptFilter
				)
				: and(
					eq(ideas.status, 'published'),
					or(
						eq(ideas.specStatus, 'in_progress'),
						eq(ideas.specStatus, 'completed')
					)
				)
		)
		.groupBy(ideas.id)
		.orderBy(desc(ideas.updatedAt))
		.limit(4);

	const devIdeaVotesData = await db
		.select({ ideaId: ideaVotes.ideaId })
		.from(ideaVotes)
		.where(eq(ideaVotes.userId, userId));
	const userDevIdeaVotes = devIdeaVotesData.map(v => v.ideaId);

	const devIdeasList: IdeaSummary[] = devIdeasData.map(i => ({
		id: i.id,
		slug: i.slug,
		title: i.title,
		summary: i.summary,
		department: i.department as DepartmentCategory,
		evaluationScore: i.evaluationScore,
		status: i.status as IdeaStatus,
		specStatus: (i.specStatus ?? 'not_started') as IdeaSpecStatus,
		specReviewStatus: (i.specReviewStatus ?? 'not_ready') as IdeaSpecReviewStatus,
		specDocument: i.specDocument ?? null,
		rank: i.rank,
		batchId: i.batchId,
		source: i.source as 'ai' | 'jira' | 'user',
		jiraIssueKey: i.jiraIssueKey,
		jiraIssueUrl: i.jiraIssueUrl,
		proposedByEmail: i.proposedByEmail,
		workspaceUuid: i.workspaceUuid ?? null,
		voteCount: i.voteCount,
		hasVoted: userDevIdeaVotes.includes(i.id),
		createdAt: i.createdAt
	}));

	return {
		innovations: innovationsList,
		innovationsCount,
		innovationDeptCounts: Object.fromEntries(innovationDeptCounts.map(c => [c.department ?? 'general', c.count])),
		catalogItems: catalogItemsList,
		catalogCount,
		news: newsList,
		newsCount,
		trends: trendsList,
		trendsCount,
		ideas: ideasList,
		ideasCount,
		devIdeas: devIdeasList,
		devIdeasCount,
		activeDept
	};
	} catch (err) {
		console.error('[Dashboard] Load failed:', err);
		return {
			innovations: [] as InnovationSummary[],
			innovationsCount: 0,
			innovationDeptCounts: {} as Record<string, number>,
			catalogItems: [] as CatalogItemSummary[],
			catalogCount: 0,
			news: [] as NewsSummary[],
			newsCount: 0,
			trends: [] as TrendSummary[],
			trendsCount: 0,
			ideas: [] as IdeaSummary[],
			ideasCount: 0,
			devIdeas: [] as IdeaSummary[],
			devIdeasCount: 0,
			activeDept
		};
	}
};

export const actions: Actions = {
	// Save department preference for the current user
	setDepartment: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/auth/login');
		}
		const formData = await request.formData();
		const dept = formData.get('dept') as string | null;

		// null / empty = clear preference (show all)
		const newDept =
			dept && (DEPARTMENTS as readonly string[]).includes(dept)
				? (dept as DepartmentCategory)
				: null;

		try {
			await db
				.update(users)
				.set({ department: newDept })
				.where(eq(users.id, locals.user.id));
		} catch {
			// DB error — redirect anyway, preference just won't be saved
		}

		throw redirect(303, '/');
	}
};
