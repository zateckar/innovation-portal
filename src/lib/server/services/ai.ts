import { GoogleGenAI } from '@google/genai';
import type { Part } from '@google/genai';
import { env } from '$env/dynamic/private';
import { DEPARTMENTS } from '$lib/types';
import type { InnovationCategory, InnovationResearchData, DepartmentCategory, SpecMockup, DesignSystem } from '$lib/types';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { decryptSecret } from '$lib/server/crypto/secrets';
import { getSettings } from './settingsCache';

interface FilterResult {
	isRelevant: boolean;
	confidence: number;
	reason: string;
	suggestedCategory: InnovationCategory | null;
}

interface ResearchResult {
	title: string;
	tagline: string;
	category: InnovationCategory;
	department: DepartmentCategory;
	researchData: InnovationResearchData;
	relevanceScore: number;
	innovationScore: number;
	actionabilityScore: number;
	isOpenSource: boolean;
	isSelfHosted: boolean;
	hasAiComponent: boolean;
	maturityLevel: 'experimental' | 'beta' | 'stable' | 'mature';
	license: string | null;
	githubUrl: string | null;
	documentationUrl: string | null;
}

// Default prompts if none configured
const DEFAULT_FILTER_PROMPT = `You are an innovation scout for an automotive company modernizing their IT infrastructure (7000 office workers, 25000 assembly workers).

Evaluate if this article describes an actionable IT innovation suitable for this company.

PREFER (score higher):
- Open source / self-hosted solutions
- AI/ML-powered tools
- Developer productivity improvements
- Enterprise automation
- Data analytics / BI tools
- DevOps / Platform engineering
- Security improvements
- Tools that can scale for thousands of users

REJECT (low relevance):
- Consumer products
- Gaming/Entertainment
- Crypto/Web3 (unless enterprise blockchain)
- Pure research without practical application
- Vendor-locked cloud-only solutions
- Products requiring extremely specialized hardware`;

const DEFAULT_RESEARCH_PROMPT = `You are a technology analyst researching innovations for an automotive company modernizing their IT.`;

const DEFAULT_EVALUATION_PROMPT = `You are a technology evaluation expert for an automotive manufacturing company. Perform a deep evaluation of the following innovation idea.`;

const DEFAULT_REALIZATION_PROMPT = `You are an expert UI/UX designer and solution architect for an automotive manufacturing company. Your task is to create a realistic visualization of what an innovation idea would look like when fully realized.`;

const DEFAULT_JIRA_EXTRACTION_PROMPT = `You are an innovation analyst extracting a structured innovation idea from a Jira issue submitted by an employee.

Read all available content (title, description, and any attachment text/images) and extract the following:
1. A concise title (≤ 80 chars)
2. A one-paragraph summary
3. The specific problem this idea addresses
4. The proposed solution in detail
5. The most fitting department from this list: ${DEPARTMENTS.join(', ')}`;

class AIService {
	private genAI: GoogleGenAI | null = null;
	private cachedSettings: { llmApiKey: string | null; llmModel: string } | null = null;
	// TTL-based cache: settings are re-fetched after 60 seconds so key changes propagate
	// even without an explicit clearCache() call (e.g., in multi-worker deployments).
	private cachedAt = 0;
	private static readonly CACHE_TTL_MS = 60_000;

	private async getSettings(): Promise<{ llmApiKey: string | null; llmModel: string }> {
		if (this.cachedSettings && Date.now() - this.cachedAt < AIService.CACHE_TTL_MS) {
			return this.cachedSettings;
		}
		const settingsRow = await getSettings();
		this.cachedSettings = {
			llmApiKey: decryptSecret(settingsRow?.llmApiKey) || env.GEMINI_API_KEY || null,
			llmModel: settingsRow?.llmModel || env.GEMINI_MODEL || 'models/gemini-3-flash-preview'
		};
		this.cachedAt = Date.now();
		return this.cachedSettings;
	}

	public async clearCache(): Promise<void> {
		this.cachedSettings = null;
		this.cachedAt = 0;
		// Reset the client so it is re-created with the new API key on the next call.
		this.genAI = null;
	}

