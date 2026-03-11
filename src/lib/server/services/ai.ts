import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Part } from '@google/generative-ai';
import { env } from '$env/dynamic/private';
import type { InnovationCategory, InnovationResearchData, DepartmentCategory } from '$lib/types';
import { db, settings } from '$lib/server/db';
import { eq } from 'drizzle-orm';

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
5. The most fitting department from this list: rd, production, hr, legal, finance, it, purchasing, quality, logistics, general`;

class AIService {
	private genAI: GoogleGenerativeAI | null = null;
	private cachedSettings: { llmApiKey: string | null; llmModel: string } | null = null;
	// TTL-based cache: settings are re-fetched after 60 seconds so key changes propagate
	// even without an explicit clearCache() call (e.g., in multi-worker deployments).
	private cachedAt = 0;
	private static readonly CACHE_TTL_MS = 60_000;

	private async getSettings(): Promise<{ llmApiKey: string | null; llmModel: string }> {
		if (this.cachedSettings && Date.now() - this.cachedAt < AIService.CACHE_TTL_MS) {
			return this.cachedSettings;
		}
		const [settingsRow] = await db.select().from(settings).where(eq(settings.id, 'default'));
		this.cachedSettings = {
			llmApiKey: settingsRow?.llmApiKey || env.GEMINI_API_KEY || null,
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
	 * 1. Try to find the outermost JSON value using bracket-depth counting —
	 *    this is more robust than regex when the AI embeds code fences inside
	 *    its JSON (e.g., inside a realizationNotes markdown field).
	 * 2. Fall back to stripping a markdown code fence if depth counting fails.
	 */
	private extractJson(response: string): string {
		// Walk the string to find the first '{' or '[' and its matching closing bracket
		const startChar = response.includes('{') ? '{' : '[';
		const endChar = startChar === '{' ? '}' : ']';
		const start = response.indexOf(startChar);
		if (start === -1) {
			// No JSON object found — fall back to stripping code fences
			return this.stripCodeFence(response);
		}
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

	private async getClientAsync(): Promise<GoogleGenerativeAI> {
		if (!this.genAI) {
			const cfg = await this.getSettings();
			const apiKey = cfg.llmApiKey;
			if (!apiKey) {
				throw new Error('LLM API Key is not configured. Please set it in Admin > Settings.');
			}
			this.genAI = new GoogleGenerativeAI(apiKey);
		}
		return this.genAI;
	}
	
	async filterForRelevance(
		item: { title: string; url: string; content?: string },
		customPrompt?: string | null
	): Promise<FilterResult> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		const model = client.getGenerativeModel({ model: cfg.llmModel });
		
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
			const result = await model.generateContent(prompt);
			const response = result.response.text();
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
		const model = client.getGenerativeModel({ model: cfg.llmModel });
		
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
			const result = await model.generateContent(prompt);
			const response = result.response.text();
			const parsed = JSON.parse(this.extractJson(response));
			
			return {
				title: String(parsed.title || item.title),
				tagline: String(parsed.tagline || '').slice(0, 150),
				category: parsed.category as InnovationCategory || item.suggestedCategory || 'developer-tools',
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
		const model = client.getGenerativeModel({ model: cfg.llmModel });
		
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
			const result = await model.generateContent(prompt);
			const response = result.response.text();
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
		const model = client.getGenerativeModel({ model: cfg.llmModel });

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
			const result = await model.generateContent(prompt);
			const response = result.response.text();
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
		const model = client.getGenerativeModel({ model: cfg.llmModel });
		
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
			const result = await model.generateContent(prompt);
			const response = result.response.text();
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
		const model = client.getGenerativeModel({ model: cfg.llmModel });

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
			const result = await model.generateContent(prompt);
			const response = result.response.text();
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
		const model = client.getGenerativeModel({ model: cfg.llmModel });

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
  "department": one of ["rd","production","hr","legal","finance","it","purchasing","quality","logistics","general"]
}`;

		try {
			let result;

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

				result = await model.generateContent(parts);
			} else {
				result = await model.generateContent(textPrompt);
			}

			const response = result.response.text();
			const parsed = JSON.parse(this.extractJson(response));

			const validDepartments: DepartmentCategory[] = [
				'rd', 'production', 'hr', 'legal', 'finance',
				'it', 'purchasing', 'quality', 'logistics', 'general'
			];
			const dept = validDepartments.includes(parsed.department) ? parsed.department : 'general';

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
	}> {
		const cfg = await this.getSettings();
		const client = await this.getClientAsync();
		const model = client.getGenerativeModel({ model: cfg.llmModel });

		const realizationContext = customPrompt || DEFAULT_REALIZATION_PROMPT;

		const prompt = `${realizationContext}

Idea:
Title: ${idea.title}
Department: ${idea.department}
Summary: ${idea.summary}
Problem: ${idea.problem}
Solution: ${idea.solution}

Generate three outputs:

1. **realizationHtml**: A complete, self-contained HTML page that serves as a mockup/prototype of what this idea would look like when implemented. Requirements:
   - All CSS must be inline (in a <style> tag in the <head>)
   - Use a dark theme with these colors: background #0f172a, cards #1e293b, borders #334155, primary accent #3b82f6, success #22c55e, warning #f59e0b, danger #ef4444, text #e2e8f0, muted text #94a3b8
   - Include realistic mock data, charts (using simple CSS/HTML charts or SVG), statistics, and UI elements
   - Make it look like a real production dashboard/application
   - Include navigation, status indicators, data tables, or visualizations as appropriate
   - The page should be responsive and visually polished
   - For example, if the idea is "Quality control with computer vision", show a dashboard with camera feed placeholders, defect detection results, accuracy metrics, recent alerts, trend charts, etc.
   - Do NOT use any external dependencies or CDN links

2. **realizationDiagram**: A Mermaid diagram showing the implementation architecture or data flow. Use graph TD or flowchart TD syntax. Include components like data sources, processing layers, APIs, databases, user interfaces, and integrations.

3. **realizationNotes**: A structured markdown document. Use EXACTLY the following section headings and formats — do not add, remove, or rename any heading:

## Department Impact
One concise paragraph describing the specific benefits for the ${idea.department} department, followed by a markdown table with columns: | Metric | Current State | Expected Improvement |

## Implementation Phases
For each phase use the sub-heading format: ### Phase N: Title (X weeks/months)
List key tasks as bullet points under each phase.
End this section with a summary table: | Phase | Duration | Key Deliverables | Dependencies |

## Technology Stack
A markdown table with columns: | Component | Technology | Rationale |

## Integration Points
A bullet list of existing systems or services, each with a brief description of how this idea connects to them.

## Timeline & Milestones
A markdown table with columns: | Milestone | Target Date | Success Criteria |

## ROI & Business Case
A markdown table with columns: | Benefit | Estimated Value | Measurement Method |
Followed by 2–3 bullet points on payback period and cost savings.

## Risks & Mitigations
A markdown table with columns: | Risk | Likelihood | Impact | Mitigation Strategy |

Rules:
- Use **bold** for key terms within paragraphs and bullet points.
- Keep every section concise and actionable.
- Do not include a top-level "# Implementation Notes" heading — the sections start directly with "## Department Impact".

Respond with valid JSON only, no markdown code fences:
{
  "realizationHtml": "<!DOCTYPE html><html>...</html>",
  "realizationDiagram": "graph TD\\n  A[...] --> B[...]\\n  ...",
  "realizationNotes": "## Department Impact\\n\\n...\\n\\n## Implementation Phases\\n\\n..."
}`;

		try {
			const result = await model.generateContent(prompt);
			const response = result.response.text();
			const parsed = JSON.parse(this.extractJson(response));
			
			return {
				realizationHtml: String(parsed.realizationHtml || '<html><body><p>Failed to generate visualization</p></body></html>'),
				realizationDiagram: String(parsed.realizationDiagram || 'graph TD\n  A[Idea] --> B[Implementation]'),
				realizationNotes: String(parsed.realizationNotes || '# Implementation Notes\n\nNo notes generated.')
			};
		} catch (error) {
			console.error('AI idea realization error:', error);
			throw new Error('Failed to realize idea');
		}
	}
}

export const aiService = new AIService();
