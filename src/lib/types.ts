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
	department: DepartmentCategory | null;
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
	'ai-ml': '#A78BFA',          // Violet — boosted for visibility
	'devops': '#22D3EE',          // Cyan — boosted
	'security': '#F87171',        // Rose-red — softened, more readable
	'data-analytics': '#FFC842',  // Amber — matches design system
	'developer-tools': '#34D399', // Emerald
	'automation': '#F472B6',      // Pink
	'collaboration': '#818CF8',   // Indigo
	'infrastructure': '#A3E635'   // Lime
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
	'rd': '#A78BFA',        // Violet — brighter
	'production': '#FFC842', // Amber — matches design system
	'hr': '#F472B6',        // Pink — brighter
	'legal': '#818CF8',     // Indigo — brighter
	'finance': '#34D399',   // Emerald — brighter
	'it': '#22D3EE',        // Cyan — brighter
	'purchasing': '#F87171', // Rose-red — softened
	'quality': '#A3E635',   // Lime
	'logistics': '#FB923C', // Orange — brighter
	'general': '#94A3B8'    // Slate — brighter than pure gray
};

/** Canonical ordered list of all valid department values. Single source of truth — import everywhere. */
export const DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as DepartmentCategory[];

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
	workspaceUuid?: string | null;
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
	// Autonomous build
	workspaceUuid: string | null;
	appRepoUrl: string | null;
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
	department: DepartmentCategory | null;
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

// Trends types
export type TrendCategoryGroup = 'automotive' | 'department' | 'it';
export type TrendMaturityLevel = 'emerging' | 'growing' | 'mature' | 'declining';
export type TrendTimeHorizon = 'near-term' | 'mid-term' | 'long-term';

export const TREND_CATEGORIES: Record<string, { label: string; group: TrendCategoryGroup; icon: string; color: string }> = {
	'automotive-general':  { label: 'Automotive Industry',        group: 'automotive', icon: '🚗', color: '#FF7D55' },
	'dept-rd':             { label: 'Research & Development',     group: 'department', icon: '🔬', color: '#A78BFA' },
	'dept-production':     { label: 'Production / Manufacturing', group: 'department', icon: '🏭', color: '#FFC842' },
	'dept-hr':             { label: 'Human Resources',            group: 'department', icon: '👥', color: '#F472B6' },
	'dept-legal':          { label: 'Legal',                      group: 'department', icon: '⚖️', color: '#818CF8' },
	'dept-finance':        { label: 'Finance & Accounting',       group: 'department', icon: '💰', color: '#34D399' },
	'dept-it':             { label: 'Information Technology',      group: 'department', icon: '💻', color: '#22D3EE' },
	'dept-purchasing':     { label: 'Purchasing / Procurement',   group: 'department', icon: '📦', color: '#F87171' },
	'dept-quality':        { label: 'Quality Assurance',          group: 'department', icon: '✅', color: '#A3E635' },
	'dept-logistics':      { label: 'Logistics & Supply Chain',   group: 'department', icon: '🚛', color: '#FB923C' },
	'dept-general-it':     { label: 'General IT',                 group: 'department', icon: '🖥️', color: '#94A3B8' },
	'it-compute':          { label: 'Compute',                    group: 'it',         icon: '⚡', color: '#F59E0B' },
	'it-storage':          { label: 'Storage',                    group: 'it',         icon: '💾', color: '#6366F1' },
	'it-data':             { label: 'Data',                       group: 'it',         icon: '📊', color: '#EC4899' },
	'it-ai':               { label: 'Artificial Intelligence',    group: 'it',         icon: '🤖', color: '#8B5CF6' },
	'it-identity':         { label: 'Identity & Access',          group: 'it',         icon: '🔑', color: '#14B8A6' },
	'it-integration':      { label: 'Integration',                group: 'it',         icon: '🔗', color: '#F97316' },
	'it-observability':    { label: 'Observability',              group: 'it',         icon: '👁️', color: '#06B6D4' },
	'it-security':         { label: 'Security',                   group: 'it',         icon: '🛡️', color: '#EF4444' },
	'it-governance':       { label: 'Governance',                 group: 'it',         icon: '📋', color: '#84CC16' },
	'it-sw-development':   { label: 'Software Development',       group: 'it',         icon: '🛠️', color: '#3B82F6' },
};

export const TREND_GROUP_LABELS: Record<TrendCategoryGroup, string> = {
	automotive: 'Automotive Industry',
	department: 'Enterprise Departments',
	it: 'IT Focus Areas'
};

export const TREND_GROUP_COLORS: Record<TrendCategoryGroup, string> = {
	automotive: '#FF7D55',
	department: '#00E5B8',
	it: '#93D9FF'
};

export const MATURITY_LABELS: Record<TrendMaturityLevel, string> = {
	emerging: 'Emerging',
	growing: 'Growing',
	mature: 'Mature',
	declining: 'Declining'
};

export const MATURITY_COLORS: Record<TrendMaturityLevel, string> = {
	emerging: '#8B5CF6',
	growing: '#10B981',
	mature: '#3B82F6',
	declining: '#F59E0B'
};

export interface TrendSummary {
	id: string;
	slug: string;
	category: string;
	categoryGroup: TrendCategoryGroup;
	title: string;
	summary: string;
	maturityLevel: TrendMaturityLevel | null;
	impactScore: number | null;
	timeHorizon: TrendTimeHorizon | null;
	publishedAt: Date | null;
	createdAt: Date | null;
}

export interface TrendDetail extends TrendSummary {
	content: string;
	keyInsights: string[];
	visualData: TrendVisualData | null;
	sources: { url: string; title?: string }[];
}

export interface TrendVisualData {
	timeline?: { year: number; event: string; type: 'past' | 'present' | 'future' }[];
	adoptionCurve?: { phase: string; percentage: number; current: boolean }[];
	impactDimensions?: { dimension: string; score: number }[];
	stats?: { label: string; value: string; trend: 'up' | 'down' | 'stable' }[];
}
