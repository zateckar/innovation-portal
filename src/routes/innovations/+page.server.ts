import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, innovations, votes } from '$lib/server/db';
import { eq, desc, sql, and, count, like, or, isNull } from 'drizzle-orm';
import type { InnovationSummary, DepartmentCategory } from '$lib/types';
import { DEPARTMENTS } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;
	const department = url.searchParams.get('department') as DepartmentCategory | null;
	const search = url.searchParams.get('q');
	const sort = url.searchParams.get('sort') || 'votes';

	// Validate department param
	const activeDept = department && (DEPARTMENTS as readonly string[]).includes(department)
		? department
		: null;

	// Build base query conditions
	const conditions = [eq(innovations.status, 'published')];

	if (activeDept) {
		if (activeDept === 'general') {
			conditions.push(or(eq(innovations.department, 'general'), isNull(innovations.department))!);
		} else {
			conditions.push(eq(innovations.department, activeDept));
		}
	}

	if (search) {
		const escapedSearch = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
		conditions.push(
			or(
				like(innovations.title, `%${escapedSearch}%`),
				like(innovations.tagline, `%${escapedSearch}%`)
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

	try {
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
		.where(and(...conditions))
		.groupBy(innovations.id)
		.orderBy(orderClause)
		.limit(50);

	// Get user's votes
	const votesData = await db
		.select({ innovationId: votes.innovationId })
		.from(votes)
		.where(eq(votes.userId, userId));
	const userVotes = votesData.map(v => v.innovationId);

	// Department counts for the filter bar (always unfiltered)
	const deptCounts = await db
		.select({
			department: innovations.department,
			count: sql<number>`COUNT(*)`.as('count')
		})
		.from(innovations)
		.where(eq(innovations.status, 'published'))
		.groupBy(innovations.department);

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

	return {
		innovations: innovationsList,
		deptCounts: Object.fromEntries(deptCounts.map(c => [c.department ?? 'general', c.count])),
		filters: {
			department: activeDept,
			search,
			sort
		}
	};
	} catch {
		return {
			innovations: [] as InnovationSummary[],
			deptCounts: {} as Record<string, number>,
			filters: { department: activeDept, search, sort }
		};
	}
};