	/**
	 * Extract a JSON object or array from an AI response string.
	 *
	 * Strategy:
	 * 1. Find the FIRST '{' or '[' in the response — whichever the model
	 *    actually started its JSON value with — and bracket-count from there
	 *    to its matching close. This is important because the previous
	 *    implementation always preferred '{', which silently truncated a
	 *    top-level JSON array (e.g. the mockup screen list `[…]`) down to
	 *    its first object, breaking every extraction whose expected shape is
	 *    an array.
	 * 2. Fall back to stripping a markdown code fence if depth counting fails.
	 */
	private extractJson(response: string): string {
		const start = response.search(/[{[]/);
		if (start === -1) {
			// No JSON found — fall back to stripping code fences
			return this.stripCodeFence(response);
		}
		const startChar = response[start];
		const endChar = startChar === '{' ? '}' : ']';
		let depth = 0;
		let inString = false;
		let escape = false;
		for (let i = start; i < response.length; i++) {
			const ch = response[i];
			if (escape) { escape = false; continue; }
			if (ch === '\\' && inString) { escape = true; continue; }
			if (ch === '"') { inString = !inString; continue; }
			if (inString) continue;
			if (ch === startChar) depth++;
			else if (ch === endChar) {
				depth--;
				if (depth === 0) return response.slice(start, i + 1);
			}
		}
		// Bracket matching failed — fall back
		return this.stripCodeFence(response);
	}

	private stripCodeFence(response: string): string {
		// Greedy match on the outermost code fence pair
		const match = response.match(/```(?:json)?\s*([\s\S]+)```/);
		return match ? match[1].trim() : response.trim();
	}

	private async getClientAsync(): Promise<GoogleGenAI> {
		if (!this.genAI) {
			const cfg = await this.getSettings();
			const apiKey = cfg.llmApiKey;
			if (!apiKey) {
				throw new Error('LLM API Key is not configured. Please set it in Admin > Settings.');
			}
			this.genAI = new GoogleGenAI({ apiKey });
		}
		return this.genAI;
	}
	
	async filterForRelevance(
		item: { title: string; url: string; content?: string },
		customPrompt?: string | null
	): Promise<FilterResult> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		
		const filterContext = customPrompt || DEFAULT_FILTER_PROMPT;
		
		const prompt = `${filterContext}

Article:
Title: ${item.title}
URL: ${item.url}
${item.content ? `Content: ${item.content.slice(0, 2000)}` : ''}

Respond with valid JSON only, no markdown:
{
  "isRelevant": boolean,
  "confidence": number between 0.0 and 1.0,
  "reason": "brief explanation in 1-2 sentences",
  "suggestedCategory": one of ["ai-ml", "devops", "security", "data-analytics", "developer-tools", "automation", "collaboration", "infrastructure"] or null if not relevant
}`;

		try {
			const result = await client.models.generateContent({ model: cfg.llmModel, contents: prompt });
			const response = result.text ?? '';
			const parsed = JSON.parse(this.extractJson(response));
			return {
				isRelevant: Boolean(parsed.isRelevant),
				confidence: Number(parsed.confidence) || 0.5,
				reason: String(parsed.reason || ''),
				suggestedCategory: parsed.suggestedCategory as InnovationCategory | null
			};
		} catch (error) {
			console.error('AI filter error:', error);
			return {
				isRelevant: false,
				confidence: 0,
				reason: 'Failed to analyze',
				suggestedCategory: null
			};
		}
	}
	
	async researchInnovation(
		item: { 
			title: string; 
			url: string; 
			content?: string;
			suggestedCategory?: InnovationCategory;
		},
		customPrompt?: string | null
	): Promise<ResearchResult> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		
		const researchContext = customPrompt || DEFAULT_RESEARCH_PROMPT;
		
		const prompt = `${researchContext}

Research this innovation thoroughly and produce a structured report.

Innovation:
Title: ${item.title}
URL: ${item.url}
${item.suggestedCategory ? `Suggested Category: ${item.suggestedCategory}` : ''}
${item.content ? `Initial content:\n${item.content.slice(0, 4000)}` : ''}

Produce a JSON report with this exact structure (respond with valid JSON only, no markdown):
{
  "title": "Official/clean product name",
  "tagline": "One-liner description under 150 characters",
  "category": one of ["ai-ml", "devops", "security", "data-analytics", "developer-tools", "automation", "collaboration", "infrastructure"],
  "department": one of [${DEPARTMENTS.map(d => `"${d}"`).join(', ')}] (the primary department this innovation serves),
  "executiveSummary": "2-3 detailed paragraphs for executives explaining what this is and why it matters",
  "keyBenefits": ["benefit1", "benefit2", "benefit3", "benefit4", "benefit5"],
  "useCases": ["use case relevant to automotive/enterprise IT 1", "use case 2", "use case 3"],
  "competitors": [
    {"name": "Competitor 1", "url": "https://...", "comparison": "How it compares"},
    {"name": "Competitor 2", "url": "https://...", "comparison": "How it compares"}
  ],
  "prosAndCons": {
    "pros": ["pro1", "pro2", "pro3"],
    "cons": ["con1", "con2"]
  },
  "requiredSkills": ["skill1", "skill2", "skill3"],
  "estimatedTimeToMVP": "e.g., 1-2 weeks, 1 month",
  "sources": [
    {"url": "${item.url}", "title": "Original article", "type": "original"}
  ],
  "relevanceScore": number 1-10 (how relevant for automotive IT modernization),
  "innovationScore": number 1-10 (how innovative/novel is this),
  "actionabilityScore": number 1-10 (how easy to implement),
  "isOpenSource": boolean,
  "isSelfHosted": boolean (can be deployed on-premises),
  "hasAiComponent": boolean,
  "maturityLevel": one of ["experimental", "beta", "stable", "mature"],
  "license": "license name or null",
  "githubUrl": "GitHub URL or null",
  "documentationUrl": "documentation URL or null"
}`;

		try {
			const result = await client.models.generateContent({ model: cfg.llmModel, contents: prompt });
			const response = result.text ?? '';
			const parsed = JSON.parse(this.extractJson(response));
			
			return {
				title: String(parsed.title || item.title),
				tagline: String(parsed.tagline || '').slice(0, 150),
				category: parsed.category as InnovationCategory || item.suggestedCategory || 'developer-tools',
				department: (DEPARTMENTS as readonly string[]).includes(parsed.department)
					? (parsed.department as DepartmentCategory)
					: 'general',
				researchData: {
					executiveSummary: String(parsed.executiveSummary || ''),
					keyBenefits: Array.isArray(parsed.keyBenefits) ? parsed.keyBenefits.map(String) : [],
					useCases: Array.isArray(parsed.useCases) ? parsed.useCases.map(String) : [],
					competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
					prosAndCons: {
						pros: Array.isArray(parsed.prosAndCons?.pros) ? parsed.prosAndCons.pros.map(String) : [],
						cons: Array.isArray(parsed.prosAndCons?.cons) ? parsed.prosAndCons.cons.map(String) : []
					},
					requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.map(String) : [],
					estimatedTimeToMVP: String(parsed.estimatedTimeToMVP || 'Unknown'),
					sources: Array.isArray(parsed.sources) ? parsed.sources : [{ url: item.url, title: item.title, type: 'original' }]
				},
				relevanceScore: Math.min(10, Math.max(1, Number(parsed.relevanceScore) || 5)),
				innovationScore: Math.min(10, Math.max(1, Number(parsed.innovationScore) || 5)),
				actionabilityScore: Math.min(10, Math.max(1, Number(parsed.actionabilityScore) || 5)),
				isOpenSource: Boolean(parsed.isOpenSource),
				isSelfHosted: Boolean(parsed.isSelfHosted),
				hasAiComponent: Boolean(parsed.hasAiComponent),
				maturityLevel: ['experimental', 'beta', 'stable', 'mature'].includes(parsed.maturityLevel) 
					? parsed.maturityLevel 
					: 'beta',
				license: parsed.license || null,
				githubUrl: parsed.githubUrl || null,
				documentationUrl: parsed.documentationUrl || null
			};
		} catch (error) {
			console.error('AI research error:', error);
			throw new Error('Failed to research innovation');
		}
	}
	
	/**
	 * Autonomous AI research - discover and research innovations without user input
	 */
	async discoverInnovations(
		customPrompt?: string | null,
		count: number = 3
	): Promise<Array<{
		title: string;
		url: string;
		description: string;
		suggestedCategory: InnovationCategory;
	}>> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		
		const searchContext = customPrompt || DEFAULT_FILTER_PROMPT;
		
		const prompt = `${searchContext}

You are an autonomous innovation discovery agent. Your task is to suggest ${count} recent, cutting-edge technologies or tools that would be valuable based on the criteria above.

Think about:
- Recent GitHub trending projects
- New AI/ML tools and frameworks
- Emerging DevOps and platform engineering tools
- Security and observability solutions
- Developer productivity tools

For each suggestion, provide real, verifiable projects that exist. Do not make up fake projects.

Respond with valid JSON only, no markdown:
{
  "discoveries": [
    {
      "title": "Project/Tool Name",
      "url": "https://... (real URL to project homepage or GitHub)",
      "description": "Brief description of what this is and why it's innovative",
      "suggestedCategory": one of ["ai-ml", "devops", "security", "data-analytics", "developer-tools", "automation", "collaboration", "infrastructure"]
    }
  ]
}`;

