import Parser from 'rss-parser';
import { db, sources, rawItems, innovations, settings, type NewRawItem } from '$lib/server/db';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { aiService } from './ai';
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
	 * Ensure default settings exist
	 */
	async ensureSettings(): Promise<Settings> {
		let [currentSettings] = await db.select().from(settings).where(eq(settings.id, 'default'));
		
		if (!currentSettings) {
			await db.insert(settings).values({
				id: 'default'
			});
			[currentSettings] = await db.select().from(settings).where(eq(settings.id, 'default'));
		}
		
		return currentSettings;
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
	 * Scan an RSS/Atom feed
	 */
	private async scanRssFeed(source: typeof sources.$inferSelect): Promise<number> {
		const feed = await parser.parseURL(source.url);
		let itemsAdded = 0;
		
		for (const item of feed.items || []) {
			if (!item.title || !item.link) continue;
			
			// Check if we already have this item
			const existing = await db.select()
				.from(rawItems)
				.where(
					and(
						eq(rawItems.sourceId, source.id),
						eq(rawItems.url, item.link)
					)
				)
				.limit(1);
			
			if (existing.length > 0) continue;
			
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
	 * Scan Hacker News top stories
	 */
	private async scanHackerNews(source: typeof sources.$inferSelect): Promise<number> {
		const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
		const storyIds: number[] = await topStoriesRes.json();
		
		let itemsAdded = 0;
		
		// Only process top 30 stories
		for (const storyId of storyIds.slice(0, 30)) {
			const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
			const story = await storyRes.json();
			
			if (!story || story.type !== 'story' || !story.url) continue;
			
			// Check if we already have this item
			const existing = await db.select()
				.from(rawItems)
				.where(
					and(
						eq(rawItems.sourceId, source.id),
						eq(rawItems.externalId, String(storyId))
					)
				)
				.limit(1);
			
			if (existing.length > 0) continue;
			
			// Add new item
			const newItem: NewRawItem = {
				id: nanoid(),
				sourceId: source.id,
				externalId: String(storyId),
				title: story.title,
				url: story.url,
				content: story.text || '',
				publishedAt: story.time ? new Date(story.time * 1000) : null,
				status: 'pending'
			};
			
			await db.insert(rawItems).values(newItem);
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
				// Check if innovation already exists for this URL
				const existingInnovations = await db.select()
					.from(innovations)
					.limit(100);
				
				const urlExists = existingInnovations.some(i => {
					try {
						const researchData = JSON.parse(i.researchData);
						return researchData.sources?.some((s: { url: string }) => s.url === item.url);
					} catch {
						return false;
					}
				});
				
				if (urlExists) {
					console.log(`⊘ Innovation already exists for: ${item.url}`);
					// Mark as processed (not rejected - it was valid, just duplicate)
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
				const slug = research.title
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/(^-|-$)/g, '')
					.slice(0, 50) + '-' + id.slice(0, 6);
				
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
				// Mark as failed so we don't keep retrying
				await db.update(rawItems)
					.set({ status: 'rejected', aiFilterReason: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}` })
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
				// Check if we already have this URL
				const existingInnovations = await db.select()
					.from(innovations)
					.limit(100);
				
				const urlExists = existingInnovations.some(i => {
					try {
						const researchData = JSON.parse(i.researchData);
						return researchData.sources?.some((s: { url: string }) => s.url === discovery.url);
					} catch {
						return false;
					}
				}) || existingInnovations.some(i => i.githubUrl === discovery.url || i.documentationUrl === discovery.url);
				
				if (urlExists) {
					console.log(`⊘ Already exists: ${discovery.title}`);
					continue;
				}
				
				// Also check raw items to avoid duplicates
				const existingRaw = await db.select()
					.from(rawItems)
					.where(eq(rawItems.url, discovery.url))
					.limit(1);
				
				if (existingRaw.length > 0) {
					console.log(`⊘ Already in raw items: ${discovery.title}`);
					continue;
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
				const slug = research.title
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/(^-|-$)/g, '')
					.slice(0, 50) + '-' + id.slice(0, 6);
				
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
}

export const scannerService = new ScannerService();
