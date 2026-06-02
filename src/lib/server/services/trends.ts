import { db } from '$lib/server/db';
import { trends, settings } from '$lib/server/db/schema';
import { eq, and, desc, like, or, sql, inArray } from 'drizzle-orm';
import { aiService } from './ai';
import { TREND_CATEGORIES, DEPARTMENTS, type DepartmentCategory } from '$lib/types';
import type { Settings } from '$lib/server/db/schema';
import { getSettings } from './settingsCache';

interface TrendsFilters {
	categoryGroup?: string;
	department?: string;
	search?: string;
	limit?: number;
	offset?: number;
}

interface AdminTrendsFilters {
	categoryGroup?: string;
	department?: string;
	status?: string;
	limit?: number;
	offset?: number;
}

/**
 * Map a legacy trend `category` key to the canonical DEPARTMENTS enum.
 * Used by the additive backfill in hooks.server.ts to populate the new
 * `trends.department` column from existing rows.
 *
 *   dept-*         → the matching department (e.g. dept-rd → rd)
 *   dept-general-it→ 'it'  (the label "General IT" is still an IT trend)
 *   it-*           → 'it'  (IT focus areas all roll up to the IT department)
 *   automotive-*   → 'general'  (industry-wide, not a single department)
 *   anything else  → 'general'
 */
export const CATEGORY_TO_DEPARTMENT: Record<string, DepartmentCategory> = (() => {
	const map: Record<string, DepartmentCategory> = {};
	for (const [key, info] of Object.entries(TREND_CATEGORIES)) {
		if (key.startsWith('dept-')) {
			const slug = key.slice('dept-'.length);
			if (slug === 'general-it') {
				map[key] = 'it';
			} else if ((DEPARTMENTS as readonly string[]).includes(slug)) {
				map[key] = slug as DepartmentCategory;
			} else {
				map[key] = 'general';
			}
		} else if (key.startsWith('it-')) {
			map[key] = 'it';
		} else {
			map[key] = 'general';
		}
	}
	return map;
})();

export class TrendsService {
	private async getSettings(): Promise<Settings | null> {
		return await getSettings();
	}

	private generateSlug(title: string): string {
		const base = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
			.slice(0, 80);
		return `${base}-${crypto.randomUUID().slice(0, 8)}`;
	}

	/**
	 * Generate and publish trend analyses for all categories.
	 * @returns Number of trends published.
	 */
	async generateAndPublishTrends(categories?: string[]): Promise<number> {
		const currentSettings = await this.getSettings();
		const customPrompt = currentSettings?.trendsPrompt || undefined;
		const customCriteria = currentSettings?.trendsCriteria || undefined;

		const targetCategories = categories && categories.length > 0
			? categories
			: Object.keys(TREND_CATEGORIES);

		let generatedCount = 0;

		console.log(`[Trends] Generating trend analyses for ${targetCategories.length} categories...`);

		for (const category of targetCategories) {
			const catInfo = TREND_CATEGORIES[category];
			if (!catInfo) {
				console.warn(`[Trends] Unknown category: ${category}, skipping`);
				continue;
			}

			try {
				console.log(`[Trends] Researching trend: ${catInfo.label} (${category})`);

				const result = await aiService.generateTrend(
					category,
					catInfo.label,
					catInfo.group,
					customPrompt,
					customCriteria
				);

				const id = crypto.randomUUID();
				const slug = this.generateSlug(result.title);
				const now = new Date();

				// Prefer the department the LLM picked. Fall back to the legacy
				// category→department map so generation never produces a NULL row.
				const llmDept = (DEPARTMENTS as readonly string[]).includes(result.department ?? '')
					? (result.department as DepartmentCategory)
					: null;
				const department: DepartmentCategory = llmDept ?? CATEGORY_TO_DEPARTMENT[category] ?? 'general';

				// Archive previous trends for this category
				await db.update(trends)
					.set({ status: 'archived', updatedAt: now })
					.where(and(
						eq(trends.category, category),
						eq(trends.status, 'published')
					));

				await db.insert(trends).values({
					id,
					slug,
					category,
					categoryGroup: catInfo.group,
					department,
					title: result.title,
					summary: result.summary,
					content: result.content,
					keyInsights: JSON.stringify(result.keyInsights || []),
					maturityLevel: result.maturityLevel,
					impactScore: Math.min(1, Math.max(0, result.impactScore || 0.5)),
					timeHorizon: result.timeHorizon,
					visualData: JSON.stringify(result.visualData || {}),
					sources: JSON.stringify(result.sources || []),
					status: 'published',
					generatedAt: now,
					publishedAt: now,
					createdAt: now,
					updatedAt: now
				});

				generatedCount++;
				console.log(`[Trends] Published: "${result.title}" (${category}, dept=${department})`);

				// Rate limit between AI calls
				await new Promise((resolve) => setTimeout(resolve, 3000));
			} catch (error) {
				console.error(`[Trends] Error generating trend for ${category}:`, error);
			}
		}

		// Update trendsLastRunAt
		try {
			await db.update(settings)
				.set({ trendsLastRunAt: new Date() })
				.where(eq(settings.id, 'default'));
		} catch (error) {
			console.error('[Trends] Error updating trendsLastRunAt:', error);
		}

		console.log(`[Trends] Done. Published ${generatedCount}/${targetCategories.length} trend analyses.`);
		return generatedCount;
	}