		try {
			const result = await client.models.generateContent({ model: cfg.llmModel, contents: prompt });
			const response = result.text ?? '';
			const parsed = JSON.parse(this.extractJson(response));
			
			if (!Array.isArray(parsed.discoveries)) {
				return [];
			}
			
			return parsed.discoveries.slice(0, count).map((d: Record<string, unknown>) => ({
				title: String(d.title || ''),
				url: String(d.url || ''),
				description: String(d.description || ''),
				suggestedCategory: d.suggestedCategory as InnovationCategory || 'developer-tools'
			}));
		} catch (error) {
			console.error('AI discovery error:', error);
			return [];
		}
	}
	
	/**
	 * Curate a department news digest from real, already-researched innovations.
	 * The AI selects and summarises the most relevant items for the given department —
	 * it does NOT invent content; all facts come from the supplied innovations.
	 */
	async generateNews(
		department: string,
		innovations: Array<{
			title: string;
			tagline: string;
			category: string;
			executiveSummary: string;
			keyBenefits: string[];
			sourceUrl: string;
			relevanceScore: number;
			innovationScore: number;
		}>,
		customPrompt?: string | null
	): Promise<{
		title: string;
		summary: string;
		content: string;
		sources: { url: string; title?: string }[];
		relevanceScore: number;
	}> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();

		if (innovations.length === 0) {
			return {
				title: `${department} Innovation Digest`,
				summary: 'No new innovations available for this digest.',
				content: 'No published innovations were found to compile this digest. Run the feed scanner and research pipeline to populate new items.',
				sources: [],
				relevanceScore: 0
			};
		}

		const innovationsList = innovations
			.map((inn, i) =>
				`[${i + 1}] ${inn.title}
Category: ${inn.category}
Tagline: ${inn.tagline}
Relevance: ${inn.relevanceScore}/10 | Innovation: ${inn.innovationScore}/10
Summary: ${inn.executiveSummary.slice(0, 400)}
Key benefits: ${inn.keyBenefits.slice(0, 3).join('; ')}
Source URL: ${inn.sourceUrl}`
			)
			.join('\n\n');

		const departmentContext = customPrompt ||
			`You are a technology analyst compiling an innovation digest for the "${department}" department of an automotive manufacturing company undergoing digital transformation.`;

		const prompt = `${departmentContext}

Below are ${innovations.length} real, recently-researched innovations from the company's innovation radar. Your task is to curate a digest for the "${department}" department by selecting the most relevant innovations and writing a coherent narrative around them.

IMPORTANT RULES:
- Do NOT invent any facts, tools, products, or statistics beyond what is provided below.
- Every claim in the digest must be traceable to the innovations listed.
- Select 3-8 of the most relevant innovations for this department.
- Write the digest in a journalistic but practical tone.
- The "sources" array must ONLY contain URLs from the innovations you used (copy them exactly).

AVAILABLE INNOVATIONS:
${innovationsList}

Respond with valid JSON only, no markdown:
{
  "title": "A compelling digest title referencing real content, e.g. 'Five AI Tools Transforming ${department} Operations'",
  "summary": "2-3 sentence executive summary highlighting the most important innovations for this department",
  "content": "Full markdown article. Use ## section headings. For each innovation you cover, explain WHY it matters specifically to this department. End with a ## Key Takeaways section listing 3-5 actionable points.",
  "sources": [
    {"url": "<exact source URL from the list above>", "title": "<innovation title>"}
  ],
  "relevanceScore": number 1-10 (average relevance of selected innovations to this department)
}`;

		try {
			const result = await client.models.generateContent({ model: cfg.llmModel, contents: prompt });
			const response = result.text ?? '';
			const parsed = JSON.parse(this.extractJson(response));
			return {
				title: String(parsed.title || `${department} Innovation Digest`),
				summary: String(parsed.summary || ''),
				content: String(parsed.content || ''),
				sources: Array.isArray(parsed.sources)
					? parsed.sources.map((s: Record<string, unknown>) => ({
							url: String(s.url || ''),
							title: s.title ? String(s.title) : undefined
						}))
					: [],
				relevanceScore: Math.min(10, Math.max(1, Number(parsed.relevanceScore) || 5))
			};
		} catch (error) {
			console.error('AI news curation error:', error);
			return {
				title: `${department} Innovation Digest`,
				summary: 'Failed to generate news digest.',
				content: 'An error occurred while generating the news digest. Please try again later.',
				sources: [],
				relevanceScore: 0
			};
		}
	}
	
	async generateIdeas(
		department: string,
		count: number,
		customPrompt?: string | null
	): Promise<Array<{
		title: string;
		summary: string;
		problem: string;
		solution: string;
		department: string;
	}>> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		
		const ideasContext = customPrompt || `You are an innovation consultant for a legacy automotive manufacturer with established processes that is looking to modernize. You specialize in generating concrete, actionable innovation ideas.

Focus on technologies like:
- AI and machine learning applications
- Computer vision for quality control and safety
- IoT sensors and connected devices
- Process automation and robotics
- Data analytics and business intelligence

Examples of the kind of ideas we're looking for:
- Quality control on the assembly line using cameras and computer vision to detect defects in real-time
- AI-powered analysis of purchasing contracts to identify cost savings and risk factors
- Predictive maintenance using IoT sensors on manufacturing equipment to prevent downtime`;
		
		const prompt = `${ideasContext}

Generate exactly ${count} concrete, innovative ideas for the "${department}" department. Each idea should be specific, practical, and implementable within 3-12 months.

Respond with valid JSON only, no markdown:
{
  "ideas": [
    {
      "title": "Short, descriptive title",
      "summary": "One paragraph summarizing the idea",
      "problem": "The specific problem this solves in the ${department} department",
      "solution": "Detailed description of the proposed solution and how it works",
      "department": "${department}"
    }
  ]
}`;

		try {
			const result = await client.models.generateContent({ model: cfg.llmModel, contents: prompt });
			const response = result.text ?? '';
			const parsed = JSON.parse(this.extractJson(response));
			
			if (!Array.isArray(parsed.ideas)) {
				return [];
			}
			
			return parsed.ideas.slice(0, count).map((idea: Record<string, unknown>) => ({
				title: String(idea.title || ''),
				summary: String(idea.summary || ''),
				problem: String(idea.problem || ''),
				solution: String(idea.solution || ''),
				department: String(idea.department || department)
			}));
		} catch (error) {
			console.error('AI idea generation error:', error);
			return [];
		}
	}
	
	async evaluateIdea(
		idea: { title: string; summary: string; problem: string; solution: string; department: string },
		customPrompt?: string | null
	): Promise<{
		evaluationScore: number;
		evaluationDetails: {
			impact: number;
			feasibility: number;
			costEffectiveness: number;
			innovation: number;
			urgency: number;
		};
		researchData: {
			benefits: string[];
			risks: string[];
			timeline: string;
			costEstimate: string;
			requiredResources: string[];
			similarImplementations: { name: string; description: string; url?: string }[];
		};
	}> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();

		const evaluationContext = customPrompt || DEFAULT_EVALUATION_PROMPT;

		const prompt = `${evaluationContext}

Idea:
Title: ${idea.title}
Department: ${idea.department}
Summary: ${idea.summary}
Problem: ${idea.problem}
Solution: ${idea.solution}

Evaluate this idea thoroughly across multiple dimensions. Score each dimension from 1-10.
The overall evaluationScore should be a weighted average: impact (30%) + feasibility (25%) + costEffectiveness (20%) + innovation (15%) + urgency (10%).

Also provide detailed research data including benefits, risks, implementation timeline, cost estimates, required resources, and examples of similar implementations in other companies.

Respond with valid JSON only, no markdown:
{
  "evaluationScore": number 1-10 (weighted average),
  "evaluationDetails": {
    "impact": number 1-10 (potential business impact),
    "feasibility": number 1-10 (technical and organizational feasibility),
    "costEffectiveness": number 1-10 (value relative to cost),
    "innovation": number 1-10 (novelty and competitive advantage),
    "urgency": number 1-10 (how urgently this should be implemented)
  },
  "researchData": {
    "benefits": ["benefit1", "benefit2", "benefit3", "benefit4", "benefit5"],
    "risks": ["risk1", "risk2", "risk3"],
    "timeline": "Estimated implementation timeline (e.g., 3-6 months for MVP, 12 months for full rollout)",
    "costEstimate": "Estimated cost range and breakdown",
    "requiredResources": ["resource1", "resource2", "resource3"],
    "similarImplementations": [
      {"name": "Company/Project Name", "description": "How they implemented something similar", "url": "https://..."},
      {"name": "Company/Project Name", "description": "How they implemented something similar", "url": "https://..."}
    ]
  }
}`;

		try {
			const result = await client.models.generateContent({ model: cfg.llmModel, contents: prompt });
			const response = result.text ?? '';
			const parsed = JSON.parse(this.extractJson(response));
			
			const details = parsed.evaluationDetails || {};
			const impact = Math.min(10, Math.max(1, Number(details.impact) || 5));
			const feasibility = Math.min(10, Math.max(1, Number(details.feasibility) || 5));
			const costEffectiveness = Math.min(10, Math.max(1, Number(details.costEffectiveness) || 5));
			const innovation = Math.min(10, Math.max(1, Number(details.innovation) || 5));
			const urgency = Math.min(10, Math.max(1, Number(details.urgency) || 5));
			
			const weightedScore = impact * 0.3 + feasibility * 0.25 + costEffectiveness * 0.2 + innovation * 0.15 + urgency * 0.1;
			
			const research = parsed.researchData || {};
			
			return {
				evaluationScore: Math.round(weightedScore * 10) / 10,
				evaluationDetails: {
					impact,
					feasibility,
					costEffectiveness,
					innovation,
					urgency
				},
				researchData: {
					benefits: Array.isArray(research.benefits) ? research.benefits.map(String) : [],
					risks: Array.isArray(research.risks) ? research.risks.map(String) : [],
					timeline: String(research.timeline || 'Unknown'),
					costEstimate: String(research.costEstimate || 'Unknown'),
					requiredResources: Array.isArray(research.requiredResources) ? research.requiredResources.map(String) : [],
					similarImplementations: Array.isArray(research.similarImplementations) ? research.similarImplementations.map((impl: Record<string, unknown>) => ({
						name: String(impl.name || ''),
						description: String(impl.description || ''),
						url: impl.url ? String(impl.url) : undefined
					})) : []
				}
			};
		} catch (error) {
			console.error('AI idea evaluation error:', error);
			throw new Error('Failed to evaluate idea');
		}
	}
	
	/**
	 * Extract a structured innovation idea from a Jira issue's content
	 * Handles multimodal input (text + base64 images from attachments)
	 */
	async extractIdeaFromJiraIssue(issue: {
		summary: string;
		description: string;
		attachmentTexts: string[];
		attachmentImages: string[]; // base64 data URIs
	}, customPrompt?: string | null): Promise<{
		title: string;
		summary: string;
		problem: string;
		solution: string;
		department: DepartmentCategory;
	}> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();

		const attachmentSection = [
			issue.attachmentTexts.length > 0
				? `\n\nATTACHMENT CONTENT:\n${issue.attachmentTexts.join('\n\n')}`
				: '',
		].join('');

		const extractionContext = customPrompt || DEFAULT_JIRA_EXTRACTION_PROMPT;

		const textPrompt = `${extractionContext}

JIRA ISSUE TITLE: ${issue.summary}

JIRA ISSUE DESCRIPTION:
${issue.description || '(no description)'}${attachmentSection}

Respond with valid JSON only, no markdown:
{
  "title": "concise title",
  "summary": "one-paragraph summary",
  "problem": "specific problem being solved",
  "solution": "detailed proposed solution",
  "department": one of [${DEPARTMENTS.map(d => `"${d}"`).join(',')}]
}`;

		try {
			// contents is either the plain text prompt or a multimodal parts array.
			let contents: string | Part[] = textPrompt;

			if (issue.attachmentImages.length > 0) {
				// Multimodal request: text + images
				const parts: Part[] = [{ text: textPrompt }];

				for (const dataUri of issue.attachmentImages) {
					const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
					if (match) {
						parts.push({
							inlineData: {
								mimeType: match[1],
								data: match[2]
							}
						});
					}
				}

				contents = parts;
			}

			const result = await client.models.generateContent({ model: cfg.llmModel, contents });
			const response = result.text ?? '';
			const parsed = JSON.parse(this.extractJson(response));

		const dept = (DEPARTMENTS as readonly string[]).includes(parsed.department) ? parsed.department : 'general';

			return {
				title: String(parsed.title || issue.summary).slice(0, 80),
				summary: String(parsed.summary || ''),
				problem: String(parsed.problem || issue.description || ''),
				solution: String(parsed.solution || ''),
				department: dept as DepartmentCategory
			};
		} catch (error) {
			console.error('[AI] extractIdeaFromJiraIssue error:', error);
			// Fallback: use raw Jira fields
			return {
				title: issue.summary.slice(0, 80),
				summary: (issue.description || issue.summary).slice(0, 500),
				problem: issue.description || issue.summary,
				solution: issue.description || '',
				department: 'general'
			};
		}
	}

	async realizeIdea(
		idea: { title: string; summary: string; problem: string; solution: string; department: string },
		customPrompt?: string | null
	): Promise<{
		realizationHtml: string;
		realizationDiagram: string;
		realizationNotes: string;
		realizationCode: string;
	}> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		// realizeIdea produces a very large JSON payload (full HTML PoC + diagram +
		// structured notes + a JSON-stringified array of code files). The default
		// Gemini output budget (8192 tokens) is not enough and silently truncates
		// the response mid-string, which then surfaces as
		//   "JSON Parse error: Expected '}'"
		// when extractJson walks past EOF. Force JSON output mode and lift the
		// token cap so the model returns well-formed, complete JSON.

		const realizationContext = customPrompt || DEFAULT_REALIZATION_PROMPT;

		const prompt = `${realizationContext}

Idea:
Title: ${idea.title}
Department: ${idea.department}
Summary: ${idea.summary}
Problem: ${idea.problem}
Solution: ${idea.solution}

Generate four outputs:

1. **realizationHtml**: A complete, self-contained, WORKING single-file HTML+JS proof-of-concept application. This must be an interactive PoC, NOT a static mockup. Requirements:
   - Single HTML file with all CSS in a <style> tag and all JS in a <script> tag — zero external dependencies, no CDN links
   - Use a dark theme: background #0f172a, cards #1e293b, borders #334155, accent #3b82f6, success #22c55e, warning #f59e0b, danger #ef4444, text #e2e8f0, muted #94a3b8
   - ALL data lives in in-memory JS arrays/objects defined at the top of the script — no backend, no localStorage needed
   - ALL external integrations are mocked as JS functions that return hardcoded data after a simulated async delay (e.g. "async function fetchFromERP() { await delay(400); return mockERPData; }")
   - Include a clearly visible banner at the top: "PoC / MVP Demo — All data is mocked. No authentication or backend required."
   - WORKING interactive features appropriate for the idea: filtering, sorting, adding/editing/deleting records, form submissions that update the in-memory data and re-render, status changes, counters, search
   - Use vanilla JS DOM manipulation (document.getElementById, innerHTML, addEventListener) — no frameworks
   - Charts/graphs if relevant: use inline SVG drawn with JS, not canvas or external libraries
   - Every button and form must actually do something — no disabled or placeholder controls
   - No authentication, no login screens, no API keys
   - Responsive layout using CSS flexbox/grid

2. **realizationDiagram**: A Mermaid diagram showing the PoC architecture. Use graph TD or flowchart TD syntax. Show: the in-browser data layer (mock data arrays), UI components, mock integration boundaries (dashed border or annotation), and what real integrations would replace each mock.

3. **realizationNotes**: A structured markdown document. Use EXACTLY the following section headings — do not add, remove, or rename any:

## Department Impact
One concise paragraph + table: | Metric | Current State | Expected Improvement |

## Implementation Phases
### Phase N: Title (X weeks/months) — use this exact sub-heading format
Bullet tasks per phase. End with: | Phase | Duration | Key Deliverables | Dependencies |

## Technology Stack
| Component | Technology | Rationale |
Keep this minimal and realistic for a PoC (e.g. Python + FastAPI, SQLite, plain HTML/JS).

## Integration Points
Bullet list of existing systems; for each one note what the mock returns and what the real integration would require.

## Timeline & Milestones
| Milestone | Target Date | Success Criteria |

## ROI & Business Case
| Benefit | Estimated Value | Measurement Method |
Plus 2–3 bullets on payback period and cost savings.

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation Strategy |

Rules: **bold** key terms. Concise and actionable. No top-level "# Implementation Notes" heading.

4. **realizationCode**: A minimal project scaffold that a developer can use as a starting point to build a real backend for this PoC. Return a JSON array of file objects. Each file object has three string fields: "path" (relative path, e.g. "app.py"), "language" (e.g. "python", "typescript", "json", "markdown", "yaml", "toml", "dockerfile"), and "content" (the full file content as a string).

Include exactly these files (adapt names/content to the idea):
- The main backend entry point (e.g. "app.py" with FastAPI, or "server.ts" with Express — whichever fits the idea's domain better). Include stub route handlers that return the same mock data as the HTML PoC, with TODO comments marking where real logic goes.
- A data models file (e.g. "models.py" or "models.ts") with typed data structures matching the mock data shapes.
- A requirements/dependencies file (e.g. "requirements.txt" or "package.json") with only the minimal real dependencies needed.
- A "README.md" with: one-paragraph description, prerequisites, setup steps (3–5 commands), how to run, and a "Next steps" section listing the top 3 things needed to graduate from PoC to production (real DB, auth, real integrations).
- A ".env.example" file listing all environment variables the real system would need (with placeholder values and comments).

Keep file content concise but complete enough to run. Use comments (# TODO: or // TODO:) to mark where real implementation replaces mocked behaviour.

Respond with valid JSON only, no markdown code fences. The realizationCode field must be a JSON array serialised as a string:
{
  "realizationHtml": "<!DOCTYPE html><html>...</html>",
  "realizationDiagram": "graph TD\\n  A[...] --> B[...]\\n  ...",
  "realizationNotes": "## Department Impact\\n\\n...\\n\\n## Implementation Phases\\n\\n...",
  "realizationCode": "[{\\"path\\":\\"app.py\\",\\"language\\":\\"python\\",\\"content\\":\\"...\\"},...]"
}`;

		try {
			const result = await client.models.generateContent({
				model: cfg.llmModel,
				contents: prompt,
				config: {
					responseMimeType: 'application/json',
					maxOutputTokens: 32768
				}
			});
			const response = result.text ?? '';
			let parsed: Record<string, unknown>;
			try {
				parsed = JSON.parse(this.extractJson(response));
			} catch (parseErr) {
				// Surface enough context to diagnose truncation / malformed output
				// without spamming logs with a multi-megabyte HTML blob.
				console.error(
					'[realizeIdea] JSON parse failed. response.length=%d head=%s tail=%s',
					response.length,
					JSON.stringify(response.slice(0, 300)),
					JSON.stringify(response.slice(-300))
				);
				throw parseErr;
			}

			// realizationCode is a JSON string containing an array — parse and re-serialise to normalise
			let realizationCode = '[]';
			try {
				const raw = parsed.realizationCode;
				if (typeof raw === 'string' && raw.trim()) {
					// It may already be a parsed array if the model ignored our serialisation instruction
					const codeFiles = JSON.parse(raw);
					realizationCode = JSON.stringify(Array.isArray(codeFiles) ? codeFiles : []);
				} else if (Array.isArray(raw)) {
					realizationCode = JSON.stringify(raw);
				}
			} catch {
				realizationCode = '[]';
			}

			return {
				realizationHtml: String(parsed.realizationHtml || '<html><body><p>Failed to generate PoC</p></body></html>'),
				realizationDiagram: String(parsed.realizationDiagram || 'graph TD\n  A[Idea] --> B[Implementation]'),
				realizationNotes: String(parsed.realizationNotes || '## Department Impact\n\nNo notes generated.'),
				realizationCode
			};
		} catch (error) {
			console.error('AI idea realization error:', error);
			throw new Error('Failed to realize idea');
		}
	}

	/**
	 * Generate a trend analysis for a specific category.
	 */
	async generateTrend(
		categoryKey: string,
		categoryLabel: string,
		categoryGroup: string,
		customPrompt?: string | null,
		customCriteria?: string | null
	): Promise<{
		title: string;
		summary: string;
		content: string;
		keyInsights: string[];
		maturityLevel: 'emerging' | 'growing' | 'mature' | 'declining' | null;
		impactScore: number;
		timeHorizon: 'near-term' | 'mid-term' | 'long-term' | null;
		visualData: object;
		sources: { url: string; title?: string }[];
		department: string | null;
	}> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();

		const groupContextMap: Record<string, string> = {
			automotive: 'the automotive industry, including vehicle manufacturing, electrification, autonomous driving, connected cars, and digital transformation in automotive enterprises',
			department: `the "${categoryLabel}" department within a large automotive manufacturer (7000 office workers, 25000 assembly workers) undergoing digital transformation`,
			it: `the "${categoryLabel}" area of enterprise IT infrastructure and strategy within a large automotive manufacturer`
		};

		const context = customPrompt ||
			`You are a strategic technology analyst specializing in ${groupContextMap[categoryGroup] || categoryLabel}. You research long-term trends (not daily news) — focusing on movements, shifts, and evolution that span years.`;

		const criteriaBlock = customCriteria
			? `\nADDITIONAL CRITERIA:\n${customCriteria}\n`
			: '';

		const prompt = `${context}
${criteriaBlock}
Research and analyze the most significant current trend in "${categoryLabel}" relevant to a large automotive manufacturer.

IMPORTANT RULES:
- Focus on LONG-TERM TRENDS, not daily news or product announcements.
- Structure the analysis with clear sections: History & Origin, Current State, Future Outlook.
- Be engaging, insightful, and concise — the audience is employees who want to be informed, not overwhelmed.
- Include concrete data points, percentages, and milestones where possible.
- The "visualData" must contain data for visual charts (see format below).
- Sources should be real, authoritative references (industry reports, research papers, analyst firms).

MATURITY RUBRIC — pick the SINGLE best fit for "maturityLevel" based on real-world adoption:
- "emerging"  → Early experiments / pilots only. <10% of large enterprises have adopted. Standards still forming. Mostly hype and proofs-of-concept. (Examples: AGI in production, fully autonomous L5 driving, ambient computing.)
- "growing"   → Scaling rapidly. ~10–50% adoption among large enterprises. Clear leaders emerging, best practices solidifying, investment is accelerating. (Examples: software-defined vehicles today, generative AI in enterprise workflows.)
- "mature"    → Mainstream. >50% adoption. Standards established, vendors consolidated, ROI well-understood. Innovation now incremental. (Examples: cloud computing, ERP, e-commerce, mobile apps.)
- "declining" → Being actively replaced or losing relevance. Adoption shrinking, vendors exiting, or superseded by a newer approach. (Examples: on-prem-only data centers, internal combustion R&D investment, Flash/Silverlight-era web tech.)
Be honest — DO NOT default to "growing". If the trend is already mainstream say "mature". If it is still mostly hype say "emerging". Use the four levels with intent.

TIME HORIZON RUBRIC:
- "near-term"  → Material impact within 0–2 years.
- "mid-term"   → Material impact within 3–5 years.
- "long-term"  → Material impact 5+ years out.

Respond with valid JSON only, no markdown code fences:
{
  "title": "A compelling, specific trend title (e.g., 'The Rise of Software-Defined Vehicles')",
  "summary": "2-3 sentence executive summary of the trend and why it matters",
  "content": "Full markdown article structured as:\\n\\n## History & Origin\\n[How this trend emerged, key milestones, 2-3 paragraphs]\\n\\n## Current State\\n[Where things stand today, adoption rates, key players, 2-3 paragraphs]\\n\\n## Future Outlook\\n[Predictions for next 3-5 years, what to watch for, 2-3 paragraphs]\\n\\n## What This Means For You\\n[Practical implications for employees at an automotive company, 1-2 paragraphs]",
  "keyInsights": ["Insight 1 — one sentence each", "Insight 2", "Insight 3", "Insight 4", "Insight 5"],
  "maturityLevel": <one of: "emerging" | "growing" | "mature" | "declining" — see rubric below>,
  "impactScore": 0.0 to 1.0 (how significant this trend is),
  "timeHorizon": <one of: "near-term" | "mid-term" | "long-term">,
  "department": <one of [${DEPARTMENTS.map(d => `"${d}"`).join(', ')}] — the single department this trend is most relevant to. Use "general" if it crosses departments.>,
  "visualData": {
    "timeline": [
      {"year": 2018, "event": "Key milestone", "type": "past"},
      {"year": 2024, "event": "Current state", "type": "present"},
      {"year": 2028, "event": "Predicted development", "type": "future"}
    ],
    "adoptionCurve": [
      {"phase": "Innovators", "percentage": 100, "current": false},
      {"phase": "Early Adopters", "percentage": 75, "current": false},
      {"phase": "Early Majority", "percentage": 45, "current": true},
      {"phase": "Late Majority", "percentage": 15, "current": false},
      {"phase": "Laggards", "percentage": 5, "current": false}
    ],
    "impactDimensions": [
      {"dimension": "Cost Efficiency", "score": 0.8},
      {"dimension": "Innovation", "score": 0.9},
      {"dimension": "Risk", "score": 0.4},
      {"dimension": "Skills Required", "score": 0.6},
      {"dimension": "Time to Value", "score": 0.7}
    ],
    "stats": [
      {"label": "Market Size", "value": "$XX Billion", "trend": "up"},
      {"label": "Adoption Rate", "value": "XX%", "trend": "up"},
      {"label": "YoY Growth", "value": "XX%", "trend": "up"}
    ]
  },
  "sources": [
    {"url": "https://example.com/report", "title": "Source title"}
  ]
}`;

		const VALID_MATURITY = ['emerging', 'growing', 'mature', 'declining'] as const;
		const VALID_HORIZON = ['near-term', 'mid-term', 'long-term'] as const;

		try {
			const result = await client.models.generateContent({ model: cfg.llmModel, contents: prompt });
			const response = result.text ?? '';
			const parsed = JSON.parse(this.extractJson(response));

			// Validate enum fields strictly. If the AI returns something off-schema, log and store null
			// rather than silently coercing — this prevents the historical "everything is growing" bug.
			const rawMaturity = typeof parsed.maturityLevel === 'string' ? parsed.maturityLevel.trim().toLowerCase() : null;
			const maturityLevel = (VALID_MATURITY as readonly string[]).includes(rawMaturity ?? '')
				? rawMaturity
				: null;
			if (rawMaturity && !maturityLevel) {
				console.warn(`[AI.generateTrend] Invalid maturityLevel "${rawMaturity}" for "${categoryLabel}" — storing null`);
			}

			const rawHorizon = typeof parsed.timeHorizon === 'string' ? parsed.timeHorizon.trim().toLowerCase() : null;
			const timeHorizon = (VALID_HORIZON as readonly string[]).includes(rawHorizon ?? '')
				? rawHorizon
				: null;
			if (rawHorizon && !timeHorizon) {
				console.warn(`[AI.generateTrend] Invalid timeHorizon "${rawHorizon}" for "${categoryLabel}" — storing null`);
			}

			return {
				title: String(parsed.title || `${categoryLabel} Trends`),
				summary: String(parsed.summary || ''),
				content: String(parsed.content || ''),
				keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.map(String) : [],
				maturityLevel,
				impactScore: Number(parsed.impactScore) || 0.5,
				timeHorizon,
				// Validate against the same DEPARTMENTS enum the UI uses. Off-enum values
				// (or a missing field) come back as null — the service then falls back to
				// a category-derived default. This mirrors the maturity/horizon validation
				// pattern a few lines above.
				department: (DEPARTMENTS as readonly string[]).includes(parsed.department ?? '')
					? String(parsed.department)
					: null,
				visualData: parsed.visualData || {},
				sources: Array.isArray(parsed.sources)
					? parsed.sources.map((s: Record<string, unknown>) => ({
							url: String(s.url || ''),
							title: s.title ? String(s.title) : undefined
						}))
					: []
			};
		} catch (error) {
			console.error('AI trend generation error:', error);
			return {
				title: `${categoryLabel} Trends`,
				summary: 'Failed to generate trend analysis.',
				content: 'An error occurred while generating the trend analysis. Please try again later.',
				keyInsights: [],
				maturityLevel: null,
				impactScore: 0.5,
				timeHorizon: null,
				visualData: {},
				sources: [],
				department: null
			};
		}
	}

	/**
	 * Generate free-form text from a prompt. Used for chat facilitation and spec generation.
	 */
	async generateText(prompt: string): Promise<string> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		const result = await client.models.generateContent({ model: cfg.llmModel, contents: prompt });
		return result.text ?? '';
	}

	// ── Spec mockups ────────────────────────────────────────────────────────
	//
	// Mockups are generated screen-by-screen rather than in one giant JSON
	// payload: each screen is an independent, bounded model round-trip, which
	// is far more reliable than asking for many full HTML documents at once
	// (no mid-string truncation, and a single failure doesn't lose the batch).

	/**
	 * Run an async producer with bounded retries on transient failures. The
	 * Gemini SDK surfaces network blips and provider-side overload as thrown
	 * errors ("fetch failed", 429/500/503, "overloaded"); retrying these with
	 * exponential backoff makes slow, multi-call flows like mockup generation
	 * far more reliable. Non-transient errors (bad key, 400) fail fast.
	 */
	private async withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
		let lastErr: unknown;
		for (let attempt = 1; attempt <= attempts; attempt++) {
			try {
				return await fn();
			} catch (err) {
				lastErr = err;
				const msg = err instanceof Error ? err.message : String(err);
				const transient =
					/fetch failed|fetch error|network|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN|timed? ?out|aborted|\b(429|500|502|503|504)\b|overloaded|unavailable|rate limit|deadline/i.test(
						msg
					);
				if (!transient || attempt === attempts) break;
				const backoffMs = 600 * 2 ** (attempt - 1); // 600ms, 1.2s, 2.4s …
				console.warn(`[ai] ${label} attempt ${attempt}/${attempts} failed (${msg}); retrying in ${backoffMs}ms`);
				await new Promise((resolve) => setTimeout(resolve, backoffMs));
			}
		}
		throw lastErr;
	}

	/**
	 * A self-contained placeholder mockup used when a single screen fails to
	 * generate. It reuses the shared shell so the set stays cohesive and the
	 * user can retry just this screen via "Regenerate" instead of losing the
	 * entire batch.
	 */
	private fallbackMockup(designSystem: DesignSystem, screenName: string, purpose: string): SpecMockup {
		const safeName = screenName.replace(/[<>&]/g, '');
		const safePurpose = (purpose ?? '').replace(/[<>&]/g, '');
		const content = `<section style="max-width:640px;margin:48px auto;padding:24px;background:#1e293b;border:1px solid #334155;border-radius:12px;color:#e2e8f0;font-family:system-ui,sans-serif;">
  <h1 style="margin:0 0 8px;font-size:20px;">${safeName}</h1>
  <p style="color:#94a3b8;margin:0 0 16px;">${safePurpose}</p>
  <p style="color:#f59e0b;margin:0;">This screen couldn't be generated automatically. Use “Regenerate” to try again.</p>
</section>`;
		const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safeName}</title><style>${designSystem.sharedCss}</style></head><body>${designSystem.shellHtml.replace('<!-- SCREEN CONTENT GOES HERE -->', content)}</body></html>`;
		return { id: crypto.randomUUID(), screenName, purpose, html };
	}

	/** Run an async mapper over items with a small concurrency cap. */
	private async mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
		const results: R[] = new Array(items.length);
		let cursor = 0;
		const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (cursor < items.length) {
				const i = cursor++;
				results[i] = await fn(items[i], i);
			}
		});
		await Promise.all(workers);
		return results;
	}

	/** Extract the list of screens (name + purpose) the spec calls for. */
	private async extractScreens(spec: string): Promise<Array<{ screenName: string; purpose: string }>> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		const prompt = `Read this software specification. Identify the distinct SCREENS / pages the application needs (look especially at the "What screens does the application need?" section, but also infer obvious screens implied by the features).

