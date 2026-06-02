import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, innovations, votes, catalogItems, users } from '$lib/server/db';
import { news, ideas, trends } from '$lib/server/db/schema';
import { eq, desc, sql, count, and, or, isNull } from 'drizzle-orm';
import { ideasService } from '$lib/server/services/ideas';
import type {
	InnovationSummary,
	CatalogItemSummary,
	InnovationCategory,
	CatalogItemStatus,
	NewsSummary,
	DepartmentCategory,
	TrendSummary,
	TrendCategoryGroup,
	TrendMaturityLevel,
	TrendTimeHorizon
} from '$lib/types';
import { DEPARTMENTS } from '$lib/types';

const LIMIT = 6;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;

	// Resolve active department: ?dept= override, else saved user preference, else all.
	const deptParam = url.searchParams.get('dept');
	const activeDept: DepartmentCategory | null =
		deptParam && (DEPARTMENTS as readonly string[]).includes(deptParam)
			? (deptParam as DepartmentCategory)
			: (locals.user.department as DepartmentCategory | null) ?? null;

	const innovationDeptFilter = activeDept
		? activeDept === 'general'
			? or(eq(innovations.department, activeDept), isNull(innovations.department))
			: eq(innovations.department, activeDept)
		: undefined;
	const catalogDeptFilter = activeDept
		? activeDept === 'general'
			? or(eq(catalogItems.department, activeDept), isNull(catalogItems.department))
			: eq(catalogItems.department, activeDept)
		: undefined;
	const newsDeptFilter = activeDept ? eq(news.category, activeDept) : undefined;

	try {
		// ── Software on the Market (innovations) ─────────────────────
		const innovationRows = await db
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
			.where(
				innovationDeptFilter
					? and(eq(innovations.status, 'published'), innovationDeptFilter)
					: eq(innovations.status, 'published')
			)
			.groupBy(innovations.id)
			.orderBy(desc(sql`vote_count`), desc(innovations.publishedAt))
			.limit(LIMIT);

		const userVotes = (
			await db.select({ innovationId: votes.innovationId }).from(votes).where(eq(votes.userId, userId))
		).map((v) => v.innovationId);

		const innovationsList: InnovationSummary[] = innovationRows.map((i) => ({
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

		const innovationsCount =
			(
				await db
					.select({ count: count() })
					.from(innovations)
					.where(
						innovationDeptFilter
							? and(eq(innovations.status, 'published'), innovationDeptFilter)
							: eq(innovations.status, 'published')
					)
			)[0]?.count ?? 0;

		// ── Catalog ──────────────────────────────────────────────────
		const catalogRows = await db
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
			.where(
				catalogDeptFilter
					? and(eq(catalogItems.status, 'active'), catalogDeptFilter)
					: eq(catalogItems.status, 'active')
			)
			.orderBy(desc(catalogItems.createdAt))
			.limit(LIMIT);

		const catalogList: CatalogItemSummary[] = catalogRows.map((item) => ({
			...item,
			category: item.category as InnovationCategory,
			department: (item.department ?? null) as DepartmentCategory | null,
			status: item.status as CatalogItemStatus
		}));

		const catalogStatusFilter = or(eq(catalogItems.status, 'active'), eq(catalogItems.status, 'maintenance'));
		const catalogCount =
			(
				await db
					.select({ count: count() })
					.from(catalogItems)
					.where(catalogDeptFilter ? and(catalogStatusFilter, catalogDeptFilter) : catalogStatusFilter)
			)[0]?.count ?? 0;

		// ── News ─────────────────────────────────────────────────────
		const newsRows = await db
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
			.where(
				newsDeptFilter ? and(eq(news.status, 'published'), newsDeptFilter) : eq(news.status, 'published')
			)
			.orderBy(desc(news.publishedAt))
			.limit(LIMIT);

		const newsList: NewsSummary[] = newsRows.map((n) => ({
			id: n.id,
			slug: n.slug,
			title: n.title,
			summary: n.summary,
			category: n.category as DepartmentCategory,
			relevanceScore: n.relevanceScore,
			publishedAt: n.publishedAt,
			createdAt: n.createdAt
		}));

		const newsCount =
			(
				await db
					.select({ count: count() })
					.from(news)
					.where(
						newsDeptFilter ? and(eq(news.status, 'published'), newsDeptFilter) : eq(news.status, 'published')
					)
			)[0]?.count ?? 0;

		// ── Trends (cross-cutting — not department filtered) ─────────
		const trendRows = await db
			.select({
				id: trends.id,
				slug: trends.slug,
				title: trends.title,
				summary: trends.summary,
				category: trends.category,
				categoryGroup: trends.categoryGroup,
				department: trends.department,
				maturityLevel: trends.maturityLevel,
				impactScore: trends.impactScore,
				timeHorizon: trends.timeHorizon,
				publishedAt: trends.publishedAt,
				createdAt: trends.createdAt
			})
			.from(trends)
			.where(eq(trends.status, 'published'))
			.orderBy(desc(trends.impactScore), desc(trends.publishedAt))
			.limit(LIMIT);

		const trendsList: TrendSummary[] = trendRows.map((t) => ({
			id: t.id,
			slug: t.slug,
			title: t.title,
			summary: t.summary,
			category: t.category,
			categoryGroup: t.categoryGroup as TrendCategoryGroup,
			department: (t.department ?? null) as DepartmentCategory | null,
			maturityLevel: t.maturityLevel as TrendMaturityLevel | null,
			impactScore: t.impactScore,
			timeHorizon: t.timeHorizon as TrendTimeHorizon | null,
			publishedAt: t.publishedAt,
			createdAt: t.createdAt
		}));

		const trendsCount =
			(await db.select({ count: count() }).from(trends).where(eq(trends.status, 'published')))[0]?.count ?? 0;

		// ── Generated ideas (ai + jira) ──────────────────────────────
		const { ideas: ideasList, total: ideasCount } = await ideasService.getPublishedIdeas(
			{
				department: activeDept ?? undefined,
				source: ['ai', 'jira'],
				sort: 'votes',
				limit: LIMIT
			},
			userId
		);

		return {
			activeDept,
			innovations: innovationsList,
			innovationsCount,
			catalog: catalogList,
			catalogCount,
			news: newsList,
			newsCount,
			trends: trendsList,
			trendsCount,
			ideas: ideasList,
			ideasCount
		};
	} catch (err) {
		console.error('[Inspiration] Load failed:', err);
		return {
			activeDept,
			innovations: [] as InnovationSummary[],
			innovationsCount: 0,
			catalog: [] as CatalogItemSummary[],
			catalogCount: 0,
			news: [] as NewsSummary[],
			newsCount: 0,
			trends: [] as TrendSummary[],
			trendsCount: 0,
			ideas: [] as Awaited<ReturnType<typeof ideasService.getPublishedIdeas>>['ideas'],
			ideasCount: 0
		};
	}
};

export const actions: Actions = {
	setDepartment: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/auth/login');
		}
		const formData = await request.formData();
		const dept = formData.get('dept') as string | null;
		const newDept =
			dept && (DEPARTMENTS as readonly string[]).includes(dept) ? (dept as DepartmentCategory) : null;

		try {
			await db.update(users).set({ department: newDept }).where(eq(users.id, locals.user.id));
		} catch {
			// ignore — preference just won't persist
		}

		throw redirect(303, '/inspiration');
	}
};
