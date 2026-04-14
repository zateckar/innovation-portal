import { db } from '$lib/server/db';
import { ideas, ideaVotes, settings, ideaChats, users, specVersions } from '$lib/server/db/schema';
import { eq, and, desc, asc, like, or, sql, inArray, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { aiService } from './ai';
import { jiraService } from './jira';
import { adoService } from './ado';
import { DEPARTMENTS } from '$lib/types';
import type {
	IdeaSummary,
	IdeaDetail,
	IdeaResearchData,
	IdeaEvaluationDetails,
	IdeaChatMessage,
	IdeaSpecStatus,
	IdeaSpecReviewStatus,
	SpecVersion,
	DepartmentCategory
} from '$lib/types';

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
	async evaluateBatch(batchId: string, options?: { preserveStatus?: boolean }): Promise<{
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

				const updateData: Record<string, unknown> = {
					evaluationScore: Math.round(avgScore * 100) / 100,
					evaluationDetails: JSON.stringify(evaluation.evaluationDetails),
					researchData: JSON.stringify(evaluation.researchData),
					updatedAt: new Date()
				};
				if (!options?.preserveStatus) {
					updateData.status = 'evaluated';
				}

				await db
					.update(ideas)
					.set(updateData)
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
			DEPARTMENTS;

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
			eq(ideas.status, 'published')
		];

		if (filters.department) {
			conditions.push(eq(ideas.department, filters.department as DepartmentCategory));
		}

		if (filters.search) {
			const escapedSearch = filters.search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
			const searchTerm = `%${escapedSearch}%`;
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
				specStatus: ideas.specStatus,
				specReviewStatus: ideas.specReviewStatus,
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
			specStatus: (row.specStatus ?? 'not_started') as IdeaSpecStatus,
			specReviewStatus: (row.specReviewStatus ?? 'not_ready') as IdeaSpecReviewStatus,
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
			specStatus: ideas.specStatus,
			specReviewStatus: ideas.specReviewStatus,
			specDocument: ideas.specDocument,
			adoPrUrl: ideas.adoPrUrl,
			jiraEscalationKey: ideas.jiraEscalationKey,
			workspaceUuid: ideas.workspaceUuid,
			appRepoUrl: ideas.appRepoUrl,
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
		.where(and(eq(ideas.slug, slug), eq(ideas.status, 'published')))
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

		// Check if user has participated (sent ≥1 chat message)
		let hasParticipated = false;
		if (userId) {
			const [chat] = await db
				.select({ id: ideaChats.id })
				.from(ideaChats)
				.where(
					and(
						eq(ideaChats.ideaId, row.id),
						eq(ideaChats.userId, userId),
						eq(ideaChats.role, 'user')
					)
				)
				.limit(1);
			hasParticipated = !!chat;
		}

		// Load chat messages
		const chatMessages = await this.getChatMessages(row.id);

		return {
			id: row.id,
			slug: row.slug,
			title: row.title,
			summary: row.summary,
			department: row.department as DepartmentCategory,
			evaluationScore: row.evaluationScore,
			status: row.status as IdeaDetail['status'],
			specStatus: (row.specStatus ?? 'not_started') as IdeaSpecStatus,
			specReviewStatus: (row.specReviewStatus ?? 'not_ready') as IdeaSpecReviewStatus,
			specDocument: row.specDocument ?? null,
			adoPrUrl: row.adoPrUrl ?? null,
			jiraEscalationKey: row.jiraEscalationKey ?? null,
			workspaceUuid: row.workspaceUuid ?? null,
			appRepoUrl: row.appRepoUrl ?? null,
			rank: row.rank,
			batchId: row.batchId,
			voteCount: Number(row.voteCount) || 0,
			hasVoted,
			hasParticipated,
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
			proposedByEmail: row.proposedByEmail,
			chatMessages
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
				specStatus: ideas.specStatus,
				specReviewStatus: ideas.specReviewStatus,
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
				specStatus: (row.specStatus ?? 'not_started') as IdeaSpecStatus,
				specReviewStatus: (row.specReviewStatus ?? 'not_ready') as IdeaSpecReviewStatus,
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
	 * Realize ALL ideas in a batch (used for Jira ideas — none can be discarded).
	 * When `preserveStatus` is true, realization data is saved without changing
	 * the idea's current status (used by the fast user-proposal flow to keep
	 * the idea 'published' throughout background processing).
	 */
	async realizeAllInBatch(batchId: string, options?: { preserveStatus?: boolean }): Promise<number> {
		console.log(`[Ideas] Realizing all ideas in batch ${batchId}`);

		const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));
		const realizationPrompt = s?.realizationPrompt ?? null;

		// When preserveStatus is true the status was never changed to 'evaluated',
		// so we query by batchId only.
		const batchIdeas = options?.preserveStatus
			? await db.select().from(ideas).where(eq(ideas.batchId, batchId))
			: await db.select().from(ideas).where(and(eq(ideas.batchId, batchId), eq(ideas.status, 'evaluated')));

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

			const updateData: Record<string, unknown> = {
				realizationHtml: realization.realizationHtml,
				realizationDiagram: realization.realizationDiagram,
				realizationNotes: realization.realizationNotes,
				realizationCode: realization.realizationCode,
				updatedAt: new Date()
			};
			if (!options?.preserveStatus) {
				updateData.status = 'realized';
			}

			await db
				.update(ideas)
				.set(updateData)
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
	 * Fast user idea proposal: inserts and publishes immediately, then runs
	 * AI evaluation + realization in the background so the user doesn't wait.
	 */
	async proposeUserIdeaFast(params: {
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

		console.log(`[Ideas] User proposal (fast): "${params.title}" by ${params.proposedByEmail}`);

		// Insert and publish immediately — user sees the idea page right away
		await db.insert(ideas).values({
			id,
			slug,
			title: params.title,
			summary: params.summary,
			problem: params.problem,
			solution: params.solution,
			department: params.department,
			status: 'published',
			batchId,
			source: 'user',
			proposedBy: params.proposedBy,
			proposedByEmail: params.proposedByEmail
		});

		// Run AI evaluation + realization in background (fire-and-forget).
		// preserveStatus: true keeps the idea in 'published' status throughout,
		// so it remains visible in the public listing during processing.
		(async () => {
			try {
				await this.evaluateBatch(batchId, { preserveStatus: true });
			} catch (error) {
				console.error('[Ideas] Background evaluation failed:', error);
			}
			try {
				await this.realizeAllInBatch(batchId, { preserveStatus: true });
			} catch (error) {
				console.error('[Ideas] Background realization failed:', error);
			}
			console.log(`[Ideas] Background processing complete for: ${slug}`);
		})().catch((err) => console.error('[Ideas] Background processing error:', err));

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

	// ─── Development Stage ────────────────────────────────────────────────────

	/**
	 * Fetch all published ideas currently in the development phase.
	 * Returns two arrays partitioned by specStatus.
	 * Ideas the user voted on are sorted first (relevance), then by updatedAt DESC.
	 * Includes specDocument so cards can show the SpecProgressBar.
	 */
	async getIdeasInDevelopment(userId: string): Promise<{
		inProgress: IdeaSummary[];
		underReview: IdeaSummary[];
		building: IdeaSummary[];
		deployed: IdeaSummary[];
	}> {
		const rows = await db
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
				createdAt: ideas.createdAt,
				updatedAt: ideas.updatedAt,
				source: ideas.source,
				jiraIssueKey: ideas.jiraIssueKey,
				jiraIssueUrl: ideas.jiraIssueUrl,
				proposedByEmail: ideas.proposedByEmail,
				workspaceUuid: ideas.workspaceUuid,
				voteCount: sql<number>`count(${ideaVotes.id})`.as('vote_count')
			})
			.from(ideas)
			.leftJoin(ideaVotes, eq(ideaVotes.ideaId, ideas.id))
			.where(
				and(
					eq(ideas.status, 'published'),
					or(
						eq(ideas.specStatus, 'in_progress'),
						eq(ideas.specStatus, 'completed')
					)
				)
			)
			.groupBy(ideas.id)
			.orderBy(desc(ideas.updatedAt));

		if (rows.length === 0) {
			return { inProgress: [], underReview: [], building: [], deployed: [] };
		}

		const ideaIds = rows.map((r) => r.id);

		// Which of these ideas has the user voted on? (relevance signal)
		const userVotes = await db
			.select({ ideaId: ideaVotes.ideaId })
			.from(ideaVotes)
			.where(and(eq(ideaVotes.userId, userId), inArray(ideaVotes.ideaId, ideaIds)));
		const userVotedIds = new Set(userVotes.map((v) => v.ideaId));

		// Which has the user participated in (sent ≥1 chat message)?
		const userChats = await db
			.select({ ideaId: ideaChats.ideaId })
			.from(ideaChats)
			.where(
				and(
					eq(ideaChats.userId, userId),
					eq(ideaChats.role, 'user'),
					inArray(ideaChats.ideaId, ideaIds)
				)
			);
		const userParticipatedIds = new Set(userChats.map((c) => c.ideaId));

		const summaries: IdeaSummary[] = rows.map((row) => ({
			id: row.id,
			slug: row.slug,
			title: row.title,
			summary: row.summary,
			department: row.department as DepartmentCategory,
			evaluationScore: row.evaluationScore,
			status: row.status as IdeaSummary['status'],
			specStatus: (row.specStatus ?? 'not_started') as IdeaSpecStatus,
			specReviewStatus: (row.specReviewStatus ?? 'not_ready') as IdeaSpecReviewStatus,
			specDocument: row.specDocument ?? null,
			rank: row.rank,
			batchId: row.batchId,
			voteCount: Number(row.voteCount) || 0,
			hasVoted: userVotedIds.has(row.id),
			hasParticipated: userParticipatedIds.has(row.id),
			createdAt: row.createdAt,
			source: (row.source ?? 'ai') as 'ai' | 'jira' | 'user',
			jiraIssueKey: row.jiraIssueKey,
			jiraIssueUrl: row.jiraIssueUrl,
			proposedByEmail: row.proposedByEmail,
			workspaceUuid: row.workspaceUuid ?? null
		}));

		// Sort: voted-on ideas first, then by updatedAt (already ordered from DB)
		summaries.sort((a, b) => {
			const aVoted = userVotedIds.has(a.id) ? 1 : 0;
			const bVoted = userVotedIds.has(b.id) ? 1 : 0;
			return bVoted - aVoted;
		});

		// Determine build status from workspace metadata for ideas that have a workspace
		const buildStatuses = new Map<string, string>();
		for (const s of summaries) {
			if (s.workspaceUuid) {
				try {
					const metaPath = `workspaces/${s.workspaceUuid}/metadata.json`;
					const { existsSync, readFileSync } = await import('fs');
					if (existsSync(metaPath)) {
						const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
						buildStatuses.set(s.id, meta.status ?? '');
					}
				} catch {
					// Non-critical
				}
			}
		}

		const inProgress = summaries.filter((s) => s.specStatus === 'in_progress');
		const underReview = summaries.filter((s) => s.specStatus === 'completed' && !s.workspaceUuid);
		const building = summaries.filter((s) => {
			if (!s.workspaceUuid) return false;
			const st = buildStatuses.get(s.id) ?? '';
			return st !== 'deployed' && st !== '';
		});
		const deployed = summaries.filter((s) => {
			if (!s.workspaceUuid) return false;
			const st = buildStatuses.get(s.id) ?? '';
			return st === 'deployed';
		});

		return { inProgress, underReview, building, deployed };
	}

	/**
	 * Publish the spec to ADO + Jira. Only callable by a user who participated
	 * (sent ≥1 chat message) in this idea's development conversation.
	 */
	async approveAndPublishSpec(ideaId: string, userId: string): Promise<void> {
		const [idea] = await db
			.select({ specReviewStatus: ideas.specReviewStatus })
			.from(ideas)
			.where(eq(ideas.id, ideaId))
			.limit(1);

		if (!idea) throw new Error('Idea not found');
		if (idea.specReviewStatus !== 'under_review') {
			throw new Error('403: Spec is not under review');
		}

		const [participation] = await db
			.select({ id: ideaChats.id })
			.from(ideaChats)
			.where(
				and(
					eq(ideaChats.ideaId, ideaId),
					eq(ideaChats.userId, userId),
					eq(ideaChats.role, 'user')
				)
			)
			.limit(1);

		if (!participation) {
			throw new Error('403: User has not participated in this idea\'s development');
		}

		await this.publishSpec(ideaId);

		await db.update(ideas)
			.set({ specReviewStatus: 'published', updatedAt: new Date() })
			.where(eq(ideas.id, ideaId));
	}

	/** Admin-only: publish spec to ADO + Jira without participant check. */
	async forcePublishSpec(ideaId: string): Promise<void> {
		await this.publishSpec(ideaId);
		await db.update(ideas)
			.set({ specReviewStatus: 'published', updatedAt: new Date() })
			.where(eq(ideas.id, ideaId));
	}

	async getNextSpecVersionNumber(ideaId: string): Promise<number> {
		const [row] = await db
			.select({ max: sql<number>`max(${specVersions.versionNumber})` })
			.from(specVersions)
			.where(eq(specVersions.ideaId, ideaId));
		return (Number(row?.max) || 0) + 1;
	}

	/**
	 * List all spec versions for an idea, newest first.
	 */
	async getSpecVersions(ideaId: string): Promise<SpecVersion[]> {
		const rows = await db
			.select({
				id: specVersions.id,
				ideaId: specVersions.ideaId,
				versionNumber: specVersions.versionNumber,
				content: specVersions.content,
				authorId: specVersions.authorId,
				authorName: users.name,
				changeDescription: specVersions.changeDescription,
				createdAt: specVersions.createdAt
			})
			.from(specVersions)
			.leftJoin(users, eq(users.id, specVersions.authorId))
			.where(eq(specVersions.ideaId, ideaId))
			.orderBy(desc(specVersions.versionNumber));

		return rows.map((r) => ({
			id: r.id,
			ideaId: r.ideaId,
			versionNumber: r.versionNumber,
			content: r.content,
			authorId: r.authorId,
			authorName: r.authorName ?? 'Unknown',
			changeDescription: r.changeDescription,
			createdAt: r.createdAt
		}));
	}

	/**
	 * Roll back to a specific version. Snapshots the current spec first.
	 * Only callable by participants.
	 */
	async rollbackSpecToVersion(ideaId: string, userId: string, versionId: string): Promise<{ restoredSpec: string }> {
		const [participation] = await db
			.select({ id: ideaChats.id })
			.from(ideaChats)
			.where(and(eq(ideaChats.ideaId, ideaId), eq(ideaChats.userId, userId), eq(ideaChats.role, 'user')))
			.limit(1);
		if (!participation) throw new Error('403: Not a participant');

		const [version] = await db
			.select()
			.from(specVersions)
			.where(and(eq(specVersions.id, versionId), eq(specVersions.ideaId, ideaId)))
			.limit(1);
		if (!version) throw new Error('Version not found');

		// Snapshot current before rollback so nothing is lost
		const [current] = await db
			.select({ specDocument: ideas.specDocument })
			.from(ideas)
			.where(eq(ideas.id, ideaId))
			.limit(1);

		// Use transaction for all writes to ensure atomicity
		await db.transaction(async (tx) => {
			if (current?.specDocument) {
				const nextNum = await this.getNextSpecVersionNumber(ideaId);
				await tx.insert(specVersions).values({
					id: nanoid(),
					ideaId,
					versionNumber: nextNum,
					content: current.specDocument,
					authorId: userId,
					changeDescription: `Auto-snapshot before rollback to v${version.versionNumber}`,
					createdAt: new Date()
				});
			}

			await tx.update(ideas)
				.set({ specDocument: version.content, updatedAt: new Date() })
				.where(eq(ideas.id, ideaId));

			await tx.insert(ideaChats).values({
				id: nanoid(),
				ideaId,
				role: 'user',
				userId,
				content: `Rolled back specification to version ${version.versionNumber}.`
			});
		});

		return { restoredSpec: version.content };
	}

	/**
	 * AI-assisted edit of the spec document.
	 * Snapshots the current version before overwriting so history is preserved.
	 * Only callable by participants while specReviewStatus === 'under_review'.
	 */
	async requestSpecEdit(
		ideaId: string,
		userId: string,
		instruction: string,
		sectionName?: string
	): Promise<{ updatedSpec: string; versionId: string }> {
		const [idea] = await db
			.select({ specDocument: ideas.specDocument, specReviewStatus: ideas.specReviewStatus })
			.from(ideas)
			.where(eq(ideas.id, ideaId))
			.limit(1);

		if (!idea?.specDocument) throw new Error('No spec document found');

		const [participation] = await db
			.select({ id: ideaChats.id })
			.from(ideaChats)
			.where(
				and(
					eq(ideaChats.ideaId, ideaId),
					eq(ideaChats.userId, userId),
					eq(ideaChats.role, 'user')
				)
			)
			.limit(1);
		if (!participation) throw new Error('403: Not a participant');

		// Snapshot current version before overwriting
		const versionId = nanoid();
		const versionNumber = await this.getNextSpecVersionNumber(ideaId);
		await db.insert(specVersions).values({
			id: versionId,
			ideaId,
			versionNumber,
			content: idea.specDocument,
			authorId: userId,
			changeDescription: sectionName
				? `Edit to "${sectionName}": ${instruction.slice(0, 120)}`
				: `Edit: ${instruction.slice(0, 120)}`,
			createdAt: new Date()
		});

		const sectionContext = sectionName ? `Focus on the "${sectionName}" section. ` : '';
		const prompt = `You are editing a software specification document. ${sectionContext}The user has requested the following change:\n\n"${instruction}"\n\nReturn the COMPLETE updated specification document in Markdown format. Preserve all sections and structure. Only apply the requested change.\n\n---\n\nCurrent specification:\n\n${idea.specDocument}`;

		const updatedSpec = await aiService.generateText(prompt);

		const sectionLabel = sectionName ? ` to "${sectionName}"` : '';

		// Use transaction for all DB writes to ensure atomicity
		await db.transaction(async (tx) => {
			await tx.update(ideas)
				.set({ specDocument: updatedSpec, updatedAt: new Date() })
				.where(eq(ideas.id, ideaId));

			await tx.insert(ideaChats).values([
				{
					id: nanoid(),
					ideaId,
					role: 'user',
					userId,
					content: `Requested change${sectionLabel}: ${instruction}`
				},
				{
					id: nanoid(),
					ideaId,
					role: 'ai',
					userId: null,
					content: `I've updated the specification${sectionLabel} per your request. Previous version saved as v${versionNumber} in history.`
				}
			]);
		});

		return { updatedSpec, versionId };
	}

	/**
	 * Fetch all chat messages for an idea, ordered by creation time
	 */
	async getChatMessages(ideaId: string): Promise<IdeaChatMessage[]> {
		const rows = await db
			.select({
				id: ideaChats.id,
				ideaId: ideaChats.ideaId,
				role: ideaChats.role,
				userId: ideaChats.userId,
				userName: users.name,
				content: ideaChats.content,
				createdAt: ideaChats.createdAt
			})
			.from(ideaChats)
			.leftJoin(users, eq(ideaChats.userId, users.id))
			.where(eq(ideaChats.ideaId, ideaId))
			.orderBy(asc(ideaChats.createdAt));

		return rows.map((r) => ({
			id: r.id,
			ideaId: r.ideaId,
			role: r.role as 'ai' | 'user',
			userId: r.userId,
			userName: r.userName ?? null,
			content: r.content,
			createdAt: r.createdAt
		}));
	}

	/**
	 * Called after every successful vote. Checks vote count vs threshold and,
	 * if crossed for the first time, transitions the idea to 'in_progress' and
	 * seeds the AI opening message.
	 */
	async checkAndTriggerDevelopment(ideaId: string): Promise<void> {
		try {
			const [idea] = await db
				.select({
					id: ideas.id,
					title: ideas.title,
					summary: ideas.summary,
					problem: ideas.problem,
					solution: ideas.solution,
					department: ideas.department,
					specStatus: ideas.specStatus
				})
				.from(ideas)
				.where(eq(ideas.id, ideaId))
				.limit(1);

			if (!idea || idea.specStatus !== 'not_started') return;

			const [countRow] = await db
				.select({ count: sql<number>`count(*)` })
				.from(ideaVotes)
				.where(eq(ideaVotes.ideaId, ideaId));
			const voteCount = countRow?.count ?? 0;

			const [settingsRow] = await db
				.select({ threshold: settings.ideaVoteThreshold })
				.from(settings)
				.where(eq(settings.id, 'default'))
				.limit(1);
			const threshold = settingsRow?.threshold ?? 5;

			if (voteCount < threshold) return;

			await db.update(ideas)
				.set({ specStatus: 'in_progress', updatedAt: new Date() })
				.where(eq(ideas.id, ideaId));

		const openingMessage = `Hello! I'm your AI Specification Facilitator, and I'm here to guide the development of **"${idea.title}"** into a clear, business-focused specification.

**What is this conversation for?**
This idea has been selected by the community for development. My role is to work with you — the people who understand the business — to define exactly what this solution should do and who it should serve. You don't need any technical knowledge; I'll handle the technical decisions based on your business needs.

**How does this work?**
I'll ask you focused questions over the next 8–15 exchanges. Your answers will help me understand:
- Who will use this solution and what they need
- What the solution must do (and what it shouldn't do)
- How success looks like from a business perspective
- What processes or systems it connects to

Once I have enough detail, I'll automatically generate a complete specification document for your team to review and approve.

---

Let me start with the most important question: **Who are the primary users of this solution?** Think about their roles (e.g., sales manager, warehouse operator, HR coordinator), their day-to-day challenges, and what they're trying to accomplish. The more specific you can be, the better we can tailor the solution to their real needs.`;

		await db.insert(ideaChats).values({
			id: nanoid(),
			ideaId,
			role: 'ai',
			userId: null,
			content: openingMessage
		});

		console.log(`[Ideas] Idea "${idea.title}" entered development stage (${voteCount}/${threshold} votes).`);
		} catch (err) {
			console.error('[Ideas] checkAndTriggerDevelopment failed:', err);
		}
	}

	/**
	 * Generate the full spec document from the chat history and save it.
	 * Called internally after the AI signals readiness with [[SPEC_READY]].
	 */
	async generateSpecDocument(ideaId: string): Promise<void> {
		const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
		if (!idea) throw new Error(`Idea ${ideaId} not found`);

		const chatHistory = await this.getChatMessages(ideaId);

		const [settingsRow] = await db
			.select({ techStackRules: settings.techStackRules })
			.from(settings)
			.where(eq(settings.id, 'default'))
			.limit(1);

		const techRules = settingsRow?.techStackRules
			? `\n\n## Company Tech Stack & Rules\n${settingsRow.techStackRules}`
			: '';

		const chatTranscript = chatHistory
			.map((m) => `**${m.role === 'ai' ? 'AI' : (m.userName ?? 'User')}:** ${m.content}`)
			.join('\n\n');

		const prompt = `You are a senior business analyst translating a business refinement conversation into a specification document. The conversation was between an AI facilitator and business users (not IT staff). Your job is to synthesise everything they said into a complete, structured specification that:
- Business stakeholders can read and approve without confusion
- Developers can build from without needing to ask further questions

**GROUND RULES — read carefully before writing a single word:**

1. **Business language only.** The document will be reviewed by business users. Never use IT jargon: no "API", "endpoint", "schema", "middleware", "OAuth", "LDAP", "JWT", "microservice", "repository", "CI/CD", or similar. If a system integration was mentioned (e.g. "connect to ServiceNow"), describe the business outcome ("the system automatically creates a support ticket in ServiceNow") — not the technical mechanism.

2. **Capture every business decision.** Every constraint, metric, preference, scope limit, workflow step, and user need mentioned in the conversation MUST appear in the document. Do not omit or paraphrase loosely. If a number was given (e.g. "40% ticket deflection"), use the exact number.

3. **What users said about systems is context, not a technical requirement.** If a business user mentioned a tool (e.g. "we use ServiceNow", "we have Azure"), treat that as context about their environment — document the business need it serves, not its technical configuration.

4. **Numbered functional requirements.** Every capability must be numbered FR-001, FR-002… using MUST / SHOULD / MUST NOT so developers have unambiguous reference points. Write these in plain English: "The system MUST allow a user to reset their own password without contacting IT."

5. **Testable user stories.** Each major use case needs Given/When/Then acceptance scenarios written from the perspective of the business user — not a tester or developer.

6. **Explicit assumptions.** List anything implied but not confirmed in the conversation. This prevents scope creep.

7. **No technical architecture.** Do NOT include sections on technology choices, infrastructure, databases, APIs, or implementation approach. The tech stack will be appended separately after business sign-off.

---

## DOCUMENT STRUCTURE

You MUST use this EXACT section numbering and heading format. Do NOT change the heading text.
Use ## (h2) for section headings. Use ### (h3) for sub-sections within features/screens.

## 1. What is this application?
One paragraph in plain language: what problem does it solve, who will use it, why is it needed. Combine the executive summary and problem statement here.

## 2. Who will use it?
For each type of user, describe what they need to do in the application, their day-to-day environment, and any relevant constraints.
Format as: **{Role name}** — what they need to do in the application

## 3. What information does the application work with?
Describe the "things" the application manages, in everyday business terms. For each thing: what it is, what details it has, how it relates to other things.
Format as: **{Thing name}**: has [detail], [detail], [detail]…

## 4. What should the application do?
For EACH feature, create a sub-section with this exact structure:

### {Feature name}
- **What the user does:** {describe the action in plain language}
- **What should happen:** {describe the expected result}
- **What if something goes wrong:** {describe error scenarios}
- **How do we know it works:** {a simple test anyone can perform — e.g. "I can add a new request with just a title, and it appears in my list immediately"}

EVERY feature MUST have a "How do we know it works" entry. This is critical.

## 5. What screens does the application need?
For EACH screen, create a sub-section:

### {Screen name}
- **What is it for:** {purpose in one sentence}
- **What does it show:** {what information the user sees}
- **What can the user do here:** {buttons, forms, actions available}
- **Where can the user go from here:** {links to other screens}

## 6. Business rules and constraints
Explicit rules the system must enforce. Format as a bulleted list. Include scope limits, access restrictions, data constraints, language/regional constraints.

## 7. Any other requirements?
Include anything else that matters: mobile support, expected number of users, branding/style preferences (colors, look and feel), language support, assumptions, open questions, risks, and phased delivery plans if discussed.

---

## Idea Context
**Title:** ${idea.title}
**Department:** ${idea.department}
**Summary:** ${idea.summary}
**Problem:** ${idea.problem}
**Solution:** ${idea.solution}

---

## Refinement Conversation
${chatTranscript}

---

Now write the complete specification document. Start with a # heading for the title. Follow the structure above. Write ONLY the Markdown — no preamble, no commentary outside the document itself.`;

		const specMarkdown = await aiService.generateText(prompt);

		await db.update(ideas)
			.set({
				specDocument: specMarkdown,
				specStatus: 'completed',
				specReviewStatus: 'under_review',
				updatedAt: new Date()
			})
			.where(eq(ideas.id, ideaId));

		console.log(`[Ideas] Spec document generated for idea "${idea.title}".`);
	}

	/**
	 * Called immediately after generateSpecDocument. Creates ADO PR and Jira issue.
	 */
	/**
	 * Use AI to derive a minimal, suitable tech stack from the admin's guidelines
	 * and the business requirements in the spec. Returns a Markdown section to
	 * append to the document sent to DevOps. Returns empty string if no guidelines
	 * are configured.
	 */
	private async deriveTechStackSection(specDocument: string, techStackRules: string): Promise<string> {
		const prompt = `You are a senior software architect. Your job is to read a business specification and a set of approved technology guidelines, then produce a concise, specific technology recommendation for this particular project.

**Your reasoning process:**
1. Read the business specification carefully — understand the scale, data sensitivity, number of users, performance requirements, and operational complexity.
2. For each area in the guidelines where multiple options exist, pick the SIMPLEST option that genuinely meets the requirements. Do not over-engineer. A small internal tool does not need a distributed database. A simple CRUD app does not need a message queue.
3. Where the business requirements impose constraints (e.g. sensitive data → encryption at rest and in transit; 10,000 concurrent users → horizontally scalable service; offline factory floor → local-first approach), reflect those constraints in your choices and explain why.
4. Where guidelines list a single option with no alternatives, include it as-is.
5. Be explicit about your reasoning for each non-obvious choice.

**Output format — write ONLY this Markdown section, nothing else:**

## Technical Implementation

> *This section is generated for the development team based on the business requirements above and the company's approved technology guidelines. It is not part of the business specification reviewed by stakeholders.*

### Recommended Stack

For each technology area, write one or two sentences: what was chosen and the specific reason drawn from the business requirements.

Example format:
- **Database:** SQLite (single-file, sufficient for the ~50 internal users described; no clustering needed). Encryption at rest enabled — the specification notes that conversation transcripts contain PII.
- **Backend:** ...
- **Frontend:** ...

### Constraints & Non-Negotiables
Bullet list of technical constraints that follow directly from the business requirements (e.g. "All data must remain within the company Azure tenant — specified explicitly in the spec", "Must support 200 concurrent sessions — requires async processing").

### Open Technical Questions
Any areas where the guidelines offer options but the business requirements do not provide enough signal to decide definitively. Flag these so the team can resolve them before build starts.

---

## Business Specification (for context)

${specDocument}

---

## Company Technology Guidelines

${techStackRules}

---

Now write the Technical Implementation section. Be specific, be minimal, justify every choice that involves selecting between options.`;

		const section = await aiService.generateText(prompt);
		return `\n\n---\n\n${section.trim()}`;
	}

	async publishSpec(ideaId: string): Promise<void> {
		const [idea] = await db
			.select({ id: ideas.id, slug: ideas.slug, title: ideas.title, specDocument: ideas.specDocument })
			.from(ideas)
			.where(eq(ideas.id, ideaId))
			.limit(1);

		if (!idea?.specDocument) throw new Error(`No spec document found for idea ${ideaId}`);

		// Fetch tech stack guidelines. If configured, ask AI to derive a tailored
		// tech stack from the business requirements — rather than blindly appending them.
		// The result is only added to the document sent to DevOps; the specDocument
		// stored in the DB (shown to business reviewers) is never modified.
		const [settingsRow] = await db
			.select({ techStackRules: settings.techStackRules })
			.from(settings)
			.where(eq(settings.id, 'default'))
			.limit(1);

		let techStackSection = '';
		if (settingsRow?.techStackRules?.trim()) {
			try {
				techStackSection = await this.deriveTechStackSection(
					idea.specDocument,
					settingsRow.techStackRules.trim()
				);
				console.log(`[Ideas] Tech stack section derived for "${idea.title}".`);
			} catch (err) {
				console.error('[Ideas] Tech stack derivation failed (publishing without it):', err);
			}
		}

		// The document sent to DevOps includes the AI-derived tech stack section.
		// The specDocument stored in the DB (shown to business users) remains unchanged.
		const publishedDocument = idea.specDocument + techStackSection;

		let adoPrUrl: string | null = null;
		let jiraEscalationKey: string | null = null;

		// Create ADO PR
		try {
			const prResult = await adoService.createPullRequest(
				idea.slug,
				idea.title,
				publishedDocument
			);
			adoPrUrl = prResult.prUrl;
			console.log(`[Ideas] ADO PR created: ${adoPrUrl}`);
		} catch (err) {
			console.error('[Ideas] ADO PR creation failed (continuing without it):', err);
		}

		// Create Jira issue
		const jiraDescription = `Specification document has been generated for idea: **${idea.title}**.\n\n${adoPrUrl ? `Azure DevOps PR: ${adoPrUrl}` : 'No ADO PR (ADO not configured or failed).'}`;
		const jiraResult = await jiraService.createIssue(`[Idea Spec] ${idea.title}`, jiraDescription);
		if (jiraResult) {
			jiraEscalationKey = jiraResult.key;
			console.log(`[Ideas] Jira issue created: ${jiraResult.key}`);
		}

		await db.update(ideas)
			.set({ adoPrUrl, jiraEscalationKey, updatedAt: new Date() })
			.where(eq(ideas.id, ideaId));
	}

	/**
	 * Ensure an AI opening message exists for an idea in development.
	 * Called on page load to auto-recover from cases where the opening message
	 * was never stored (e.g., LLM was unavailable when the idea crossed the threshold).
	 */
	async ensureOpeningMessage(ideaId: string): Promise<boolean> {
		const existing = await this.getChatMessages(ideaId);
		const hasAiMessage = existing.some((m) => m.role === 'ai');
		if (hasAiMessage) return false; // already has an AI message

		const [idea] = await db
			.select({
				id: ideas.id,
				title: ideas.title,
				specStatus: ideas.specStatus
			})
			.from(ideas)
			.where(eq(ideas.id, ideaId))
			.limit(1);

		if (!idea || idea.specStatus !== 'in_progress') return false;

		const openingMessage = `Hello! I'm your AI Specification Facilitator, and I'm here to guide the development of **"${idea.title}"** into a clear, business-focused specification.

**What is this conversation for?**
This idea has been selected by the community for development. My role is to work with you — the people who understand the business — to define exactly what this solution should do and who it should serve. You don't need any technical knowledge; I'll handle the technical decisions based on your business needs.

**How does this work?**
I'll ask you focused questions over the next 8–15 exchanges. Your answers will help me understand:
- Who will use this solution and what they need
- What the solution must do (and what it shouldn't do)
- How success looks like from a business perspective
- What processes or systems it connects to

Once I have enough detail, I'll automatically generate a complete specification document for your team to review and approve.

---

Let me start with the most important question: **Who are the primary users of this solution?** Think about their roles (e.g., sales manager, warehouse operator, HR coordinator), their day-to-day challenges, and what they're trying to accomplish. The more specific you can be, the better we can tailor the solution to their real needs.`;

		await db.insert(ideaChats).values({
			id: nanoid(),
			ideaId,
			role: 'ai',
			userId: null,
			content: openingMessage
		});

		console.log(`[Ideas] Recovered missing opening message for idea "${idea.title}".`);
		return true;
	}

	/**
	 * Save a user's chat message, get an AI reply, and check for [[SPEC_READY]].
	 */
	async sendChatMessage(
		ideaId: string,
		userId: string,
		content: string
	): Promise<{ aiReply: string; specTriggered: boolean }> {
		// Save user message
		await db.insert(ideaChats).values({
			id: nanoid(),
			ideaId,
			role: 'user',
			userId,
			content
		});

		const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
		if (!idea) throw new Error(`Idea ${ideaId} not found`);

		const history = await this.getChatMessages(ideaId);

		const [settingsRow] = await db
			.select({ techStackRules: settings.techStackRules })
			.from(settings)
			.where(eq(settings.id, 'default'))
			.limit(1);

		const techRules = settingsRow?.techStackRules
			? `\n\nCompany tech stack & rules:\n${settingsRow.techStackRules}`
			: '';

		const chatTranscript = history
			.map((m) => `${m.role === 'ai' ? 'AI' : (m.userName ?? 'User')}: ${m.content}`)
			.join('\n\n');

		const systemPrompt = `You are an AI facilitator helping a team collaboratively refine an innovation idea into a detailed, actionable specification. Your job is to ask clarifying questions — one or two at a time — to gather the information needed for a complete spec-driven specification document.

Ask about: user roles and needs, workflows, edge cases, integrations, data requirements, non-functional requirements (performance, security, scale), and anything else needed for a complete implementation spec.

When you have gathered enough information to write a complete, detailed specification (typically after 8–15 exchanges), end your message with the sentinel token [[SPEC_READY]] on its own line. Do not include [[SPEC_READY]] until you genuinely have enough detail.

Keep your tone collaborative and encouraging. Acknowledge the users' contributions.${techRules}

## Idea Context
Title: ${idea.title}
Department: ${idea.department}
Summary: ${idea.summary}
Problem: ${idea.problem}
Solution: ${idea.solution}

## Conversation so far
${chatTranscript}`;

		const aiRawReply = await aiService.generateText(systemPrompt);

		const specTriggered = aiRawReply.includes('[[SPEC_READY]]');
		const aiReply = aiRawReply.replace('[[SPEC_READY]]', '').trim();

		await db.insert(ideaChats).values({
			id: nanoid(),
			ideaId,
			role: 'ai',
			userId: null,
			content: specTriggered
				? aiReply + '\n\n_I now have enough detail to generate the specification document. Generating now..._'
				: aiReply
		});

		// Trigger spec generation asynchronously if ready — publishing is now a manual step
		if (specTriggered && idea.specStatus === 'in_progress') {
			this.generateSpecDocument(ideaId)
				.catch((err) => console.error('[Ideas] Spec generation failed:', err));
		}

		return { aiReply, specTriggered };
	}
}

export const ideasService = new IdeasService();