Return a JSON array (max 8 items, most important first) of objects: { "screenName": string, "purpose": string }.
- screenName: a short human title, e.g. "Dashboard", "Request List", "New Request Form".
- purpose: one sentence describing what the screen is for.
Respond with JSON only, no code fences.

Specification:
${spec}`;
		try {
			const res = await this.withRetry('extractScreens', () =>
				client.models.generateContent({
					model: cfg.llmModel,
					contents: prompt,
					config: { responseMimeType: 'application/json', maxOutputTokens: 4096 }
				})
			);
			const parsed = JSON.parse(this.extractJson(res.text ?? '')) as Array<{ screenName?: string; purpose?: string }>;
			const screens = (Array.isArray(parsed) ? parsed : [])
				.filter((s) => s && typeof s.screenName === 'string' && s.screenName.trim())
				.slice(0, 8)
				.map((s) => ({ screenName: s.screenName!.trim(), purpose: (s.purpose ?? '').trim() }));
			if (screens.length > 0) return screens;
		} catch (err) {
			console.error('[generateMockups] screen extraction parse failed:', err);
		}
		// Fallback: a single generic screen so the user still gets something.
		return [{ screenName: 'Main Screen', purpose: 'Primary screen of the application.' }];
	}

	/**
	 * A code-built design system used when the model call/parse fails, so screens
	 * still share one cohesive shell instead of each inventing its own.
	 */
	private fallbackDesignSystem(appTitle: string, navItems: string[]): DesignSystem {
		const items = navItems.length > 0 ? navItems : ['Home'];
		const links = items
			.map((label) => `<a class="nav-link" data-screen="${label}" href="#">${label}</a>`)
			.join('\n        ');
		const sharedCss = `:root{--bg:#0f172a;--surface:#1e293b;--border:#334155;--accent:#3b82f6;--success:#22c55e;--warning:#f59e0b;--danger:#ef4444;--text:#e2e8f0;--muted:#94a3b8;}
*{box-sizing:border-box;}
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);}
.app-shell{display:flex;min-height:100vh;}
.sidebar{width:220px;flex:0 0 220px;background:var(--surface);border-right:1px solid var(--border);padding:16px;}
.brand{font-weight:700;font-size:18px;margin-bottom:20px;color:var(--text);}
.nav-link{display:block;padding:8px 12px;border-radius:8px;color:var(--muted);text-decoration:none;margin-bottom:4px;}
.nav-link:hover{background:rgba(148,163,184,.12);color:var(--text);}
.nav-link.active{background:var(--accent);color:#fff;}
.content{flex:1;padding:24px;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;}
.btn{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;background:rgba(59,130,246,.2);color:var(--accent);}
table{width:100%;border-collapse:collapse;}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--border);}
th{color:var(--muted);font-weight:600;}`;
		const shellHtml = `<div class="app-shell">
  <aside class="sidebar">
    <div class="brand">${appTitle}</div>
    <nav>
        ${links}
    </nav>
  </aside>
  <main class="content">
    <!-- SCREEN CONTENT GOES HERE -->
  </main>
