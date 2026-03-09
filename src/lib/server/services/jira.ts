import https from 'https';
import { db } from '$lib/server/db';
import { ideas, settings } from '$lib/server/db/schema';
import { isNotNull, eq } from 'drizzle-orm';

interface JiraAttachment {
	id: string;
	filename: string;
	mimeType: string;
	content: string; // URL to download
	size: number;
}

interface JiraIssue {
	id: string;
	key: string;
	self: string;
	fields: {
		summary: string;
		description: string | null;
		attachment: JiraAttachment[];
		creator?: {
			displayName: string;
			emailAddress?: string;
		};
		created: string;
		updated: string;
	};
}

interface JiraCredentials {
	jiraUrl: string;
	jiraApimSubscriptionKey: string | null;
	jiraMtlsCert: string | null;
	jiraMtlsKey: string | null;
}

interface ProcessedAttachments {
	images: string[]; // base64-encoded image data URIs
	textContent: string; // concatenated text from PDFs and text files
}

export class JiraService {
	private agentCache: { agent: https.Agent; cert: string | null; key: string | null } | null = null;

	/**
	 * Build (or reuse cached) mTLS HTTPS agent using PEM cert + key
	 */
	private buildAgent(cert: string | null, key: string | null): https.Agent {
		if (
			this.agentCache &&
			this.agentCache.cert === cert &&
			this.agentCache.key === key
		) {
			return this.agentCache.agent;
		}

		const agentOptions: https.AgentOptions = {
			rejectUnauthorized: false // Allow self-signed certs on on-prem Jira
		};

		if (cert && key) {
			agentOptions.cert = cert;
			agentOptions.key = key;
		}

		const agent = new https.Agent(agentOptions);
		this.agentCache = { agent, cert, key };
		return agent;
	}

	/**
	 * Build request headers including OCP-APIM-Subscription-Key
	 */
	private buildHeaders(apimKey: string | null): Record<string, string> {
		const headers: Record<string, string> = {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		};
		if (apimKey) {
			headers['OCP-APIM-Subscription-Key'] = apimKey;
		}
		return headers;
	}

	/**
	 * Make an authenticated HTTP request to the Jira API
	 */
	private async request<T>(
		url: string,
		credentials: JiraCredentials,
		options: { responseType?: 'json' | 'buffer' } = {}
	): Promise<T> {
		const agent = this.buildAgent(credentials.jiraMtlsCert, credentials.jiraMtlsKey);
		const headers = this.buildHeaders(credentials.jiraApimSubscriptionKey);

		return new Promise((resolve, reject) => {
			const req = https.get(url, { agent, headers }, (res) => {
				const chunks: Buffer[] = [];

				res.on('data', (chunk: Buffer) => chunks.push(chunk));
				res.on('end', () => {
					const buffer = Buffer.concat(chunks);

					if (options.responseType === 'buffer') {
						resolve(buffer as unknown as T);
						return;
					}

					// JSON response
					const text = buffer.toString('utf-8');
					if (res.statusCode && res.statusCode >= 400) {
						reject(new Error(`Jira API error ${res.statusCode}: ${text.slice(0, 500)}`));
						return;
					}

					try {
						resolve(JSON.parse(text) as T);
					} catch {
						reject(new Error(`Failed to parse Jira response: ${text.slice(0, 200)}`));
					}
				});
				res.on('error', reject);
			});

			req.on('error', reject);
			req.setTimeout(30000, () => {
				req.destroy(new Error('Jira request timed out'));
			});
		});
	}

	/**
	 * Fetch Jira issues by JQL query
	 */
	async fetchIssues(
		credentials: JiraCredentials,
		jql: string,
		maxResults: number
	): Promise<JiraIssue[]> {
		const encodedJql = encodeURIComponent(jql);
		const fields = 'summary,description,attachment,creator,created,updated';
		const url = `${credentials.jiraUrl}/rest/api/latest/search?jql=${encodedJql}&maxResults=${maxResults}&fields=${fields}`;

		console.log(`[Jira] Fetching issues with JQL: ${jql}`);

		const response = await this.request<{ issues: JiraIssue[]; total: number }>(
			url,
			credentials
		);

		console.log(`[Jira] Fetched ${response.issues.length} of ${response.total} issues`);
		return response.issues;
	}

	/**
	 * Download attachment bytes using mTLS agent and APIM header
	 */
	async downloadAttachment(
		attachmentUrl: string,
		credentials: JiraCredentials
	): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
		const buffer = await this.request<Buffer>(attachmentUrl, credentials, { responseType: 'buffer' });

		// Extract filename and mimeType from URL (Jira embeds them in the path)
		const urlParts = attachmentUrl.split('/');
		const filename = decodeURIComponent(urlParts[urlParts.length - 1]);

		// Determine mimeType from filename extension
		const ext = filename.split('.').pop()?.toLowerCase() || '';
		const mimeTypeMap: Record<string, string> = {
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			gif: 'image/gif',
			webp: 'image/webp',
			pdf: 'application/pdf',
			txt: 'text/plain',
			md: 'text/markdown'
		};
		const mimeType = mimeTypeMap[ext] || 'application/octet-stream';

