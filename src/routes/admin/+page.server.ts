import type { PageServerLoad, Actions } from './$types';
import { db, innovations, rawItems, users, sources, votes, settings } from '$lib/server/db';
import { news, ideas } from '$lib/server/db/schema';
import { eq, sql, desc, count } from 'drizzle-orm';
import { runJobNow } from '$lib/server/jobs/scheduler';
import { fail } from '@sveltejs/kit';
import { scannerService } from '$lib/server/services/scanner';

export const load: PageServerLoad = async () => {
	// Ensure settings exist
	const currentSettings = await scannerService.ensureSettings();
	
	// Get stats
	const [innovationCount] = await db.select({ count: count() }).from(innovations);
	const [publishedCount] = await db.select({ count: count() }).from(innovations).where(eq(innovations.status, 'published'));
	const [pendingItemsCount] = await db.select({ count: count() }).from(rawItems).where(eq(rawItems.status, 'pending'));
	const [acceptedItemsCount] = await db.select({ count: count() }).from(rawItems).where(eq(rawItems.status, 'accepted'));
	const [processedItemsCount] = await db.select({ count: count() }).from(rawItems).where(eq(rawItems.status, 'processed'));
	const [userCount] = await db.select({ count: count() }).from(users);
	const [voteCount] = await db.select({ count: count() }).from(votes);
	const [sourceCount] = await db.select({ count: count() }).from(sources);
	const [newsCount] = await db.select({ count: count() }).from(news);
	const [newsPublishedCount] = await db.select({ count: count() }).from(news).where(eq(news.status, 'published'));
	const [ideasCount] = await db.select({ count: count() }).from(ideas);
	const [ideasPublishedCount] = await db.select({ count: count() }).from(ideas).where(eq(ideas.status, 'published'));
	
	// Get recent innovations
	const recentInnovations = await db.select({
		id: innovations.id,
		slug: innovations.slug,
		title: innovations.title,
		status: innovations.status,
		publishedAt: innovations.publishedAt
	})
	.from(innovations)
	.orderBy(desc(innovations.discoveredAt))
	.limit(5);
	
	// Get sources status
	const sourcesStatus = await db.select({
		id: sources.id,
		name: sources.name,
		enabled: sources.enabled,
		lastScannedAt: sources.lastScannedAt
	})
	.from(sources)
	.orderBy(desc(sources.lastScannedAt))
	.limit(10);
	
	return {
		stats: {
			innovations: innovationCount.count,
			published: publishedCount.count,
			pendingItems: pendingItemsCount.count,
			acceptedItems: acceptedItemsCount.count,
			processedItems: processedItemsCount.count,
			users: userCount.count,
			votes: voteCount.count,
			sources: sourceCount.count,
			news: newsCount.count,
			newsPublished: newsPublishedCount.count,
			ideas: ideasCount.count,
			ideasPublished: ideasPublishedCount.count
		},
		recentInnovations,
		sourcesStatus,
		settings: currentSettings
	};
};

export const actions: Actions = {
	runScan: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			await runJobNow('scan');
			return { success: true, message: 'Feed scan completed' };
		} catch (error) {
			return fail(500, { error: 'Scan failed' });
		}
	},
	runFilter: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('filter');
			return { success: true, message: `AI filtering completed: ${JSON.stringify(result)}` };
		} catch (error) {
			return fail(500, { error: 'Filtering failed' });
		}
	},
	runResearch: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('research');
			return { success: true, message: `AI research completed: ${JSON.stringify(result)}` };
		} catch (error) {
			return fail(500, { error: 'Research failed' });
		}
	},
	runAutoMode: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('auto');
			return { success: true, message: `Auto mode completed: ${JSON.stringify(result)}` };
		} catch (error) {
			return fail(500, { error: 'Auto mode failed' });
		}
	},
	runDiscover: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('discover');
			return { success: true, message: `Discovery completed: ${JSON.stringify(result)}` };
		} catch (error) {
			return fail(500, { error: 'Discovery failed' });
		}
	},
	runJira: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('jira');
			return { success: true, message: `Jira pipeline completed: ${JSON.stringify(result)}` };
		} catch (error) {
			return fail(500, { error: 'Jira pipeline failed' });
		}
	},
	archiveInnovation: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		
		if (!id) {
			return fail(400, { error: 'Innovation ID required' });
		}
		
		await db
			.update(innovations)
			.set({ status: 'archived' })
			.where(eq(innovations.id, id));
		
		return { success: true, message: 'Innovation archived successfully' };
	}
};