</div>`;
		return { appName: appTitle, layout: 'sidebar', navItems: items, sharedCss, shellHtml };
	}

	/**
	 * Generate the shared design system / app shell once per set. Every screen
	 * then reuses this exact CSS + header markup so the mockups read as one app.
	 */
	async generateDesignSystem(
		appTitle: string,
		spec: string,
		screens: Array<{ screenName: string; purpose: string }>
	): Promise<DesignSystem> {
		const navList = screens.map((s) => s.screenName);
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		const prompt = `You are a senior product designer defining the SHARED design system / app shell for one application, so that every screen mockup looks like part of the SAME product (identical app name, header/navigation, fonts and component styling).

Application working title: "${appTitle}"
The application has these screens (use them as the navigation menu): ${JSON.stringify(navList)}

Return a SINGLE JSON object (no code fences) with exactly these keys:
{
  "appName": string,   // the canonical product name shown in every header. Refine the working title into a clean product name.
  "layout": "sidebar" | "topnav",  // pick ONE navigation layout appropriate for this app; it is shared by every screen.
  "navItems": string[],  // the shared navigation menu labels, aligned to the screens above (most important first).
  "sharedCss": string,   // real CSS, reused verbatim by every screen. MUST use this dark palette via :root variables: background #0f172a, surface/cards #1e293b, borders #334155, accent #3b82f6, success #22c55e, warning #f59e0b, danger #ef4444, text #e2e8f0, muted #94a3b8. Include a base reset, typography, and reusable component classes: the header/sidebar, nav links WITH an ".active" (and [aria-current]) state, buttons (.btn), cards (.card), tables, status badges (.badge), and form controls. No @import, no external fonts/CDNs.
  "shellHtml": string    // the header (top-nav) or sidebar markup that EVERY screen renders identically. Show the app name and ALL navItems as links, each link carrying a data-screen="<label>" attribute so a screen can mark its own link active. Include a clearly identifiable content container (e.g. <main class="content"><!-- SCREEN CONTENT GOES HERE --></main>) where each screen inserts its own body.
}

