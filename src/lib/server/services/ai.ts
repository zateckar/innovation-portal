import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';
import type { InnovationCategory, InnovationResearchData } from '$lib/types';

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

class AIService {
	private genAI: GoogleGenerativeAI | null = null;
	
	private getClient(): GoogleGenerativeAI {
		if (!this.genAI) {
			const apiKey = env.GEMINI_API_KEY;
			if (!apiKey) {
				throw new Error('GEMINI_API_KEY is not configured');
			}
			this.genAI = new GoogleGenerativeAI(apiKey);
		}
		return this.genAI;
	}
	
	async filterForRelevance(
		item: { title: string; url: string; content?: string },
		customPrompt?: string | null
	): Promise<FilterResult> {
		const model = this.getClient().getGenerativeModel({ model: 'gemini-3-flash-preview' });
		
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
			
			// Extract JSON from response (handle markdown code blocks)
			let jsonStr = response;
			const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (jsonMatch) {
				jsonStr = jsonMatch[1];
			}
			
			const parsed = JSON.parse(jsonStr.trim());
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
		const model = this.getClient().getGenerativeModel({ model: 'gemini-3-flash-preview' });
		
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
			
			// Extract JSON from response
			let jsonStr = response;
			const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (jsonMatch) {
				jsonStr = jsonMatch[1];
			}
			
			const parsed = JSON.parse(jsonStr.trim());
			
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
		const model = this.getClient().getGenerativeModel({ model: 'gemini-3-flash-preview' });
		
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
			
			let jsonStr = response;
			const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (jsonMatch) {
				jsonStr = jsonMatch[1];
			}
			
			const parsed = JSON.parse(jsonStr.trim());
			
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
}

export const aiService = new AIService();
