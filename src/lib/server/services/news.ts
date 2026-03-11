import { db } from '$lib/server/db';
import { news, settings, innovations } from '$lib/server/db/schema';
import { eq, and, desc, like, or, lt, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { aiService } from './ai';
import type { Settings } from '$lib/server/db/schema';

const DEFAULT_DEPARTMENTS = [
	'rd',
	'production',
	'hr',
	'legal',
	'finance',
	'it',
	'purchasing',
	'quality',
	'logistics',
	'general'
] as const;

type Department = (typeof DEFAULT_DEPARTMENTS)[number];

interface NewsFilters {
	department?: string;
	search?: string;
	limit?: number;
	offset?: number;
}

interface AdminNewsFilters {
	department?: string;
	status?: string;
	limit?: number;
	offset?: number;
}

export class NewsService {
	/**
	 * Get current settings from database
	 */
	private async getSettings(): Promise<Settings | null> {
		const [currentSettings] = await db.select().from(settings).where(eq(settings.id, 'default'));
		return currentSettings || null;
	}

	/**
	 * Generate a URL-friendly slug from a title with a unique suffix
	 */
	private generateSlug(title: string): string {
		const base = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
			.slice(0, 80);
		return `${base}-${nanoid(8)}`;
	}

	/**
	 * Map innovation categories to the departments most likely to care about them.
	 * Used to pre-filter the innovations pool before passing to AI.
	 */
	private readonly CATEGORY_DEPARTMENT_AFFINITY: Record<string, string[]> = {
		'ai-ml':           ['rd', 'it', 'general', 'quality', 'production'],
		'devops':          ['it', 'rd', 'general'],
		'security':        ['it', 'legal', 'general', 'finance'],
		'data-analytics':  ['finance', 'it', 'general', 'rd', 'logistics', 'quality'],
		'developer-tools': ['it', 'rd', 'general'],
		'automation':      ['production', 'purchasing', 'hr', 'finance', 'logistics', 'general'],
		'collaboration':   ['hr', 'general', 'it', 'purchasing'],
		'infrastructure':  ['it', 'general', 'production']
	};

	/**
	 * Fetch published innovations from the DB and build the input payload for the AI.
	 * Extracts the primary source URL from researchData.sources (populated by the AI research pipeline).
	 */
	private async fetchPublishedInnovationsForDigest(): Promise<Array<{
		title: string;
		tagline: string;
		category: string;
		executiveSummary: string;
		keyBenefits: string[];
		sourceUrl: string;
		relevanceScore: number;
		innovationScore: number;
	}>> {
		// Get all published/promoted innovations
		const publishedInnovations = await db
			.select()
			.from(innovations)
			.where(inArray(innovations.status, ['published', 'promoted']))
			.orderBy(desc(innovations.publishedAt))
			.limit(200);

		if (publishedInnovations.length === 0) {
			return [];
		}

		return publishedInnovations.map((inn) => {
			let executiveSummary = '';
			let keyBenefits: string[] = [];
			let sourceUrl = '';
			try {
				const rd = JSON.parse(inn.researchData);
				executiveSummary = rd.executiveSummary || '';
				keyBenefits = Array.isArray(rd.keyBenefits) ? rd.keyBenefits : [];
				// researchData.sources is populated by aiService.researchInnovation with real URLs
				if (Array.isArray(rd.sources) && rd.sources.length > 0) {
					const originalSrc = rd.sources.find((s: { type?: string; url?: string }) => s.type === 'original' || !s.type);
					sourceUrl = originalSrc?.url || rd.sources[0]?.url || '';
				}
			} catch {
				// ignore parse errors
			}

			// Fall back to documentationUrl or githubUrl if researchData has no sources
			if (!sourceUrl) {
				sourceUrl = inn.documentationUrl || inn.githubUrl || '';
			}

			return {
				title: inn.title,
				tagline: inn.tagline,
				category: inn.category,
				executiveSummary,
				keyBenefits,
				sourceUrl,
				relevanceScore: inn.relevanceScore ?? 5,
				innovationScore: inn.innovationScore ?? 5
			};
		}).filter((inn) => inn.sourceUrl !== ''); // only include items with a verifiable source URL
	}

	/**
	 * Generate and publish news digests for the given departments.
	 * Fetches real, already-researched innovations from the DB and asks the AI to
	 * curate a digest from that material — no content is invented.
	 *
	 * @param departments - Optional list of department keys. Defaults to settings or all departments.
	 * @returns The number of news digests published.
	 */
	async generateAndPublishNews(departments?: string[]): Promise<number> {
		const currentSettings = await this.getSettings();

		// Determine which departments to generate news for
		let targetDepartments: string[] = departments || [];

		if (targetDepartments.length === 0 && currentSettings?.newsDepartments) {
			try {
				const parsed = JSON.parse(currentSettings.newsDepartments);
				if (Array.isArray(parsed) && parsed.length > 0) {
					targetDepartments = parsed;
				}
			} catch {
				// ignore parse errors
			}
		}

		if (targetDepartments.length === 0) {
			targetDepartments = [...DEFAULT_DEPARTMENTS];
		}

		const customPrompt = currentSettings?.newsPrompt || undefined;
		// How many digests to generate per department per run (default: 1)
		const newsPerDepartment = Math.max(1, currentSettings?.newsPerDepartment ?? 1);

		// Fetch the full pool of real innovations once
		console.log('[News] Fetching published innovations from the radar...');
		const allInnovations = await this.fetchPublishedInnovationsForDigest();
		console.log(`[News] Found ${allInnovations.length} published innovations to draw from.`);

		if (allInnovations.length === 0) {
			console.warn('[News] No published innovations found. Run the feed scanner and research pipeline first.');
			// Still update the lastRunAt so the scheduler doesn't keep retrying immediately
			await db.update(settings).set({ newsLastRunAt: new Date() }).where(eq(settings.id, 'default'));
			return 0;
		}

		let generatedCount = 0;

		console.log(`[News] Generating digests for ${targetDepartments.length} departments...`);

		for (const department of targetDepartments) {
			for (let runIdx = 0; runIdx < newsPerDepartment; runIdx++) {
				try {
					const runLabel = newsPerDepartment > 1 ? ` (${runIdx + 1}/${newsPerDepartment})` : '';
					console.log(`[News] Curating digest for department: ${department}${runLabel}`);

					// Pre-filter: prefer innovations with affinity to this department,
					// but always include the full pool so AI can make the final selection.
					const affinityCategories = this.CATEGORY_DEPARTMENT_AFFINITY;
					const preferredCategories = Object.entries(affinityCategories)
						.filter(([, depts]) => depts.includes(department))
						.map(([cat]) => cat);

					// Sort preferred categories first, then the rest; limit to 50 items to keep prompt size manageable
					const sortedInnovations = [
						...allInnovations.filter((inn) => preferredCategories.includes(inn.category)),
						...allInnovations.filter((inn) => !preferredCategories.includes(inn.category))
					].slice(0, 50);

					const result = await aiService.generateNews(department, sortedInnovations, customPrompt);

					// Skip digests where the AI found nothing relevant
					if (result.relevanceScore === 0 || result.sources.length === 0) {
						console.log(`[News] Skipped "${department}" — no relevant innovations found.`);
						break; // no point in generating more for this department
					}

					const id = nanoid();
					const slug = this.generateSlug(result.title);
					const now = new Date();

					await db.insert(news).values({
						id,
						title: result.title,
						slug,
						summary: result.summary,
						content: result.content,
						category: department as Department,
						sources: JSON.stringify(result.sources || []),
						relevanceScore: result.relevanceScore ?? null,
						aiPromptUsed: customPrompt || null,
						status: 'published',
						publishedAt: now,
						createdAt: now,
						updatedAt: now
					});

					generatedCount++;
					console.log(`[News] Published digest: "${result.title}" (${department}, ${result.sources.length} sources)`);

					// Rate limit between AI calls
					await new Promise((resolve) => setTimeout(resolve, 2000));
				} catch (error) {
					console.error(`[News] Error generating digest for ${department}:`, error);
					break; // skip remaining runs for this department on error
				}
			}
		}

		// Update newsLastRunAt in settings
		try {
			await db
				.update(settings)
				.set({ newsLastRunAt: new Date() })
				.where(eq(settings.id, 'default'));
		} catch (error) {
			console.error('[News] Error updating newsLastRunAt:', error);
		}

		console.log(`[News] Done. Published ${generatedCount}/${targetDepartments.length} digests.`);
		return generatedCount;
	}

	/**
	 * Get published news articles with optional filtering, search, and pagination.
	 */
	async getPublishedNews(filters: NewsFilters = {}): Promise<(typeof news.$inferSelect)[]> {
		const { department, search, limit = 50, offset = 0 } = filters;

		const conditions = [eq(news.status, 'published')];

		if (department) {
			conditions.push(eq(news.category, department as Department));
		}

		if (search) {
			const pattern = `%${search}%`;
			conditions.push(or(like(news.title, pattern), like(news.summary, pattern))!);
		}

		const results = await db
			.select()
			.from(news)
			.where(and(...conditions))
			.orderBy(desc(news.publishedAt))
			.limit(limit)
			.offset(offset);

		return results;
	}

	/**
	 * Get a single news article by its slug.
	 *
	 * @returns The news item, or null if not found.
	 */
	async getNewsBySlug(slug: string): Promise<typeof news.$inferSelect | null> {
		const [item] = await db.select().from(news).where(eq(news.slug, slug)).limit(1);
		return item || null;
	}

	/**
	 * Archive news articles older than the given number of days.
	 *
	 * @param days - Number of days after which published news should be archived.
	 * @returns The number of articles archived.
	 */
	async archiveOldNews(days: number): Promise<number> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - days);

		const oldItems = await db
			.select({ id: news.id })
			.from(news)
			.where(
				and(
					eq(news.status, 'published'),
					lt(news.publishedAt, cutoffDate)
				)
			);

		if (oldItems.length === 0) {
			console.log(`[News] No articles older than ${days} days to archive.`);
			return 0;
		}

		let archivedCount = 0;

		for (const item of oldItems) {
			try {
				await db
					.update(news)
					.set({ status: 'archived', updatedAt: new Date() })
					.where(eq(news.id, item.id));
				archivedCount++;
			} catch (error) {
				console.error(`[News] Error archiving news item ${item.id}:`, error);
			}
		}

		console.log(`[News] Archived ${archivedCount} articles older than ${days} days.`);
		return archivedCount;
	}

	/**
	 * Admin method: get all news articles regardless of status.
	 * Supports filtering by department, status, and pagination.
	 */
	async getAllNews(filters: AdminNewsFilters = {}): Promise<{ news: (typeof news.$inferSelect)[]; total: number }> {
		const { department, status, limit = 100, offset = 0 } = filters;

		const conditions = [];

		if (department) {
			conditions.push(eq(news.category, department as Department));
		}

		if (status) {
			conditions.push(eq(news.status, status as 'draft' | 'published' | 'archived'));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [{ total }] = await db
			.select({ total: sql<number>`count(*)` })
			.from(news)
			.where(whereClause);

		const results = whereClause
			? await db.select().from(news).where(whereClause).orderBy(desc(news.createdAt)).limit(limit).offset(offset)
			: await db.select().from(news).orderBy(desc(news.createdAt)).limit(limit).offset(offset);

		return { news: results, total: Number(total) };
	}
}

export const newsService = new NewsService();