Respond with the JSON object only.

Relevant specification context:
${spec}`;
		try {
			const res = await this.withRetry('generateDesignSystem', () =>
				client.models.generateContent({
					model: cfg.llmModel,
					contents: prompt,
					config: { responseMimeType: 'application/json', maxOutputTokens: 8192 }
				})
			);
			const parsed = JSON.parse(this.extractJson(res.text ?? '')) as Partial<DesignSystem>;
			const layout = parsed.layout === 'topnav' ? 'topnav' : 'sidebar';
			const navItems = Array.isArray(parsed.navItems)
				? parsed.navItems.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
				: [];
			if (typeof parsed.sharedCss === 'string' && parsed.sharedCss.trim() &&
				typeof parsed.shellHtml === 'string' && parsed.shellHtml.trim()) {
				return {
					appName: (parsed.appName ?? appTitle).toString().trim() || appTitle,
					layout,
					navItems: navItems.length > 0 ? navItems : navList,
					sharedCss: parsed.sharedCss,
					shellHtml: parsed.shellHtml
				};
			}
		} catch (err) {
			console.error('[generateMockups] design system parse failed:', err);
		}
		return this.fallbackDesignSystem(appTitle, navList);
	}

	/** Generate one self-contained HTML/CSS mockup for a single screen. */
	async generateSingleMockup(
		appTitle: string,
		spec: string,
		screenName: string,
		purpose: string,
		designSystem?: DesignSystem
	): Promise<SpecMockup> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();

		const sharedShellBlock = designSystem
			? `

