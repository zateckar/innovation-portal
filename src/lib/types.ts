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
