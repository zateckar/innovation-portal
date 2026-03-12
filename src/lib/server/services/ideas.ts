import { db } from '$lib/server/db';
import { ideas, ideaVotes, settings } from '$lib/server/db/schema';
import { eq, and, desc, asc, like, or, sql, inArray, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { aiService } from './ai';
import { jiraService } from './jira';
import type {
	IdeaSummary,
	IdeaDetail,
	IdeaResearchData,
	IdeaEvaluationDetails,
	DepartmentCategory
} from '$lib/types';

const DEFAULT_DEPARTMENTS: DepartmentCategory[] = [
	'rd', 'production', 'hr', 'legal', 'finance',
	'it', 'purchasing', 'quality', 'logistics', 'general'
];

function generateSlug(title: string, id: string): string {
	return (
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
			.slice(0, 50) +
		'-' +
		id.slice(0, 6)
	);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeParseJSON<T>(value: string | null | undefined): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

export class IdeasService {
	/**
	 * Generate a batch of ideas for a department using AI
	 */
	async generateIdeaBatch(
		department: string,
		count: number,
		customPrompt?: string | null
	): Promise<{ batchId: string; count: number }> {
		const batchId = nanoid();

		console.log(`[Ideas] Generating ${count} ideas for department "${department}" (batch: ${batchId})`);

		try {
			const generatedIdeas = await aiService.generateIdeas(department, count, customPrompt);

			for (const idea of generatedIdeas) {
				const id = nanoid();
				const slug = generateSlug(idea.title, id);

				await db.insert(ideas).values({
					id,
					slug,
					title: idea.title,
					summary: idea.summary,
					problem: idea.problem,
					solution: idea.solution,
					department: department as DepartmentCategory,
					status: 'draft',
					batchId,
					aiPromptUsed: customPrompt || null
				});

				// Rate limiting between inserts (minimal since no AI call here)
				await delay(100);
			}

			console.log(`[Ideas] Generated ${generatedIdeas.length} ideas in batch ${batchId}`);
			return { batchId, count: generatedIdeas.length };
		} catch (error) {
			console.error(`[Ideas] Error generating idea batch for "${department}":`, error);
			throw error;
		}
	}

	/**
	 * Evaluate all ideas in a batch using AI, score and rank them
	 */
	async evaluateBatch(batchId: string): Promise<{
		evaluated: number;
		results: Array<{ id: string; title: string; score: number; rank: number }>;
	}> {
		console.log(`[Ideas] Evaluating batch ${batchId}`);

		const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));
		const evaluationPrompt = s?.evaluationPrompt ?? null;

		const batchIdeas = await db
			.select()
			.from(ideas)
			.where(eq(ideas.batchId, batchId));

		if (batchIdeas.length === 0) {
			console.log(`[Ideas] No ideas found in batch ${batchId}`);
			return { evaluated: 0, results: [] };
		}

		const evaluationResults: Array<{ id: string; title: string; score: number }> = [];

		for (const idea of batchIdeas) {
			try {
				console.log(`[Ideas] Evaluating: ${idea.title}`);

				const evaluation = await aiService.evaluateIdea({
					title: idea.title,
					summary: idea.summary,
					problem: idea.problem,
					solution: idea.solution,
					department: idea.department
				}, evaluationPrompt);

				const details = evaluation.evaluationDetails;
				const avgScore =
					(details.impact +
						details.feasibility +
						details.costEffectiveness +
						details.innovation +
						details.urgency) /
					5;

				await db
					.update(ideas)
					.set({
						evaluationScore: Math.round(avgScore * 100) / 100,
						evaluationDetails: JSON.stringify(evaluation.evaluationDetails),
						researchData: JSON.stringify(evaluation.researchData),
						status: 'evaluated',
						updatedAt: new Date()
					})
					.where(eq(ideas.id, idea.id));

				evaluationResults.push({
					id: idea.id,
					title: idea.title,
					score: avgScore
				});

				// Rate limiting between AI calls (3-5 seconds)
				await delay(3000 + Math.random() * 2000);
			} catch (error) {
				console.error(`[Ideas] Error evaluating idea "${idea.title}":`, error);
			}
		}

		// Rank ideas within the batch (1 = highest score)
		evaluationResults.sort((a, b) => b.score - a.score);

		const rankedResults: Array<{ id: string; title: string; score: number; rank: number }> = [];

		for (let i = 0; i < evaluationResults.length; i++) {
			const rank = i + 1;
			const result = evaluationResults[i];

			await db
				.update(ideas)
				.set({ rank })
				.where(eq(ideas.id, result.id));

			rankedResults.push({ ...result, rank });
		}

		console.log(`[Ideas] Evaluated ${rankedResults.length} ideas in batch ${batchId}`);
		return { evaluated: rankedResults.length, results: rankedResults };
	}

	/**
	 * Realize the top-ranked idea in a batch using AI
	 */
	async realizeTopIdea(batchId: string): Promise<{
		id: string;
		title: string;
		slug: string;
	} | null> {
		console.log(`[Ideas] Realizing top idea in batch ${batchId}`);

		const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));
		const realizationPrompt = s?.realizationPrompt ?? null;

		const [topIdea] = await db
			.select()
			.from(ideas)
			.where(and(eq(ideas.batchId, batchId), eq(ideas.rank, 1)))
			.limit(1);

		if (!topIdea) {
			console.log(`[Ideas] No rank-1 idea found in batch ${batchId}`);
			return null;
		}

		try {
			console.log(`[Ideas] Realizing: ${topIdea.title}`);

			const realization = await aiService.realizeIdea({
				title: topIdea.title,
				summary: topIdea.summary,
				problem: topIdea.problem,
				solution: topIdea.solution,
				department: topIdea.department
			}, realizationPrompt);

		await db
			.update(ideas)
			.set({
				realizationHtml: realization.realizationHtml,
				realizationDiagram: realization.realizationDiagram,
				realizationNotes: realization.realizationNotes,
				realizationCode: realization.realizationCode,
				status: 'realized',
				updatedAt: new Date()
			})
			.where(eq(ideas.id, topIdea.id));

		console.log(`[Ideas] Realized: ${topIdea.title}`);
			return {
				id: topIdea.id,
				title: topIdea.title,
				slug: topIdea.slug
			};
		} catch (error) {
			console.error(`[Ideas] Error realizing idea "${topIdea.title}":`, error);
			throw error;
		}
	}

	/**
	 * Run the full ideas pipeline: generate -> evaluate -> realize for each department
	 */
	async runFullPipeline(departments?: string[]): Promise<{
		departments: string[];
		batches: Array<{
			department: string;
			batchId: string;
			generatedCount: number;
			evaluatedCount: number;
			realizedIdea: { id: string; title: string; slug: string } | null;
		}>;
		totalGenerated: number;
		totalEvaluated: number;
		totalRealized: number;
	}> {
		console.log('[Ideas] Running full pipeline...');

		// Get settings
		const [currentSettings] = await db
			.select()
			.from(settings)
			.where(eq(settings.id, 'default'));

		const configuredDepartments: string[] = departments ||
			safeParseJSON<string[]>(currentSettings?.ideasDepartments) ||
			DEFAULT_DEPARTMENTS;

		const ideasPerBatch = currentSettings?.ideasPerBatch ?? 5;
		const autoRealize = currentSettings?.ideasAutoRealize ?? true;
		const customPrompt = currentSettings?.ideasPrompt || null;

		const batches: Array<{
			department: string;
			batchId: string;
			generatedCount: number;
			evaluatedCount: number;
			realizedIdea: { id: string; title: string; slug: string } | null;
		}> = [];

		let totalGenerated = 0;
		let totalEvaluated = 0;
		let totalRealized = 0;

		for (const department of configuredDepartments) {
			try {
				console.log(`\n[Ideas] Processing department: ${department}`);

				// Step 1: Generate ideas
				const { batchId, count: generatedCount } = await this.generateIdeaBatch(
					department,
					ideasPerBatch,
					customPrompt
				);
				totalGenerated += generatedCount;

				// Rate limiting between pipeline stages
				await delay(3000);

				// Step 2: Evaluate the batch
				const { evaluated: evaluatedCount } = await this.evaluateBatch(batchId);
				totalEvaluated += evaluatedCount;

				// Step 3: Optionally realize the top idea
				let realizedIdea: { id: string; title: string; slug: string } | null = null;
				if (autoRealize && evaluatedCount > 0) {
					await delay(3000);
					realizedIdea = await this.realizeTopIdea(batchId);
					if (realizedIdea) {
						totalRealized++;
					}
				}

				// Publish the realized idea (or top evaluated idea if not realizing)
				if (realizedIdea) {
					await db
						.update(ideas)
						.set({ status: 'published', updatedAt: new Date() })
						.where(eq(ideas.id, realizedIdea.id));
				} else if (evaluatedCount > 0) {
					// Publish the top-ranked evaluated idea
					const [topIdea] = await db
						.select()
						.from(ideas)
						.where(and(eq(ideas.batchId, batchId), eq(ideas.rank, 1)))
						.limit(1);

					if (topIdea) {
						await db
							.update(ideas)
							.set({ status: 'published', updatedAt: new Date() })
							.where(eq(ideas.id, topIdea.id));
					}
				}

				batches.push({
					department,
					batchId,
					generatedCount,
					evaluatedCount,
					realizedIdea
				});

				// Delay between departments
				await delay(5000);
			} catch (error) {
				console.error(`[Ideas] Error processing department "${department}":`, error);
				batches.push({
					department,
					batchId: '',
					generatedCount: 0,
					evaluatedCount: 0,
					realizedIdea: null
				});
			}
		}

		// Update last run timestamp
		await db
			.update(settings)
			.set({ ideasLastRunAt: new Date() })
			.where(eq(settings.id, 'default'));

		console.log(
			`\n[Ideas] Pipeline complete: ${totalGenerated} generated, ${totalEvaluated} evaluated, ${totalRealized} realized`
		);

		return {
			departments: configuredDepartments,
			batches,
			totalGenerated,
			totalEvaluated,
			totalRealized
		};
	}

	/**
	 * Get published ideas with filtering, sorting, and vote counts
	 */
	async getPublishedIdeas(
		filters: {
			department?: string;
			search?: string;
			sort?: string;
			limit?: number;
			offset?: number;
		},
		userId?: string
	): Promise<{ ideas: IdeaSummary[]; total: number }> {
		const limit = filters.limit ?? 20;
		const offset = filters.offset ?? 0;

		// Build WHERE conditions
		const conditions = [
			inArray(ideas.status, ['evaluated', 'realized', 'published'])
		];

		if (filters.department) {
			conditions.push(eq(ideas.department, filters.department as DepartmentCategory));
		}

		if (filters.search) {
			const searchTerm = `%${filters.search}%`;
			conditions.push(
				or(
					like(ideas.title, searchTerm),
					like(ideas.summary, searchTerm)
				)!
			);
		}

		const whereClause = and(...conditions);

		// Get total count
		const [{ total }] = await db
			.select({ total: sql<number>`count(*)` })
			.from(ideas)
			.where(whereClause);

		// Build query with vote counts
		const rows = await db
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
				createdAt: ideas.createdAt,
				source: ideas.source,
				jiraIssueKey: ideas.jiraIssueKey,
				jiraIssueUrl: ideas.jiraIssueUrl,
				proposedByEmail: ideas.proposedByEmail,
				voteCount: sql<number>`count(${ideaVotes.id})`.as('vote_count')
			})
			.from(ideas)
			.leftJoin(ideaVotes, eq(ideaVotes.ideaId, ideas.id))
			.where(whereClause)
			.groupBy(ideas.id)
			.orderBy(
				filters.sort === 'votes'
					? desc(sql`vote_count`)
					: filters.sort === 'score'
						? desc(ideas.evaluationScore)
						: filters.sort === 'oldest'
							? asc(ideas.createdAt)
							: desc(ideas.createdAt)
			)
			.limit(limit)
			.offset(offset);

		// If userId provided, check which ideas the user has voted on
		let userVotedIdeaIds: Set<string> = new Set();
		if (userId && rows.length > 0) {
			const ideaIds = rows.map((r) => r.id);
			const userVotes = await db
				.select({ ideaId: ideaVotes.ideaId })
				.from(ideaVotes)
				.where(
					and(
						eq(ideaVotes.userId, userId),
						inArray(ideaVotes.ideaId, ideaIds)
					)
				);
			userVotedIdeaIds = new Set(userVotes.map((v) => v.ideaId));
		}

		const ideaSummaries: IdeaSummary[] = rows.map((row) => ({
			id: row.id,
			slug: row.slug,
			title: row.title,
			summary: row.summary,
			department: row.department as DepartmentCategory,
			evaluationScore: row.evaluationScore,
			status: row.status as IdeaSummary['status'],
			rank: row.rank,
			batchId: row.batchId,
			voteCount: Number(row.voteCount) || 0,
			hasVoted: userVotedIdeaIds.has(row.id),
			createdAt: row.createdAt,
			source: (row.source ?? 'ai') as 'ai' | 'jira' | 'user',
			jiraIssueKey: row.jiraIssueKey,
			jiraIssueUrl: row.jiraIssueUrl,
			proposedByEmail: row.proposedByEmail
		}));

		return { ideas: ideaSummaries, total: Number(total) };
	}

	/**
	 * Get a single idea by slug with full details
	 */
	async getIdeaBySlug(slug: string, userId?: string): Promise<IdeaDetail | null> {
		const rows = await db
			.select({
				id: ideas.id,
				slug: ideas.slug,
				title: ideas.title,
				summary: ideas.summary,
				problem: ideas.problem,
				solution: ideas.solution,
				department: ideas.department,
				evaluationScore: ideas.evaluationScore,
				evaluationDetails: ideas.evaluationDetails,
				researchData: ideas.researchData,
			realizationHtml: ideas.realizationHtml,
			realizationDiagram: ideas.realizationDiagram,
			realizationNotes: ideas.realizationNotes,
			realizationCode: ideas.realizationCode,
			status: ideas.status,
				rank: ideas.rank,
				batchId: ideas.batchId,
				createdAt: ideas.createdAt,
				source: ideas.source,
				jiraIssueKey: ideas.jiraIssueKey,
				jiraIssueUrl: ideas.jiraIssueUrl,
				proposedByEmail: ideas.proposedByEmail,
				voteCount: sql<number>`count(${ideaVotes.id})`.as('vote_count')
			})
			.from(ideas)
			.leftJoin(ideaVotes, eq(ideaVotes.ideaId, ideas.id))
			.where(eq(ideas.slug, slug))
			.groupBy(ideas.id)
			.limit(1);

		if (rows.length === 0) {
			return null;
		}

		const row = rows[0];

		// Check if user has voted
		let hasVoted = false;
		if (userId) {
			const [userVote] = await db
				.select()
				.from(ideaVotes)
				.where(
					and(
						eq(ideaVotes.userId, userId),
						eq(ideaVotes.ideaId, row.id)
					)
				)
				.limit(1);
			hasVoted = !!userVote;
		}

		return {
			id: row.id,
			slug: row.slug,
			title: row.title,
			summary: row.summary,
			department: row.department as DepartmentCategory,
			evaluationScore: row.evaluationScore,
			status: row.status as IdeaDetail['status'],
			rank: row.rank,
			batchId: row.batchId,
			voteCount: Number(row.voteCount) || 0,
			hasVoted,
			createdAt: row.createdAt,
			problem: row.problem,
			solution: row.solution,
			researchData: safeParseJSON<IdeaResearchData>(row.researchData),
			evaluationDetails: safeParseJSON<IdeaEvaluationDetails>(row.evaluationDetails),
		realizationHtml: row.realizationHtml,
		realizationDiagram: row.realizationDiagram,
		realizationNotes: row.realizationNotes,
		realizationCode: row.realizationCode ?? null,
		source: (row.source ?? 'ai') as 'ai' | 'jira' | 'user',
			jiraIssueKey: row.jiraIssueKey,
			jiraIssueUrl: row.jiraIssueUrl,
			proposedByEmail: row.proposedByEmail
		};
	}

	/**
	 * Get all ideas (admin) with filtering, vote counts, and pagination
	 */
	async getAllIdeas(filters: {
		department?: string;
		status?: string;
		batchId?: string;
		source?: string;
		limit?: number;
		offset?: number;
	}): Promise<{ ideas: IdeaSummary[]; total: number }> {
		const limit = filters.limit ?? 100;
		const offset = filters.offset ?? 0;

		const conditions = [];

		if (filters.department) {
			conditions.push(eq(ideas.department, filters.department as DepartmentCategory));
		}

		if (filters.status) {
			conditions.push(eq(ideas.status, filters.status as 'draft' | 'evaluated' | 'realized' | 'published' | 'archived'));
		}

		if (filters.batchId) {
			conditions.push(eq(ideas.batchId, filters.batchId));
		}

		if (filters.source === 'ai') {
			conditions.push(eq(ideas.source, 'ai'));
		} else if (filters.source === 'jira') {
			conditions.push(eq(ideas.source, 'jira'));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get total count
		const [{ total }] = await db
			.select({ total: sql<number>`count(*)` })
			.from(ideas)
			.where(whereClause);

		const rows = await db
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
				createdAt: ideas.createdAt,
				source: ideas.source,
				jiraIssueKey: ideas.jiraIssueKey,
				jiraIssueUrl: ideas.jiraIssueUrl,
				proposedByEmail: ideas.proposedByEmail,
				voteCount: sql<number>`count(${ideaVotes.id})`.as('vote_count')
			})
			.from(ideas)
			.leftJoin(ideaVotes, eq(ideaVotes.ideaId, ideas.id))
			.where(whereClause)
			.groupBy(ideas.id)
			.orderBy(desc(ideas.createdAt))
			.limit(limit)
			.offset(offset);

		return {
			ideas: rows.map((row) => ({
				id: row.id,
				slug: row.slug,
				title: row.title,
				summary: row.summary,
				department: row.department as DepartmentCategory,
				evaluationScore: row.evaluationScore,
				status: row.status as IdeaSummary['status'],
				rank: row.rank,
				batchId: row.batchId,
				voteCount: Number(row.voteCount) || 0,
				hasVoted: false,
				createdAt: row.createdAt,
				source: (row.source ?? 'ai') as 'ai' | 'jira' | 'user',
				jiraIssueKey: row.jiraIssueKey,
				jiraIssueUrl: row.jiraIssueUrl,
				proposedByEmail: row.proposedByEmail
			})),
			total: Number(total)
		};
	}

	// ─── Jira Integration ─────────────────────────────────────────────────────

	/**
	 * Check whether the Jira interval has elapsed since the last run
	 */
	async shouldRunJira(): Promise<boolean> {
		const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));
		if (!s?.jiraEnabled) return false;
		if (!s.jiraLastRunAt) return true;

		const minutesSinceLast = (Date.now() - s.jiraLastRunAt.getTime()) / (1000 * 60);
		return minutesSinceLast >= (s.jiraIntervalMinutes ?? 1440);
	}

	/**
	 * Realize ALL ideas in a batch (used for Jira ideas — none can be discarded)
	 */
	async realizeAllInBatch(batchId: string): Promise<number> {
		console.log(`[Ideas] Realizing all ideas in batch ${batchId}`);

		const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));
		const realizationPrompt = s?.realizationPrompt ?? null;

		const batchIdeas = await db
			.select()
			.from(ideas)
			.where(and(eq(ideas.batchId, batchId), eq(ideas.status, 'evaluated')));

		let realized = 0;

		for (const idea of batchIdeas) {
			try {
				console.log(`[Ideas] Realizing: ${idea.title}`);

				const realization = await aiService.realizeIdea({
					title: idea.title,
					summary: idea.summary,
					problem: idea.problem,
					solution: idea.solution,
					department: idea.department
				}, realizationPrompt);

			await db
				.update(ideas)
				.set({
					realizationHtml: realization.realizationHtml,
					realizationDiagram: realization.realizationDiagram,
					realizationNotes: realization.realizationNotes,
					realizationCode: realization.realizationCode,
					status: 'realized',
					updatedAt: new Date()
				})
				.where(eq(ideas.id, idea.id));

			realized++;
			await delay(3000 + Math.random() * 2000);
			} catch (error) {
				console.error(`[Ideas] Error realizing idea "${idea.title}":`, error);
			}
		}

		console.log(`[Ideas] Realized ${realized} ideas in batch ${batchId}`);
		return realized;
	}

	/**
	 * User proposal pipeline:
	 * insert idea → evaluate → realize → publish (same as Jira ideas)
	 */
	async proposeUserIdea(params: {
		title: string;
		summary: string;
		problem: string;
		solution: string;
		department: DepartmentCategory;
		proposedBy: string;
		proposedByEmail: string;
	}): Promise<{ slug: string }> {
		const id = nanoid();
		const batchId = nanoid();
		const slug = generateSlug(params.title, id);

		console.log(`[Ideas] User proposal: "${params.title}" by ${params.proposedByEmail}`);

		// Step 1: Insert as draft
		await db.insert(ideas).values({
			id,
			slug,
			title: params.title,
			summary: params.summary,
			problem: params.problem,
			solution: params.solution,
			department: params.department,
			status: 'draft',
			batchId,
			source: 'user',
			proposedBy: params.proposedBy,
			proposedByEmail: params.proposedByEmail
		});

		// Step 2: Evaluate
		try {
			await this.evaluateBatch(batchId);
		} catch (error) {
			console.error('[Ideas] Evaluation failed for user proposal, continuing:', error);
		}

		// Step 3: Realize
		try {
			await this.realizeAllInBatch(batchId);
		} catch (error) {
			console.error('[Ideas] Realization failed for user proposal, continuing:', error);
		}

		// Step 4: Publish (regardless of evaluation/realization outcome)
		await db
			.update(ideas)
			.set({ status: 'published', updatedAt: new Date() })
			.where(eq(ideas.id, id));

		console.log(`[Ideas] User proposal published: ${slug}`);
		return { slug };
	}

	/**
	 * Full Jira import pipeline:
	 * fetch issues → extract ideas → evaluate → realize all → publish all
	 */
	async importFromJira(): Promise<{
		imported: number;
		evaluated: number;
		realized: number;
		published: number;
		batchId: string | null;
	}> {
		const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));

		if (!s?.jiraEnabled) {
			console.log('[Jira] Jira integration is disabled, skipping');
			return { imported: 0, evaluated: 0, realized: 0, published: 0, batchId: null };
		}

		if (!s.jiraUrl || !s.jiraJql) {
			console.log('[Jira] Jira URL or JQL not configured, skipping');
			return { imported: 0, evaluated: 0, realized: 0, published: 0, batchId: null };
		}

		const credentials = {
			jiraUrl: s.jiraUrl,
			jiraApimSubscriptionKey: s.jiraApimSubscriptionKey,
			jiraMtlsCert: s.jiraMtlsCert,
			jiraMtlsKey: s.jiraMtlsKey
		};

		// Get already-imported keys for deduplication
		const importedKeys = await jiraService.getAlreadyImportedKeys();

		// Fetch issues from Jira
		let issues;
		try {
			issues = await jiraService.fetchIssues(credentials, s.jiraJql, s.jiraMaxIssuesPerRun ?? 20);
		} catch (error) {
			console.error('[Jira] Failed to fetch issues:', error);
			return { imported: 0, evaluated: 0, realized: 0, published: 0, batchId: null };
		}

		// Filter out already-imported issues
		const newIssues = issues.filter((issue) => !importedKeys.has(issue.key));

		if (newIssues.length === 0) {
			console.log('[Jira] No new issues to import');
			// Update last run timestamp
			await db.update(settings).set({ jiraLastRunAt: new Date() }).where(eq(settings.id, 'default'));
			return { imported: 0, evaluated: 0, realized: 0, published: 0, batchId: null };
		}

		console.log(`[Jira] Processing ${newIssues.length} new issues`);

		const batchId = nanoid();
		let imported = 0;

		// Process each issue
		for (const issue of newIssues) {
			try {
				console.log(`[Jira] Processing issue ${issue.key}: ${issue.fields.summary}`);

				// Process attachments
				const { images, textContent } = await jiraService.processAttachments(
					issue.fields.attachment || [],
					credentials
				);

				// Extract idea via AI
				const extracted = await aiService.extractIdeaFromJiraIssue({
					summary: issue.fields.summary,
					description: issue.fields.description || '',
					attachmentTexts: textContent ? [textContent] : [],
					attachmentImages: images
				}, s.jiraExtractionPrompt ?? null);

				const id = nanoid();
				const slug = generateSlug(extracted.title, id);
				// Use jiraWebHostname for browse links if set; fall back to the API URL
				const jiraBaseForLinks = s.jiraWebHostname?.trim() || s.jiraUrl;
				const jiraIssueUrl = `${jiraBaseForLinks}/browse/${issue.key}`;

				await db.insert(ideas).values({
					id,
					slug,
					title: extracted.title,
					summary: extracted.summary,
					problem: extracted.problem,
					solution: extracted.solution,
					department: extracted.department,
					status: 'draft',
					batchId,
					source: 'jira',
					jiraIssueKey: issue.key,
					jiraIssueUrl
				});

				imported++;
				console.log(`[Jira] Imported ${issue.key} → ${extracted.title}`);

				// Rate limiting between AI calls
				await delay(2000);
			} catch (error) {
				console.error(`[Jira] Error processing issue ${issue.key}:`, error);
			}
		}

		if (imported === 0) {
			await db.update(settings).set({ jiraLastRunAt: new Date() }).where(eq(settings.id, 'default'));
			return { imported: 0, evaluated: 0, realized: 0, published: 0, batchId: null };
		}

		// Step 2: Evaluate all imported ideas
		console.log(`[Jira] Evaluating ${imported} imported ideas in batch ${batchId}`);
		const { evaluated } = await this.evaluateBatch(batchId);

		// Step 3: Realize ALL Jira ideas (none can be discarded)
		console.log(`[Jira] Realizing all evaluated ideas in batch ${batchId}`);
		const realized = await this.realizeAllInBatch(batchId);

		// Step 4: Publish all realized Jira ideas
		const updateResult = await db
			.update(ideas)
			.set({ status: 'published', updatedAt: new Date() })
			.where(and(eq(ideas.batchId, batchId), eq(ideas.status, 'realized')));

		// Also publish any evaluated-but-not-realized ones
		await db
			.update(ideas)
			.set({ status: 'published', updatedAt: new Date() })
			.where(and(eq(ideas.batchId, batchId), eq(ideas.status, 'evaluated')));

		// Also publish draft ones that might have failed evaluation
		await db
			.update(ideas)
			.set({ status: 'published', updatedAt: new Date() })
			.where(and(eq(ideas.batchId, batchId), eq(ideas.status, 'draft')));

		const published = imported; // All Jira ideas are published

		// Update last run timestamp
		await db.update(settings).set({ jiraLastRunAt: new Date() }).where(eq(settings.id, 'default'));

		console.log(`[Jira] Pipeline complete: ${imported} imported, ${evaluated} evaluated, ${realized} realized, ${published} published`);

		// Suppress unused variable warning
		void updateResult;

		return { imported, evaluated, realized, published, batchId };
	}

	/**
	 * Entry point for the scheduler — checks interval, then runs the full pipeline
	 */
	async runJiraPipeline(): Promise<{
		skipped?: boolean;
		reason?: string;
		imported?: number;
		evaluated?: number;
		realized?: number;
		published?: number;
	}> {
		const shouldRun = await this.shouldRunJira();
		if (!shouldRun) {
			return { skipped: true, reason: 'interval not elapsed or Jira disabled' };
		}

		console.log('[Jira] Starting Jira pipeline...');
		const result = await this.importFromJira();
		console.log('[Jira] Jira pipeline finished:', result);

		return result;
	}
}

export const ideasService = new IdeasService();