This screen is ONE part of a single cohesive application. You MUST reuse the shared app shell below VERBATIM so every screen looks like the same product (same name, header, menu and styling).

App name (use this everywhere a product name appears): "${designSystem.appName}"
Navigation layout: ${designSystem.layout}

SHARED CSS — begin the document's <style> with this EXACT block unchanged, then add ONLY screen-specific styles AFTER it:
${designSystem.sharedCss}

SHARED SHELL HTML — render this EXACT header/navigation markup, then place THIS screen's content inside its content container (replace the content-placeholder comment). Set the active state (add the "active" class and aria-current="page") on the nav link whose data-screen equals "${screenName}":
${designSystem.shellHtml}
`
			: '';

		const prompt = `You are a senior UI/UX designer. Produce a realistic visual MOCKUP (a single screen) for the application described below. This is a static visual design preview — it must LOOK like the real screen, populated with believable sample content, but it does not need a working backend.

Application: "${designSystem?.appName ?? appTitle}"
Screen to design: "${screenName}"
Screen purpose: ${purpose}
${sharedShellBlock}
Requirements:
- Output a SINGLE, complete, self-contained HTML document (<!DOCTYPE html> … </html>) with all CSS in a <style> tag. No external resources, no CDN links, no frameworks.
- Dark theme palette: background #0f172a, surface/cards #1e293b, borders #334155, accent #3b82f6, success #22c55e, warning #f59e0b, danger #ef4444, text #e2e8f0, muted #94a3b8.${designSystem ? '\n- Do NOT invent a different app name, header or navigation — reuse the shared shell above exactly, only marking THIS screen active and filling the content area.' : ''}
- Realistic, representative sample data inline (rows, cards, values) — not "Lorem ipsum" and not empty placeholders.
- Faithfully reflect THIS screen's purpose and the relevant features/fields/actions from the specification (headings, tables, forms, buttons, status badges, charts as inline SVG if useful).
- Responsive layout using flexbox/grid. Realistic spacing, typography and visual hierarchy.${designSystem ? '' : ' A small header/nav consistent with a real app.'}
- Light interactivity via minimal vanilla JS is allowed (e.g. tab switching) but is optional — the focus is the visual design.
- This is a SINGLE self-contained page that must not navigate anywhere. Links and buttons must be inert: use href="#" (or href="javascript:void(0)") for anchors, type="button" for buttons, and do NOT use <form action> submits or external/internal URLs. Nothing may attempt to leave this page.
- Do NOT include login screens, cookie banners, or "PoC/demo" disclaimers.