		return { buffer, mimeType, filename };
	}

	/**
	 * Process attachments: images → base64, PDFs → text, .txt/.md → raw text, others → skip
	 */
	async processAttachments(
		attachments: JiraAttachment[],
		credentials: JiraCredentials
	): Promise<ProcessedAttachments> {
		const images: string[] = [];
		const textParts: string[] = [];

		for (const attachment of attachments) {
			try {
				const ext = attachment.filename.split('.').pop()?.toLowerCase() || '';
				const mimeType = attachment.mimeType.toLowerCase();

				const isImage =
					mimeType.startsWith('image/') ||
					['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
				const isPdf =
					mimeType === 'application/pdf' || ext === 'pdf';
				const isText =
					mimeType.startsWith('text/') || ['txt', 'md'].includes(ext);

				if (!isImage && !isPdf && !isText) {
					console.log(`[Jira] Skipping unsupported attachment: ${attachment.filename}`);
					continue;
				}

				console.log(`[Jira] Downloading attachment: ${attachment.filename}`);
				const { buffer } = await this.downloadAttachment(attachment.content, credentials);

				if (isImage) {
					const actualMimeType =
						ext === 'png' ? 'image/png' :
						ext === 'gif' ? 'image/gif' :
						ext === 'webp' ? 'image/webp' :
						'image/jpeg';
					const base64 = buffer.toString('base64');
					images.push(`data:${actualMimeType};base64,${base64}`);
				} else if (isPdf) {
					try {
						// pdf-parse is a CommonJS module; use createRequire for compatibility
						const { createRequire } = await import('module');
						const require = createRequire(import.meta.url);
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
						const pdfData = await pdfParse(buffer);
						if (pdfData.text) {
							textParts.push(`[PDF: ${attachment.filename}]\n${pdfData.text}`);
						}
					} catch (pdfError) {
						console.warn(`[Jira] Failed to parse PDF ${attachment.filename}:`, pdfError);
					}
				} else if (isText) {
					textParts.push(`[File: ${attachment.filename}]\n${buffer.toString('utf-8')}`);
				}
			} catch (error) {
				console.warn(`[Jira] Failed to process attachment ${attachment.filename}:`, error);
			}
		}

		return {
			images,
			textContent: textParts.join('\n\n')
		};
	}

	/**
	 * Test connectivity by calling GET /rest/api/2/myself
	 */
	async testConnection(credentials?: Partial<JiraCredentials>): Promise<{ success: boolean; message: string }> {
		let resolvedCredentials: JiraCredentials;

		if (
			credentials?.jiraUrl &&
			credentials.jiraUrl.length > 0
		) {
			resolvedCredentials = {
				jiraUrl: credentials.jiraUrl,
				jiraApimSubscriptionKey: credentials.jiraApimSubscriptionKey ?? null,
				jiraMtlsCert: credentials.jiraMtlsCert ?? null,
				jiraMtlsKey: credentials.jiraMtlsKey ?? null
			};
		} else {
			// Fall back to DB settings
			const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));
			if (!s?.jiraUrl) {
				return { success: false, message: 'Jira URL is not configured' };
			}
			resolvedCredentials = {
				jiraUrl: s.jiraUrl,
				jiraApimSubscriptionKey: s.jiraApimSubscriptionKey,
				jiraMtlsCert: s.jiraMtlsCert,
				jiraMtlsKey: s.jiraMtlsKey
			};
		}

		try {
			const url = `${resolvedCredentials.jiraUrl}/rest/api/latest/serverInfo`;
			const response = await this.request<{ serverTitle?: string; version?: string; baseUrl?: string }>(
				url,
				resolvedCredentials
			);
			const name = response.serverTitle || response.baseUrl || 'Jira';
			const version = response.version ? ` (v${response.version})` : '';
			return { success: true, message: `Connected successfully to ${name}${version}` };
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return { success: false, message: `Connection failed: ${msg}` };
		}
	}

	/**
	 * Get all Jira issue keys already imported (to prevent duplicates)
	 */
	async getAlreadyImportedKeys(): Promise<Set<string>> {
		const rows = await db
			.select({ jiraIssueKey: ideas.jiraIssueKey })
			.from(ideas)
			.where(isNotNull(ideas.jiraIssueKey));

		return new Set(rows.map((r) => r.jiraIssueKey as string));
	}

	/**
	 * Get Jira credentials from DB settings
	 */
	async getCredentials(): Promise<JiraCredentials | null> {
		const [s] = await db.select().from(settings).where(eq(settings.id, 'default'));
		if (!s?.jiraUrl) return null;
		return {
			jiraUrl: s.jiraUrl,
			jiraApimSubscriptionKey: s.jiraApimSubscriptionKey,
			jiraMtlsCert: s.jiraMtlsCert,
			jiraMtlsKey: s.jiraMtlsKey
		};
	}

	/**
	 * Invalidate the mTLS agent cache (call when settings change)
	 */
	clearCache(): void {
		this.agentCache = null;
	}
}

export type { JiraIssue, JiraAttachment, JiraCredentials, ProcessedAttachments };

export const jiraService = new JiraService();