	/**
	 * Get published trends with optional filtering
	 */
	async getPublishedTrends(filters: TrendsFilters = {}): Promise<(typeof trends.$inferSelect)[]> {
		const { categoryGroup, department, search, limit = 50, offset = 0 } = filters;
		const conditions = [eq(trends.status, 'published')];

		if (categoryGroup) {
			conditions.push(eq(trends.categoryGroup, categoryGroup as 'automotive' | 'department' | 'it'));
		}

		if (department) {
			conditions.push(eq(trends.department, department as DepartmentCategory));
		}

		if (search) {
			const pattern = `%${search}%`;
			conditions.push(or(like(trends.title, pattern), like(trends.summary, pattern))!);
		}

		return db
			.select()
			.from(trends)
			.where(and(...conditions))
			.orderBy(desc(trends.publishedAt))
			.limit(limit)
			.offset(offset);
	}

	/**
	 * Get the latest published trend for each category
	 */
	async getLatestTrendsByCategory(): Promise<(typeof trends.$inferSelect)[]> {
		return db
			.select()
			.from(trends)
			.where(eq(trends.status, 'published'))
			.orderBy(desc(trends.publishedAt));
	}

	async getTrendBySlug(slug: string): Promise<typeof trends.$inferSelect | null> {
		const [item] = await db.select().from(trends).where(eq(trends.slug, slug)).limit(1);
		return item || null;
	}

	/**
	 * Admin: get all trends regardless of status
	 */
	async getAllTrends(filters: AdminTrendsFilters = {}): Promise<{ trends: (typeof trends.$inferSelect)[]; total: number }> {
		const { categoryGroup, department, status, limit = 100, offset = 0 } = filters;
		const conditions = [];

		if (categoryGroup) {
			conditions.push(eq(trends.categoryGroup, categoryGroup as 'automotive' | 'department' | 'it'));
		}
		if (department) {
			conditions.push(eq(trends.department, department as DepartmentCategory));
		}
		if (status) {
			conditions.push(eq(trends.status, status as 'draft' | 'published' | 'archived'));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [{ total }] = await db
			.select({ total: sql<number>`count(*)` })
			.from(trends)
			.where(whereClause);

		const results = whereClause
			? await db.select().from(trends).where(whereClause).orderBy(desc(trends.createdAt)).limit(limit).offset(offset)
			: await db.select().from(trends).orderBy(desc(trends.createdAt)).limit(limit).offset(offset);

		return { trends: results, total: Number(total) };
	}
}

export const trendsService = new TrendsService();
