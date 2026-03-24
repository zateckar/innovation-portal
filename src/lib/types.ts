// Innovation types for frontend use

export type InnovationCategory = 
	| 'ai-ml'
	| 'devops'
	| 'security'
	| 'data-analytics'
	| 'developer-tools'
	| 'automation'
	| 'collaboration'
	| 'infrastructure';

export type MaturityLevel = 'experimental' | 'beta' | 'stable' | 'mature';

export interface InnovationResearchData {
	executiveSummary: string;
	keyBenefits: string[];
	useCases: string[];
	competitors: {
		name: string;
		url?: string;
		comparison: string;
	}[];
	comparisonTable?: {
		feature: string;
		thisProduct: string | boolean;
		competitors: Record<string, string | boolean>;
	}[];
	prosAndCons: {
		pros: string[];
		cons: string[];
	};
	requiredSkills: string[];
	estimatedTimeToMVP: string;
	sources: {
		url: string;
		title: string;
		type: 'original' | 'related' | 'documentation';
	}[];
}

export interface InnovationSummary {
	id: string;
	slug: string;
	title: string;
	tagline: string;
	category: InnovationCategory;
	heroImageUrl: string | null;
	isOpenSource: boolean;
	isSelfHosted: boolean;
	hasAiComponent: boolean;
	maturityLevel: MaturityLevel | null;
	relevanceScore: number | null;
	actionabilityScore: number | null;
	voteCount: number;
	hasVoted: boolean;
	publishedAt: Date | null;
}

export interface InnovationDetail extends InnovationSummary {
	license: string | null;
	githubUrl: string | null;
	documentationUrl: string | null;
	innovationScore: number | null;
	researchData: InnovationResearchData;
	tags: string[];
}

export const CATEGORY_LABELS: Record<InnovationCategory, string> = {
	'ai-ml': 'AI & Machine Learning',
	'devops': 'DevOps',
	'security': 'Security',
	'data-analytics': 'Data & Analytics',
	'developer-tools': 'Developer Tools',
	'automation': 'Automation',
	'collaboration': 'Collaboration',
	'infrastructure': 'Infrastructure'
};

export const CATEGORY_COLORS: Record<InnovationCategory, string> = {
	'ai-ml': '#8B5CF6',
	'devops': '#06B6D4',
	'security': '#EF4444',
	'data-analytics': '#F59E0B',
	'developer-tools': '#10B981',
	'automation': '#EC4899',
	'collaboration': '#6366F1',
	'infrastructure': '#84CC16'
};

// Department categories (for News and Ideas)
export type DepartmentCategory =
	| 'rd'
	| 'production'
	| 'hr'
	| 'legal'
	| 'finance'
	| 'it'
	| 'purchasing'
	| 'quality'
	| 'logistics'
	| 'general';

export const DEPARTMENT_LABELS: Record<DepartmentCategory, string> = {
	'rd': 'Research & Development',
	'production': 'Production / Manufacturing',
	'hr': 'Human Resources',
	'legal': 'Legal',
	'finance': 'Finance & Accounting',
	'it': 'Information Technology',
	'purchasing': 'Purchasing / Procurement',
	'quality': 'Quality Assurance',
	'logistics': 'Logistics & Supply Chain',
	'general': 'General / Cross-Department'
};

export const DEPARTMENT_COLORS: Record<DepartmentCategory, string> = {
	'rd': '#8B5CF6',
	'production': '#F59E0B',
	'hr': '#EC4899',
	'legal': '#6366F1',
	'finance': '#10B981',
	'it': '#06B6D4',
	'purchasing': '#EF4444',
	'quality': '#84CC16',
	'logistics': '#F97316',
	'general': '#6B7280'
};

// News types
export interface NewsSummary {
	id: string;
	slug: string;
	title: string;
	summary: string;
	category: DepartmentCategory;
	relevanceScore: number | null;
	publishedAt: Date | null;
	createdAt: Date | null;
}

export interface NewsDetail extends NewsSummary {
	content: string;
	sources: { url: string; title?: string }[];
}

// Ideas types
export type IdeaStatus = 'draft' | 'evaluated' | 'realized' | 'published' | 'archived';

