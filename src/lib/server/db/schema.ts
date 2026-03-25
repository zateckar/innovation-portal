import { sqliteTable, text, integer, real, unique, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	avatarUrl: text('avatar_url'),
	role: text('role', { enum: ['user', 'admin'] }).default('user').notNull(),
	authProvider: text('auth_provider', { enum: ['local', 'oidc'] }).notNull(),
	passwordHash: text('password_hash'),
	oidcSubject: text('oidc_subject'),
	// Department preference — persisted per user for dashboard filtering
	// Enum must match DEPARTMENTS in src/lib/types.ts (schema.ts cannot import from app layer)
	department: text('department', {
		enum: ['rd', 'production', 'hr', 'legal', 'finance', 'it', 'purchasing', 'quality', 'logistics', 'general']
	}),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	lastLoginAt: integer('last_login_at', { mode: 'timestamp' })
});

// Sessions table
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	lastActiveAt: integer('last_active_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	// OIDC access token for API calls that require user's identity (e.g., deployments)
	accessToken: text('access_token'),
	// OIDC refresh token for refreshing access token
	refreshToken: text('refresh_token')
});

// News sources configuration
export const sources = sqliteTable('sources', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	type: text('type', { enum: ['rss', 'api', 'scrape'] }).notNull(),
	url: text('url').notNull(),
	config: text('config'), // JSON config
	enabled: integer('enabled', { mode: 'boolean' }).default(true),
	scanIntervalMinutes: integer('scan_interval_minutes').default(120),
	lastScannedAt: integer('last_scanned_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Raw feed items (before AI filtering)
export const rawItems = sqliteTable('raw_items', {
	id: text('id').primaryKey(),
	sourceId: text('source_id').references(() => sources.id),
	externalId: text('external_id'),
	title: text('title').notNull(),
	url: text('url').notNull(),
	content: text('content'),
	publishedAt: integer('published_at', { mode: 'timestamp' }),
	discoveredAt: integer('discovered_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	// 'failed' = accepted by filter but research encountered a transient error (can be retried)
	status: text('status', { enum: ['pending', 'accepted', 'rejected', 'processed', 'failed'] }).default('pending'),
	aiFilterReason: text('ai_filter_reason')
}, (table) => [
	// Index for frequent WHERE status = ? queries (e.g. filterPendingItems, researchAcceptedItems)
	index('raw_items_status_idx').on(table.status),
	// Index for per-source duplicate checks (scanRssFeed batch query)
	index('raw_items_source_idx').on(table.sourceId)
]);

// System settings (singleton row with id='default')
export const settings = sqliteTable('settings', {
	id: text('id').primaryKey().default('default'),
	// Filtering criteria - custom prompt for AI
	filterPrompt: text('filter_prompt'),
	researchPrompt: text('research_prompt'),
	// Auto-mode settings
	autoModeEnabled: integer('auto_mode_enabled', { mode: 'boolean' }).default(false),
	autoPublishThreshold: real('auto_publish_threshold').default(7.0), // Min avg score to auto-publish
	autoInnovationsPerRun: integer('auto_innovations_per_run').default(3),
	autoRunIntervalMinutes: integer('auto_run_interval_minutes').default(60),
	// Dedicated last-run timestamp for auto mode (separate from scanLastRunAt)
	autoModeLastRunAt: integer('auto_mode_last_run_at', { mode: 'timestamp' }),
	// Scan settings
	scanEnabled: integer('scan_enabled', { mode: 'boolean' }).default(true),
	scanIntervalMinutes: integer('scan_interval_minutes').default(120),
	scanLastRunAt: integer('scan_last_run_at', { mode: 'timestamp' }),
	// Filter settings
	filterEnabled: integer('filter_enabled', { mode: 'boolean' }).default(true),
	filterIntervalMinutes: integer('filter_interval_minutes').default(30),
	filterLastRunAt: integer('filter_last_run_at', { mode: 'timestamp' }),
	// Research settings
	researchEnabled: integer('research_enabled', { mode: 'boolean' }).default(true),
	researchIntervalMinutes: integer('research_interval_minutes').default(60),
	researchLastRunAt: integer('research_last_run_at', { mode: 'timestamp' }),
	// Archive settings - auto-archive innovations with no votes
	archiveEnabled: integer('archive_enabled', { mode: 'boolean' }).default(false),
	archiveNoVotesDays: integer('archive_no_votes_days').default(14),
	archiveIntervalMinutes: integer('archive_interval_minutes').default(60),
	archiveLastRunAt: integer('archive_last_run_at', { mode: 'timestamp' }),
	// Cleanup settings - auto-remove old feed items
	cleanupEnabled: integer('cleanup_enabled', { mode: 'boolean' }).default(false),
	cleanupOlderThanDays: integer('cleanup_older_than_days').default(7),
	cleanupIntervalMinutes: integer('cleanup_interval_minutes').default(60),
	cleanupLastRunAt: integer('cleanup_last_run_at', { mode: 'timestamp' }),
	// News generation settings
	newsPrompt: text('news_prompt'),
	newsEnabled: integer('news_enabled', { mode: 'boolean' }).default(false),
	newsIntervalMinutes: integer('news_interval_minutes').default(1440),
	newsLastRunAt: integer('news_last_run_at', { mode: 'timestamp' }),
	newsDepartments: text('news_departments'), // JSON array of department keys
	newsPerDepartment: integer('news_per_department').default(1), // How many digests to generate per department per run
	// Ideas generation settings
	ideasPrompt: text('ideas_prompt'),
	ideasEnabled: integer('ideas_enabled', { mode: 'boolean' }).default(false),
	ideasIntervalMinutes: integer('ideas_interval_minutes').default(1440),
	ideasLastRunAt: integer('ideas_last_run_at', { mode: 'timestamp' }),
	ideasDepartments: text('ideas_departments'), // JSON array of department keys
	ideasPerBatch: integer('ideas_per_batch').default(5),
	ideasAutoRealize: integer('ideas_auto_realize', { mode: 'boolean' }).default(true),
	evaluationPrompt: text('evaluation_prompt'),
	realizationPrompt: text('realization_prompt'),
	// LLM settings (previously env vars)
	llmApiKey: text('llm_api_key'),
	llmModel: text('llm_model').default('models/gemini-3-flash-preview'),
	// OIDC settings (previously env vars)
	oidcIssuer: text('oidc_issuer'),
	oidcClientId: text('oidc_client_id'),
	oidcClientSecret: text('oidc_client_secret'),
	oidcEnabled: integer('oidc_enabled', { mode: 'boolean' }).default(false),
	// Jira integration settings
	jiraEnabled: integer('jira_enabled', { mode: 'boolean' }).default(false),
	jiraUrl: text('jira_url'), // API base URL e.g. https://jira-api.company.com (used for REST calls)
	jiraWebHostname: text('jira_web_hostname'), // Web hostname for issue links e.g. https://jira.company.com (used for /browse/ links)
	jiraApimSubscriptionKey: text('jira_apim_subscription_key'), // OCP-APIM-Subscription-Key header value
	jiraMtlsCert: text('jira_mtls_cert'), // PEM-encoded client certificate
	jiraMtlsKey: text('jira_mtls_key'), // PEM-encoded client private key
	jiraJql: text('jira_jql'), // JQL query
	jiraIntervalMinutes: integer('jira_interval_minutes').default(1440),
	jiraLastRunAt: integer('jira_last_run_at', { mode: 'timestamp' }),
	jiraMaxIssuesPerRun: integer('jira_max_issues_per_run').default(20),
	jiraExtractionPrompt: text('jira_extraction_prompt'),
	jiraProjectKey: text('jira_project_key'),
	// Development stage settings
	ideaVoteThreshold: integer('idea_vote_threshold').default(5),
	techStackRules: text('tech_stack_rules'),
	// Azure DevOps integration
	adoEnabled: integer('ado_enabled', { mode: 'boolean' }).default(false),
	adoOrgUrl: text('ado_org_url'),
	adoProject: text('ado_project'),
	adoRepoId: text('ado_repo_id'),
	adoPat: text('ado_pat'),
	adoTargetBranch: text('ado_target_branch').default('main'),
	// Logging settings (runtime-configurable via admin UI)
	logLevel: text('log_level', { enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'] }).default('INFO'),
	// Only updated on explicit settings saves (not on partial updates like updateScanLastRun)
	settingsChangedAt: integer('settings_changed_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Innovations (curated, researched)
export const innovations = sqliteTable('innovations', {
	id: text('id').primaryKey(),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	tagline: text('tagline').notNull(),
	category: text('category', {
		enum: ['ai-ml', 'devops', 'security', 'data-analytics', 'developer-tools', 'automation', 'collaboration', 'infrastructure']
	}).notNull(),
	// Department relevance — which department this innovation is most relevant to
	department: text('department', {
		enum: ['rd', 'production', 'hr', 'legal', 'finance', 'it', 'purchasing', 'quality', 'logistics', 'general']
	}).default('general'),
	
	// Research content (JSON)
	researchData: text('research_data').notNull(),
	
	// Scores
	relevanceScore: real('relevance_score'),
	innovationScore: real('innovation_score'),
	actionabilityScore: real('actionability_score'),
	
	// Metadata
	heroImageUrl: text('hero_image_url'),
	isOpenSource: integer('is_open_source', { mode: 'boolean' }).default(false),
	isSelfHosted: integer('is_self_hosted', { mode: 'boolean' }).default(false),
	hasAiComponent: integer('has_ai_component', { mode: 'boolean' }).default(false),
	maturityLevel: text('maturity_level', { enum: ['experimental', 'beta', 'stable', 'mature'] }),
	license: text('license'),
	githubUrl: text('github_url'),
	documentationUrl: text('documentation_url'),
	
	// Status
	status: text('status', { enum: ['pending', 'published', 'promoted', 'archived'] }).default('pending'),
	submittedBy: text('submitted_by').references(() => users.id),
	
	// Timestamps
	discoveredAt: integer('discovered_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	researchedAt: integer('researched_at', { mode: 'timestamp' }),
	publishedAt: integer('published_at', { mode: 'timestamp' }),
	promotedAt: integer('promoted_at', { mode: 'timestamp' })
});

// Votes
export const votes = sqliteTable('votes', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	innovationId: text('innovation_id').notNull().references(() => innovations.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
	// Prevent duplicate votes from the same user on the same innovation
	unique().on(table.userId, table.innovationId)
]);

// Tags
export const tags = sqliteTable('tags', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	color: text('color')
});

// Innovation tags junction table
export const innovationTags = sqliteTable('innovation_tags', {
	innovationId: text('innovation_id').notNull().references(() => innovations.id, { onDelete: 'cascade' }),
	tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' })
});

// Innovation sources/references
export const innovationSources = sqliteTable('innovation_sources', {
	id: text('id').primaryKey(),
	innovationId: text('innovation_id').references(() => innovations.id, { onDelete: 'cascade' }),
	rawItemId: text('raw_item_id').references(() => rawItems.id),
	url: text('url').notNull(),
	title: text('title'),
	sourceType: text('source_type', { enum: ['original', 'related', 'documentation'] }),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Comments on innovations, ideas, and catalog items
// NOTE: Exactly one of (innovationId, ideaId, catalogItemId) must be non-null.
// This constraint is enforced at the application level. A CHECK constraint requiring
// exactly one non-null FK cannot be expressed in Drizzle syntax and would need a raw
// SQL migration (ALTER TABLE comments ADD CHECK (...)) if strict enforcement is desired.
export const comments = sqliteTable('comments', {
	id: text('id').primaryKey(),
	// At least one of these must be set (enforced at application level)
	innovationId: text('innovation_id').references(() => innovations.id, { onDelete: 'cascade' }),
	ideaId: text('idea_id').references(() => ideas.id, { onDelete: 'cascade' }),
	catalogItemId: text('catalog_item_id').references(() => catalogItems.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	parentId: text('parent_id'), // For threaded replies
	content: text('content').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

// Activity log
export const activityLog = sqliteTable('activity_log', {
	id: text('id').primaryKey(),
	userId: text('user_id').references(() => users.id),
	action: text('action').notNull(),
	targetType: text('target_type'),
	targetId: text('target_id'),
	metadata: text('metadata'), // JSON
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// News - AI-researched news digests for departments
export const news = sqliteTable('news', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	slug: text('slug').notNull().unique(),
	summary: text('summary').notNull(),
	content: text('content').notNull(), // Full article in markdown
	category: text('category', {
		enum: ['rd', 'production', 'hr', 'legal', 'finance', 'it', 'purchasing', 'quality', 'logistics', 'general']
	}).notNull(),
	sources: text('sources'), // JSON array of source URLs/references
	relevanceScore: integer('relevance_score'),
	aiPromptUsed: text('ai_prompt_used'),
	status: text('status', { enum: ['draft', 'published', 'archived'] }).default('draft').notNull(),
	publishedAt: integer('published_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Ideas - AI-generated innovation proposals
export const ideas = sqliteTable('ideas', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	slug: text('slug').notNull().unique(),
	summary: text('summary').notNull(),
	problem: text('problem').notNull(),
	solution: text('solution').notNull(), // Markdown
	department: text('department', {
		enum: ['rd', 'production', 'hr', 'legal', 'finance', 'it', 'purchasing', 'quality', 'logistics', 'general']
	}).notNull(),
	researchData: text('research_data'), // JSON: benefits, feasibility, costs, timeline, risks
	evaluationScore: real('evaluation_score'),
	evaluationDetails: text('evaluation_details'), // JSON: impact, feasibility, cost, innovation, urgency scores
	realizationHtml: text('realization_html'), // Self-contained working PoC (HTML+JS, no dependencies)
	realizationDiagram: text('realization_diagram'), // Mermaid diagram source
	realizationNotes: text('realization_notes'), // Markdown
	realizationCode: text('realization_code'), // JSON: array of {path, language, content} project scaffold files
	status: text('status', { enum: ['draft', 'evaluated', 'realized', 'published', 'archived'] }).default('draft').notNull(),
	// Development stage fields
	specStatus: text('spec_status', { enum: ['not_started', 'in_progress', 'completed'] }).default('not_started').notNull(),
	specDocument: text('spec_document'),
	specReviewStatus: text('spec_review_status', { enum: ['not_ready', 'under_review', 'published'] }).default('not_ready').notNull(),
	adoPrUrl: text('ado_pr_url'),
	jiraEscalationKey: text('jira_escalation_key'),
	batchId: text('batch_id'), // Groups ideas from same generation run
	rank: integer('rank'), // Rank within batch (1 = best)
	aiPromptUsed: text('ai_prompt_used'),
	// Jira integration fields
	source: text('source', { enum: ['ai', 'jira', 'user'] }).default('ai').notNull(),
	jiraIssueKey: text('jira_issue_key').unique(), // e.g. PROJ-123
	jiraIssueUrl: text('jira_issue_url'), // Full URL shown to users
	// User proposal fields
	proposedBy: text('proposed_by').references(() => users.id),
	proposedByEmail: text('proposed_by_email'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Idea votes
export const ideaVotes = sqliteTable('idea_votes', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	ideaId: text('idea_id').notNull().references(() => ideas.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
	unique().on(table.userId, table.ideaId)
]);

// Idea development stage chat messages
export const ideaChats = sqliteTable('idea_chats', {
	id: text('id').primaryKey(),
	ideaId: text('idea_id').notNull().references(() => ideas.id, { onDelete: 'cascade' }),
	role: text('role', { enum: ['ai', 'user'] }).notNull(),
	userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
	content: text('content').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Spec version history — snapshot before each AI edit
export const specVersions = sqliteTable('spec_versions', {
	id: text('id').primaryKey(),
	ideaId: text('idea_id').notNull().references(() => ideas.id, { onDelete: 'cascade' }),
	versionNumber: integer('version_number').notNull(),
	content: text('content').notNull(),
	authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
	changeDescription: text('change_description'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}, (table) => [
	index('spec_versions_idea_idx').on(table.ideaId)
]);

// Incubator Catalog - implemented innovations ready for users to try
export const catalogItems = sqliteTable('catalog_items', {
	id: text('id').primaryKey(),
	// Reference to original innovation (optional - can be added manually)
	innovationId: text('innovation_id').references(() => innovations.id, { onDelete: 'set null' }),
	
	// Basic info
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	description: text('description').notNull(),
	category: text('category', {
		enum: ['ai-ml', 'devops', 'security', 'data-analytics', 'developer-tools', 'automation', 'collaboration', 'infrastructure']
	}).notNull(),
	// Department relevance — which department this catalog item is most relevant to
	department: text('department', {
		enum: ['rd', 'production', 'hr', 'legal', 'finance', 'it', 'purchasing', 'quality', 'logistics', 'general']
	}).default('general'),
	
	// Implementation details
	url: text('url').notNull(), // URL where users can access/try the implementation (for SaaS) or placeholder (for self-hosted)
	howTo: text('how_to').notNull(), // Instructions for users (markdown)
	
	// Visual
	iconUrl: text('icon_url'),
	screenshotUrl: text('screenshot_url'),
	
	// Status
	status: text('status', { enum: ['active', 'maintenance', 'archived'] }).default('active').notNull(),
	
	// Deployment type: 'saas' = shared URL for all users, 'self-hosted' = each user gets their own deployment
	deploymentType: text('deployment_type', { enum: ['saas', 'self-hosted'] }).default('saas').notNull(),
	
	// Self-hosted deployment configuration (only used when deploymentType = 'self-hosted')
	// K8s manifest template with variables like {{username}}, {{user_id}}, {{email}}, etc.
	deploymentManifest: text('deployment_manifest'),
	// REST API endpoint that accepts the K8s manifest (POST)
	deploymentApiUrl: text('deployment_api_url'),
	// URL template for user instances (e.g., "https://{{username}}.apps.example.com")
	instanceUrlTemplate: text('instance_url_template'),
	// Optional: manifest for cleanup/undeploy
	undeployManifest: text('undeploy_manifest'),
	
	// Metadata
	addedBy: text('added_by').references(() => users.id),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	archivedAt: integer('archived_at', { mode: 'timestamp' })
});

// User deployments - tracks deployed instances for self-hosted catalog items
export const userDeployments = sqliteTable('user_deployments', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	catalogItemId: text('catalog_item_id').notNull().references(() => catalogItems.id, { onDelete: 'cascade' }),
	// The resolved instance URL for this user's deployment
	instanceUrl: text('instance_url').notNull(),
	// Timestamp when deployment was created
	deployedAt: integer('deployed_at', { mode: 'timestamp' }).notNull(),
	// Stored resolved variables (JSON) - useful for undeploy
	deploymentVariables: text('deployment_variables'),
}, (table) => [
	// One deployment per user per catalog item
	unique().on(table.userId, table.catalogItemId)
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	votes: many(votes),
	ideaVotes: many(ideaVotes),
	sessions: many(sessions),
	innovations: many(innovations),
	activities: many(activityLog),
	comments: many(comments)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	})
}));

export const innovationsRelations = relations(innovations, ({ one, many }) => ({
	submitter: one(users, {
		fields: [innovations.submittedBy],
		references: [users.id]
	}),
	votes: many(votes),
	tags: many(innovationTags),
	sources: many(innovationSources),
	comments: many(comments)
}));

export const votesRelations = relations(votes, ({ one }) => ({
	user: one(users, {
		fields: [votes.userId],
		references: [users.id]
	}),
	innovation: one(innovations, {
		fields: [votes.innovationId],
		references: [innovations.id]
	})
}));

export const tagsRelations = relations(tags, ({ many }) => ({
	innovations: many(innovationTags)
}));

export const innovationTagsRelations = relations(innovationTags, ({ one }) => ({
	innovation: one(innovations, {
		fields: [innovationTags.innovationId],
		references: [innovations.id]
	}),
	tag: one(tags, {
		fields: [innovationTags.tagId],
		references: [tags.id]
	})
}));

export const innovationSourcesRelations = relations(innovationSources, ({ one }) => ({
	innovation: one(innovations, {
		fields: [innovationSources.innovationId],
		references: [innovations.id]
	}),
	rawItem: one(rawItems, {
		fields: [innovationSources.rawItemId],
		references: [rawItems.id]
	})
}));

export const sourcesRelations = relations(sources, ({ many }) => ({
	rawItems: many(rawItems)
}));

export const rawItemsRelations = relations(rawItems, ({ one }) => ({
	source: one(sources, {
		fields: [rawItems.sourceId],
		references: [sources.id]
	})
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
	innovation: one(innovations, {
		fields: [comments.innovationId],
		references: [innovations.id]
	}),
	idea: one(ideas, {
		fields: [comments.ideaId],
		references: [ideas.id]
	}),
	catalogItem: one(catalogItems, {
		fields: [comments.catalogItemId],
		references: [catalogItems.id]
	}),
	user: one(users, {
		fields: [comments.userId],
		references: [users.id]
	}),
	parent: one(comments, {
		fields: [comments.parentId],
		references: [comments.id],
		relationName: 'parent'
	}),
	replies: many(comments, { relationName: 'parent' })
}));

export const catalogItemsRelations = relations(catalogItems, ({ one, many }) => ({
	innovation: one(innovations, {
		fields: [catalogItems.innovationId],
		references: [innovations.id]
	}),
	addedByUser: one(users, {
		fields: [catalogItems.addedBy],
		references: [users.id]
	}),
	deployments: many(userDeployments)
}));

export const userDeploymentsRelations = relations(userDeployments, ({ one }) => ({
	user: one(users, {
		fields: [userDeployments.userId],
		references: [users.id]
	}),
	catalogItem: one(catalogItems, {
		fields: [userDeployments.catalogItemId],
		references: [catalogItems.id]
	})
}));

export const newsRelations = relations(news, () => ({}));

export const ideasRelations = relations(ideas, ({ one, many }) => ({
	votes: many(ideaVotes),
	chats: many(ideaChats),
	proposer: one(users, {
		fields: [ideas.proposedBy],
		references: [users.id]
	})
}));

export const ideaChatsRelations = relations(ideaChats, ({ one }) => ({
	idea: one(ideas, { fields: [ideaChats.ideaId], references: [ideas.id] }),
	user: one(users, { fields: [ideaChats.userId], references: [users.id] })
}));

export const ideaVotesRelations = relations(ideaVotes, ({ one }) => ({
	user: one(users, {
		fields: [ideaVotes.userId],
		references: [users.id]
	}),
	idea: one(ideas, {
		fields: [ideaVotes.ideaId],
		references: [ideas.id]
	})
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type RawItem = typeof rawItems.$inferSelect;
export type NewRawItem = typeof rawItems.$inferInsert;
export type Innovation = typeof innovations.$inferSelect;
export type NewInnovation = typeof innovations.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type CatalogItem = typeof catalogItems.$inferSelect;
export type NewCatalogItem = typeof catalogItems.$inferInsert;
export type UserDeployment = typeof userDeployments.$inferSelect;
export type NewUserDeployment = typeof userDeployments.$inferInsert;
export type News = typeof news.$inferSelect;
export type NewNews = typeof news.$inferInsert;
export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
export type IdeaVote = typeof ideaVotes.$inferSelect;
export type NewIdeaVote = typeof ideaVotes.$inferInsert;
export type IdeaChat = typeof ideaChats.$inferSelect;
export type NewIdeaChat = typeof ideaChats.$inferInsert;
