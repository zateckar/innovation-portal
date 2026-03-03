import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';
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
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	lastLoginAt: integer('last_login_at', { mode: 'timestamp' })
});

// Sessions table
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
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
	status: text('status', { enum: ['pending', 'accepted', 'rejected', 'processed'] }).default('pending'),
	aiFilterReason: text('ai_filter_reason')
});

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
	// Scan settings
	scanIntervalMinutes: integer('scan_interval_minutes').default(120),
	filterIntervalMinutes: integer('filter_interval_minutes').default(30),
	// Last updated
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
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
});

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

// Comments on innovations
export const comments = sqliteTable('comments', {
	id: text('id').primaryKey(),
	innovationId: text('innovation_id').notNull().references(() => innovations.id, { onDelete: 'cascade' }),
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