export type IdeaSpecStatus = 'not_started' | 'in_progress' | 'completed';

export type IdeaSpecReviewStatus = 'not_ready' | 'under_review' | 'published';

export interface SpecVersion {
	id: string;
	ideaId: string;
	versionNumber: number;
	content: string;
	authorId: string | null;
	authorName: string;
	changeDescription: string | null;
	createdAt: Date | null;
}

export interface IdeaChatMessage {
	id: string;
	ideaId: string;
	role: 'ai' | 'user';
	userId: string | null;
	userName: string | null;
	content: string;
	createdAt: Date | null;
}

export interface IdeaSummary {
	id: string;
	slug: string;
	title: string;
	summary: string;
	department: DepartmentCategory;
	evaluationScore: number | null;
	status: IdeaStatus;
	specStatus?: IdeaSpecStatus;
	specReviewStatus?: IdeaSpecReviewStatus;
	specDocument?: string | null;
	hasParticipated?: boolean;
	rank: number | null;
	batchId: string | null;
	voteCount: number;
	hasVoted: boolean;
	createdAt: Date | null;
	source?: 'ai' | 'jira' | 'user';
	jiraIssueKey?: string | null;
	jiraIssueUrl?: string | null;
	proposedByEmail?: string | null;
}

export interface IdeaEvaluationDetails {
	impact: number;
	feasibility: number;
	costEffectiveness: number;
	innovation: number;
	urgency: number;
}

export interface IdeaResearchData {
	benefits: string[];
	risks: string[];
	timeline: string;
	costEstimate: string;
	requiredResources: string[];
	similarImplementations: { name: string; description: string; url?: string }[];
}

export interface PocFile {
	path: string;
	language: string;
	content: string;
}

export interface IdeaDetail extends IdeaSummary {
	problem: string;
	solution: string;
	researchData: IdeaResearchData | null;
	evaluationDetails: IdeaEvaluationDetails | null;
	realizationHtml: string | null;
	realizationDiagram: string | null;
	realizationNotes: string | null;
	/** JSON-serialised PocFile[] — project scaffold files for download */
	realizationCode: string | null;
	// Jira fields are inherited from IdeaSummary (source, jiraIssueKey, jiraIssueUrl)
	// Development stage fields
	specStatus: IdeaSpecStatus;
	specReviewStatus: IdeaSpecReviewStatus;
	specDocument: string | null;
	adoPrUrl: string | null;
	jiraEscalationKey: string | null;
	hasParticipated: boolean;
	chatMessages: IdeaChatMessage[];
}

// Incubator Catalog types
export type CatalogItemStatus = 'active' | 'maintenance' | 'archived';

export interface CatalogItemSummary {
	id: string;
	slug: string;
	name: string;
	description: string;
	category: InnovationCategory;
	url: string;
	iconUrl: string | null;
	screenshotUrl: string | null;
	status: CatalogItemStatus;
	innovationId: string | null;
	createdAt: Date | null;
}

export interface CatalogItemDetail extends CatalogItemSummary {
	howTo: string;
	updatedAt: Date | null;
	archivedAt: Date | null;
	// Related innovation info (if promoted from radar)
	relatedInnovation?: {
		slug: string;
		title: string;
		voteCount: number;
	} | null;
}

export const CATALOG_STATUS_LABELS: Record<CatalogItemStatus, string> = {
	'active': 'Active',
	'maintenance': 'Under Maintenance',
	'archived': 'Archived'
};

export const CATALOG_STATUS_COLORS: Record<CatalogItemStatus, string> = {
	'active': '#10B981',
	'maintenance': '#F59E0B',
	'archived': '#6B7280'
};

// Deployment types
export type DeploymentType = 'saas' | 'self-hosted';

export interface UserDeploymentInfo {
	id: string;
	instanceUrl: string;
	deployedAt: Date;
}

export interface DeploymentResult {
	success: boolean;
	instanceUrl?: string;
	error?: string;
	deploymentId?: string;
}

export const DEPLOYMENT_TYPE_LABELS: Record<DeploymentType, string> = {
	'saas': 'SaaS / Shared URL',
	'self-hosted': 'Self-Hosted / Per-user'
};