Output ONLY the raw HTML document. No markdown, no commentary, no code fences.

Relevant specification context:
${spec}`;

		const res = await this.withRetry(`generateSingleMockup:${screenName}`, () =>
			client.models.generateContent({
				model: cfg.llmModel,
				contents: prompt,
				config: { maxOutputTokens: 16384 }
			})
		);
		let html = (res.text ?? '').trim();
		// Strip accidental code fences.
		html = html.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim();
		return { id: crypto.randomUUID(), screenName, purpose, html };
	}

	/** Generate the full set of screen mockups for a spec, sharing one app shell. */
	async generateMockups(
		appTitle: string,
		spec: string
	): Promise<{ designSystem: DesignSystem; screens: SpecMockup[] }> {
		const screens = await this.extractScreens(spec);
		// Build the shared design system once so every screen reuses the same
		// app name, header, navigation and component styling.
		const designSystem = await this.generateDesignSystem(appTitle, spec, screens);
		// Concurrency 2 keeps total latency reasonable without tripping rate limits.
		// A single screen failing must NOT lose the whole batch — fall back to a
		// placeholder for that one screen so the user keeps the rest and can
		// regenerate the failed one individually.
		const built = await this.mapLimit(screens, 2, async (s) => {
			try {
				return await this.generateSingleMockup(designSystem.appName, spec, s.screenName, s.purpose, designSystem);
			} catch (err) {
				console.error(`[generateMockups] screen "${s.screenName}" failed after retries:`, err);
				return this.fallbackMockup(designSystem, s.screenName, s.purpose);
			}
		});
		return { designSystem, screens: built };
	}
}

export const aiService = new AIService();
