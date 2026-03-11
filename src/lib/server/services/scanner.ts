import Parser from 'rss-parser';
import { db, sources, rawItems, innovations, settings, votes, innovationSources, type NewRawItem } from '$lib/server/db';
import { eq, and, desc, sql, lt, or, like, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { aiService } from './ai';
import { generateSlug } from '$lib/utils/slug';
import type { Settings } from '$lib/server/db/schema';

const parser = new Parser({
	timeout: 30000,
	headers: {
		'User-Agent': 'InnovationRadar/1.0 (Feed Scanner)'
	}
});

interface FeedItem {
	title: string;
	link: string;
	content?: string;
	contentSnippet?: string;
	pubDate?: string;
	guid?: string;
}

export class ScannerService {
	/**
	 * Get current settings from database
	 */
	async getSettings(): Promise<Settings | null> {
		const [currentSettings] = await db.select().from(settings).where(eq(settings.id, 'default'));
		return currentSettings || null;
	}
	
	/**
	 * Ensure default settings exist.
	 * Uses INSERT OR IGNORE to avoid a TOCTOU race where two concurrent callers
	 * both find no row and both attempt to INSERT, causing a PK constraint violation.
	 */
	async ensureSettings(): Promise<Settings> {
		// Upsert: insert only if the row does not already exist
		await db.insert(settings).values({ id: 'default' }).onConflictDoNothing();
		const [currentSettings] = await db.select().from(settings).where(eq(settings.id, 'default'));
		return currentSettings;
	}
	
	/**
	 * Update last run timestamp for scan job
	 */
	async updateScanLastRun(): Promise<void> {
		await db.update(settings)
			.set({ scanLastRunAt: new Date() })
			.where(eq(settings.id, 'default'));
	}
	
	/**
	 * Update last run timestamp for filter job
	 */
	async updateFilterLastRun(): Promise<void> {
		await db.update(settings)
			.set({ filterLastRunAt: new Date() })
			.where(eq(settings.id, 'default'));
	}
	
	/**
	 * Update last run timestamp for research job
	 */
	async updateResearchLastRun(): Promise<void> {
		await db.update(settings)
			.set({ researchLastRunAt: new Date() })
			.where(eq(settings.id, 'default'));
	}

	/**
	 * Update last run timestamp for auto mode job (separate from scanLastRunAt)
	 */
	async updateAutoModeLastRun(): Promise<void> {
		await db.update(settings)
			.set({ autoModeLastRunAt: new Date() })
			.where(eq(settings.id, 'default'));
	}
	
	/**
	 * Check if scan job should run based on interval
	 */
	async shouldRunScan(): Promise<boolean> {
		const s = await this.getSettings();
		if (!s?.scanEnabled) return false;
		
		if (!s.scanLastRunAt) return true;
		
		const minutesSinceLastRun = (Date.now() - s.scanLastRunAt.getTime()) / (1000 * 60);
		return minutesSinceLastRun >= (s.scanIntervalMinutes || 120);
	}
	
	/**
	 * Check if filter job should run based on interval
	 */
	async shouldRunFilter(): Promise<boolean> {
		const s = await this.getSettings();
		if (!s?.filterEnabled) return false;
		
		if (!s.filterLastRunAt) return true;
		
		const minutesSinceLastRun = (Date.now() - s.filterLastRunAt.getTime()) / (1000 * 60);
		return minutesSinceLastRun >= (s.filterIntervalMinutes || 30);
	}
	
	/**
	 * Check if research job should run based on interval
	 */
	async shouldRunResearch(): Promise<boolean> {
		const s = await this.getSettings();
		if (!s?.researchEnabled) return false;
		
		if (!s.researchLastRunAt) return true;
		
		const minutesSinceLastRun = (Date.now() - s.researchLastRunAt.getTime()) / (1000 * 60);
		return minutesSinceLastRun >= (s.researchIntervalMinutes || 60);
	}
	
	/**
	 * Check if archive job should run based on interval
	 */
	async shouldRunArchive(): Promise<boolean> {
		const s = await this.getSettings();
		if (!s?.archiveEnabled) return false;
		
		if (!s.archiveLastRunAt) return true;
		
		const minutesSinceLastRun = (Date.now() - s.archiveLastRunAt.getTime()) / (1000 * 60);
		return minutesSinceLastRun >= (s.archiveIntervalMinutes || 60);
	}
	
	/**
	 * Check if cleanup job should run based on interval
	 */
	async shouldRunCleanup(): Promise<boolean> {
		const s = await this.getSettings();
		if (!s?.cleanupEnabled) return false;
		
		if (!s.cleanupLastRunAt) return true;
		
		const minutesSinceLastRun = (Date.now() - s.cleanupLastRunAt.getTime()) / (1000 * 60);
		return minutesSinceLastRun >= (s.cleanupIntervalMinutes || 60);
	}
	
	/**
	 * Update last run timestamp for archive job
	 */
	async updateArchiveLastRun(): Promise<void> {
		await db.update(settings)
			.set({ archiveLastRunAt: new Date() })
			.where(eq(settings.id, 'default'));
	}
	
	/**
	 * Update last run timestamp for cleanup job
	 */
	async updateCleanupLastRun(): Promise<void> {
		await db.update(settings)
			.set({ cleanupLastRunAt: new Date() })
			.where(eq(settings.id, 'default'));
	}
	
	/**
	 * Scan a single RSS/Atom feed source
	 */
	async scanSource(sourceId: string): Promise<number> {
		const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
		
		if (!source || !source.enabled) {
			console.log(`Source ${sourceId} not found or disabled`);
			return 0;
		}
		
		console.log(`Scanning source: ${source.name} (${source.url})`);
		
		let itemsAdded = 0;
		
		try {
			if (source.type === 'rss') {
				itemsAdded = await this.scanRssFeed(source);
			} else if (source.type === 'api') {
				itemsAdded = await this.scanApi(source);
			}
			
			// Update last scanned time
			await db.update(sources)
				.set({ lastScannedAt: new Date() })
				.where(eq(sources.id, sourceId));
				
			console.log(`Added ${itemsAdded} new items from ${source.name}`);
		} catch (error) {
			console.error(`Error scanning source ${source.name}:`, error);
		}
		
		return itemsAdded;
	}
	
	/**
	 * Scan an RSS/Atom feed.
	 * Fetches all existing URLs for this source in a single query before the loop
	 * to avoid N+1 duplicate-check round-trips.
	 */
	private async scanRssFeed(source: typeof sources.$inferSelect): Promise<number> {
		const feed = await parser.parseURL(source.url);
		const feedItems = (feed.items || []).filter((item) => item.title && item.link) as Array<typeof feed.items[number] & { title: string; link: string }>;

		if (feedItems.length === 0) return 0;

		// Batch-fetch all URLs already stored for this source in a single query
		const existingUrls = new Set(
			(await db.select({ url: rawItems.url })
				.from(rawItems)
				.where(eq(rawItems.sourceId, source.id)))
				.map((r) => r.url)
		);

		let itemsAdded = 0;
		for (const item of feedItems) {
			if (existingUrls.has(item.link)) continue;

			// Add new item
			const newItem: NewRawItem = {
				id: nanoid(),
				sourceId: source.id,
				externalId: item.guid || item.link,
				title: item.title,
				url: item.link,
				content: item.contentSnippet || item.content || '',
				publishedAt: item.pubDate ? new Date(item.pubDate) : null,
				status: 'pending'
			};

			await db.insert(rawItems).values(newItem);
			// Keep the set current so within-feed duplicates are also caught
			existingUrls.add(item.link);
			itemsAdded++;
		}

		return itemsAdded;
	}
	
	/**
	 * Scan Hacker News API (top stories)
	 */
	private async scanApi(source: typeof sources.$inferSelect): Promise<number> {
		if (source.url.includes('hacker-news') || source.url.includes('ycombinator')) {
			return this.scanHackerNews(source);
		}
		
		console.log(`Unknown API type for source: ${source.name}`);
		return 0;
	}
	
	/**
	 * Scan Hacker News top stories.
	 * Fetches all story details in parallel (capped at 30) and batch-checks for
	 * duplicates in a single query to avoid N+1 DB round-trips and serial HTTP calls.
	 */
	private async scanHackerNews(source: typeof sources.$inferSelect): Promise<number> {
		const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
		if (!topStoriesRes.ok) {
			throw new Error(`HN top stories API error: ${topStoriesRes.status} ${topStoriesRes.statusText}`);
		}
		const storyIds: number[] = await topStoriesRes.json();
		const top30 = storyIds.slice(0, 30);

		// Fetch all 30 story details in parallel
		const storyResults = await Promise.allSettled(
			top30.map(async (storyId) => {
				const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
				if (!res.ok) throw new Error(`HN story ${storyId} fetch error: ${res.status}`);
				const story = await res.json();
				return { storyId, story };
			})
		);

		// Collect valid stories (type=story, has URL)
		const validStories = storyResults
			.filter((r): r is PromiseFulfilledResult<{ storyId: number; story: Record<string, unknown> }> => r.status === 'fulfilled')
			.map((r) => r.value)
			.filter(({ story }) => story && story.type === 'story' && story.url);

		if (validStories.length === 0) return 0;

		// Batch-fetch already-stored external IDs for this source in a single query
		const candidateIds = validStories.map(({ storyId }) => String(storyId));
		const existingRows = await db.select({ externalId: rawItems.externalId })
			.from(rawItems)
			.where(
				and(
					eq(rawItems.sourceId, source.id),
					inArray(rawItems.externalId, candidateIds)
				)
			);
		const existingIds = new Set(existingRows.map((r) => r.externalId));

		let itemsAdded = 0;
		for (const { storyId, story } of validStories) {
			if (existingIds.has(String(storyId))) continue;

			const newItem: NewRawItem = {
				id: nanoid(),
				sourceId: source.id,
				externalId: String(storyId),
				title: String(story.title),
				url: String(story.url),
				content: typeof story.text === 'string' ? story.text : '',
				publishedAt: story.time ? new Date((story.time as number) * 1000) : null,
				status: 'pending'
			};

			await db.insert(rawItems).values(newItem);
			existingIds.add(String(storyId));
			itemsAdded++;
		}

		return itemsAdded;
	}
	
	/**
	 * Scan all enabled sources
	 */
	async scanAllSources(): Promise<void> {
		const enabledSources = await db.select()
			.from(sources)
			.where(eq(sources.enabled, true));
		
		console.log(`Scanning ${enabledSources.length} sources...`);
		
		for (const source of enabledSources) {
			await this.scanSource(source.id);
			// Small delay between sources to avoid rate limiting
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	}
	
	/**
	 * Process pending items through AI filter
	 */
	async filterPendingItems(limit: number = 10): Promise<{ processed: number; accepted: number; rejected: number }> {
		const currentSettings = await this.getSettings();
		
		const pendingItems = await db.select()
			.from(rawItems)
			.where(eq(rawItems.status, 'pending'))
			.orderBy(desc(rawItems.discoveredAt))
			.limit(limit);
		
		console.log(`Filtering ${pendingItems.length} pending items...`);
		
		let accepted = 0;
		let rejected = 0;
		
		for (const item of pendingItems) {
			try {
				const result = await aiService.filterForRelevance(
					{
						title: item.title,
						url: item.url,
						content: item.content || undefined
					},
					currentSettings?.filterPrompt
				);
				
				if (result.isRelevant && result.confidence >= 0.6) {
					await db.update(rawItems)
						.set({ 
							status: 'accepted',
							aiFilterReason: result.reason
						})
						.where(eq(rawItems.id, item.id));
					
					console.log(`✓ Accepted: ${item.title} (${result.confidence.toFixed(2)})`);
					accepted++;
				} else {
					await db.update(rawItems)
						.set({ 
							status: 'rejected',
							aiFilterReason: result.reason
						})
						.where(eq(rawItems.id, item.id));
					
					console.log(`✗ Rejected: ${item.title} - ${result.reason}`);
					rejected++;
				}
				
				// Rate limiting for API calls
				await new Promise(resolve => setTimeout(resolve, 2000));
			} catch (error) {
				console.error(`Error filtering item ${item.id}:`, error);
			}
		}
		
		return { processed: pendingItems.length, accepted, rejected };
	}
	
	/**
	 * Normalize a title for deduplication comparison (lowercase, remove punctuation/spaces).
	 */
	private normalizeTitle(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '')
			.slice(0, 60);
	}

	/**
	 * Check if an innovation with the same title or source URL already exists.
	 * All checks use indexed SQL queries — no rows are loaded into application memory.
	 *
	 * Checks performed (in order, short-circuits on first match):
	 * 1. Slug prefix LIKE match — catches title duplicates without a full-text scan.
	 * 2. Direct URL fields (githubUrl, documentationUrl).
	 * 3. innovationSources table — the normalized source URL index replaces the old
	 *    500-row in-memory researchData JSON scan.
	 */
	private async innovationExists(title: string, url: string): Promise<boolean> {
		// 1. Check by slug prefix (normalized title)
		const slugPrefix = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
			.slice(0, 20);

		if (slugPrefix.length >= 5) {
			const slugMatches = await db
				.select({ id: innovations.id })
				.from(innovations)
				.where(like(innovations.slug, `${slugPrefix}%`))
				.limit(1);
			if (slugMatches.length > 0) return true;
		}

		// 2. Check by direct URL fields (githubUrl, documentationUrl)
		if (url) {
			const urlMatches = await db
				.select({ id: innovations.id })
				.from(innovations)
				.where(or(
					eq(innovations.githubUrl, url),
					eq(innovations.documentationUrl, url)
				))
				.limit(1);
			if (urlMatches.length > 0) return true;
		}

		// 3. Check in the innovationSources table (replaces the 500-row JSON blob scan)
		if (url) {
			const sourceMatches = await db
				.select({ id: innovationSources.id })
				.from(innovationSources)
				.where(eq(innovationSources.url, url))
				.limit(1);
			if (sourceMatches.length > 0) return true;
		}

		return false;
	}

	/**
	 * Research accepted items and create innovations
	 */
	async researchAcceptedItems(limit: number = 5, autoPublish: boolean = false): Promise<{ researched: number; created: number }> {
		const currentSettings = await this.getSettings();
		const autoPublishThreshold = currentSettings?.autoPublishThreshold ?? 7.0;
		
		const acceptedItems = await db.select()
			.from(rawItems)
			.where(eq(rawItems.status, 'accepted'))
			.orderBy(desc(rawItems.discoveredAt))
			.limit(limit);
		
		console.log(`Researching ${acceptedItems.length} accepted items...`);
		
		if (acceptedItems.length === 0) {
			console.log('No accepted items to research. Run filtering first to find relevant items.');
			return { researched: 0, created: 0 };
		}
		
		let created = 0;
		
		for (const item of acceptedItems) {
			try {
				// Check if innovation already exists (by title or URL)
				const alreadyExists = await this.innovationExists(item.title, item.url);
				if (alreadyExists) {
					console.log(`⊘ Innovation already exists for: ${item.title} (${item.url})`);
					// Mark as processed (not rejected — it was valid, just duplicate)
					await db.update(rawItems)
						.set({ status: 'processed', aiFilterReason: 'Already researched' })
						.where(eq(rawItems.id, item.id));
					continue;
				}
				
				console.log(`⚙ Researching: ${item.title}...`);
				
				const research = await aiService.researchInnovation(
					{
						title: item.title,
						url: item.url,
						content: item.content || undefined
					},
					currentSettings?.researchPrompt
				);
				
				// Calculate average score
				const avgScore = (research.relevanceScore + research.innovationScore + research.actionabilityScore) / 3;
				
				// Determine status based on auto-publish settings
				let status: 'pending' | 'published' = 'pending';
				if (autoPublish && avgScore >= autoPublishThreshold) {
					status = 'published';
				}
				
				// Create the innovation
				const id = nanoid();
				const slug = generateSlug(research.title, id);
				
				await db.insert(innovations).values({
					id,
					slug,
					title: research.title,
					tagline: research.tagline,
					category: research.category,
					researchData: JSON.stringify(research.researchData),
					relevanceScore: research.relevanceScore,
					innovationScore: research.innovationScore,
					actionabilityScore: research.actionabilityScore,
					isOpenSource: research.isOpenSource,
					isSelfHosted: research.isSelfHosted,
					hasAiComponent: research.hasAiComponent,
					maturityLevel: research.maturityLevel,
					license: research.license,
					githubUrl: research.githubUrl,
					documentationUrl: research.documentationUrl,
					status,
					researchedAt: new Date(),
					publishedAt: status === 'published' ? new Date() : null
				});
				
				// Mark raw item as processed
				await db.update(rawItems)
					.set({ status: 'processed', aiFilterReason: `Researched and ${status}` })
					.where(eq(rawItems.id, item.id));
				
				console.log(`✓ Created innovation: ${research.title} (avg score: ${avgScore.toFixed(1)}, status: ${status})`);
				created++;
				
				// Rate limiting for API calls
				await new Promise(resolve => setTimeout(resolve, 5000));
			} catch (error) {
				console.error(`Error researching item ${item.id}:`, error);
				// Mark as 'failed' (not 'rejected') — item was accepted by the filter but research
				// encountered a transient error (API timeout, rate limit, etc.). A future retry
				// can re-attempt by resetting status to 'accepted'.
				await db.update(rawItems)
					.set({ status: 'failed', aiFilterReason: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}` })
					.where(eq(rawItems.id, item.id));
			}
		}
		
		return { researched: acceptedItems.length, created };
	}
	
	/**
	 * Autonomous discovery mode - AI discovers and researches innovations directly
	 */
	async runAutonomousDiscovery(count: number = 3): Promise<{ discovered: number; created: number }> {
		const currentSettings = await this.getSettings();
		const autoPublishThreshold = currentSettings?.autoPublishThreshold ?? 7.0;
		
		console.log(`Running autonomous discovery for ${count} innovations...`);
		
		// Discover new innovations via AI
		const discoveries = await aiService.discoverInnovations(
			currentSettings?.filterPrompt,
			count
		);
		
		if (discoveries.length === 0) {
			console.log('No discoveries found.');
			return { discovered: 0, created: 0 };
		}
		
		console.log(`Discovered ${discoveries.length} potential innovations`);
		
		let created = 0;
		
		for (const discovery of discoveries) {
			try {
				// Check if we already have this innovation (by title or URL)
				const alreadyExists = await this.innovationExists(discovery.title, discovery.url);
				if (alreadyExists) {
					console.log(`⊘ Already exists: ${discovery.title}`);
					continue;
				}

				// Also check raw items to avoid duplicates in the queue
				if (discovery.url) {
					const existingRaw = await db.select()
						.from(rawItems)
						.where(eq(rawItems.url, discovery.url))
						.limit(1);

					if (existingRaw.length > 0) {
						console.log(`⊘ Already in raw items: ${discovery.title}`);
						continue;
					}
				}
				
				console.log(`⚙ Researching: ${discovery.title}...`);
				
				const research = await aiService.researchInnovation(
					{
						title: discovery.title,
						url: discovery.url,
						content: discovery.description,
						suggestedCategory: discovery.suggestedCategory
					},
					currentSettings?.researchPrompt
				);
				
				// Calculate average score
				const avgScore = (research.relevanceScore + research.innovationScore + research.actionabilityScore) / 3;
				
				// In auto mode, only publish if score meets threshold
				const status: 'pending' | 'published' = avgScore >= autoPublishThreshold ? 'published' : 'pending';
				
				// Create the innovation
				const id = nanoid();
				const slug = generateSlug(research.title, id);

				await db.insert(innovations).values({
					id,
					slug,
					title: research.title,
					tagline: research.tagline,
					category: research.category,
					researchData: JSON.stringify(research.researchData),
					relevanceScore: research.relevanceScore,
					innovationScore: research.innovationScore,
					actionabilityScore: research.actionabilityScore,
					isOpenSource: research.isOpenSource,
					isSelfHosted: research.isSelfHosted,
					hasAiComponent: research.hasAiComponent,
					maturityLevel: research.maturityLevel,
					license: research.license,
					githubUrl: research.githubUrl,
					documentationUrl: research.documentationUrl,
					status,
					researchedAt: new Date(),
					publishedAt: status === 'published' ? new Date() : null
				});
				
				console.log(`✓ Created: ${research.title} (avg score: ${avgScore.toFixed(1)}, status: ${status})`);
				created++;
				
				// Rate limiting
				await new Promise(resolve => setTimeout(resolve, 5000));
			} catch (error) {
				console.error(`Error researching discovery ${discovery.title}:`, error);
			}
		}
		
		return { discovered: discoveries.length, created };
	}
	
	/**
	 * Full auto-mode pipeline: scan, filter, research, and optionally auto-publish
	 */
	async runAutoMode(): Promise<{
		scanned: boolean;
		filtered: { processed: number; accepted: number; rejected: number };
		researched: { researched: number; created: number };
		autonomous: { discovered: number; created: number };
	}> {
		const currentSettings = await this.ensureSettings();
		
		if (!currentSettings.autoModeEnabled) {
			console.log('Auto mode is disabled');
			return {
				scanned: false,
				filtered: { processed: 0, accepted: 0, rejected: 0 },
				researched: { researched: 0, created: 0 },
				autonomous: { discovered: 0, created: 0 }
			};
		}
		
		const innovationsPerRun = currentSettings.autoInnovationsPerRun ?? 3;
		
		console.log('=== AUTO MODE START ===');
		
		// Step 1: Scan sources
		console.log('\n[1/4] Scanning sources...');
		await this.scanAllSources();
		
		// Step 2: Filter pending items
		console.log('\n[2/4] Filtering pending items...');
		const filtered = await this.filterPendingItems(20);
		
		// Step 3: Research accepted items with auto-publish
		console.log('\n[3/4] Researching accepted items...');
		const researched = await this.researchAcceptedItems(innovationsPerRun, true);
		
		// Step 4: If we didn't create enough innovations, use autonomous discovery
		let autonomous = { discovered: 0, created: 0 };
		if (researched.created < innovationsPerRun) {
			const remaining = innovationsPerRun - researched.created;
			console.log(`\n[4/4] Running autonomous discovery for ${remaining} more innovations...`);
			autonomous = await this.runAutonomousDiscovery(remaining);
		} else {
			console.log('\n[4/4] Skipping autonomous discovery - target reached');
		}
		
		console.log('\n=== AUTO MODE COMPLETE ===');
		console.log(`Filtered: ${filtered.accepted} accepted, ${filtered.rejected} rejected`);
		console.log(`Created: ${researched.created + autonomous.created} innovations`);
		
		return {
			scanned: true,
			filtered,
			researched,
			autonomous
		};
	}
	
	/**
	 * Archive innovations that have received no votes in the specified number of days
	 */
	async archiveInactiveInnovations(): Promise<number> {
		const s = await this.getSettings();
		const days = s?.archiveNoVotesDays ?? 14;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);
		
		const cutoffTimestamp = cutoffDate.getTime();
		
		const publishedInnovations = await db
			.select({
				id: innovations.id,
				voteCount: sql<number>`COUNT(${votes.id})`.as('vote_count')
			})
			.from(innovations)
			.leftJoin(votes, eq(votes.innovationId, innovations.id))
			.where(eq(innovations.status, 'published'))
			.groupBy(innovations.id)
			.having(sql`COUNT(${votes.id}) = 0`);
		
		let archived = 0;
		for (const inn of publishedInnovations) {
			const [innovation] = await db
				.select()
				.from(innovations)
				.where(eq(innovations.id, inn.id));
			
			if (innovation && innovation.publishedAt && innovation.publishedAt.getTime() < cutoffTimestamp) {
				await db.update(innovations)
					.set({ status: 'archived' })
					.where(eq(innovations.id, inn.id));
				archived++;
			}
		}
		
		console.log(`[Archive] Archived ${archived} inactive innovations`);
		return archived;
	}
	
	/**
	 * Remove old feed items (raw_items) older than specified days
	 */
	async cleanupOldFeedItems(): Promise<number> {
		const s = await this.getSettings();
		const days = s?.cleanupOlderThanDays ?? 7;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);
		
		const result = await db
			.delete(rawItems)
			.where(
				and(
					eq(rawItems.status, 'processed'),
					lt(rawItems.discoveredAt, cutoffDate)
				)
			);
		
		console.log(`[Cleanup] Removed old feed items`);
		return result.changes;
	}
}

export const scannerService = new ScannerService();
