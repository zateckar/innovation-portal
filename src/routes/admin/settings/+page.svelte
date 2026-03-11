<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button } from '$lib/components/ui';
	let { data, form } = $props();
	
	let saving = $state(false);
	let resetting = $state(false);
	let testingJira = $state(false);
	let jiraTestResult = $state<{ success: boolean; message: string } | null>(null);
	
	const currentSettings = $derived(form?.settings ?? data.settings);
	
	// Default prompts for reference
	const defaultFilterPrompt = `You are an innovation scout for an automotive company modernizing their IT infrastructure (7000 office workers, 25000 assembly workers).

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

	const defaultResearchPrompt = `You are a technology analyst researching innovations for an automotive company modernizing their IT.`;

	const defaultNewsPrompt = `You are an AI research assistant for a legacy automotive manufacturer undergoing digital transformation.
Your task is to find and summarize the most relevant recent news, trends, and developments for the {department} department.`;

	const defaultIdeasPrompt = `You are an innovation consultant for a legacy automotive manufacturer undergoing digital transformation.
Generate {count} concrete, actionable innovation ideas for the {department} department.`;

	const defaultEvaluationPrompt = `You are a technology evaluation expert for an automotive manufacturing company. Perform a deep evaluation of the following innovation idea.`;

	const defaultRealizationPrompt = `You are an expert UI/UX designer and solution architect for an automotive manufacturing company. Your task is to create a realistic visualization of what an innovation idea would look like when fully realized.`;

	const defaultJiraExtractionPrompt = `You are an innovation analyst extracting a structured innovation idea from a Jira issue submitted by an employee.

Read all available content (title, description, and any attachment text/images) and extract the following:
1. A concise title (≤ 80 chars)
2. A one-paragraph summary
3. The specific problem this idea addresses
4. The proposed solution in detail
5. The most fitting department from this list: rd, production, hr, legal, finance, it, purchasing, quality, logistics, general`;

	let jiraUrlInput = $state('');
	let jiraApimKeyInput = $state('');
	let jiraMtlsCertInput = $state('');
	let jiraMtlsKeyInput = $state('');

	$effect(() => {
		jiraUrlInput = currentSettings.jiraUrl || '';
		jiraApimKeyInput = currentSettings.jiraApimSubscriptionKey || '';
		jiraMtlsCertInput = currentSettings.jiraMtlsCert || '';
		jiraMtlsKeyInput = currentSettings.jiraMtlsKey || '';
	});

	async function testJiraConnection() {
		testingJira = true;
		jiraTestResult = null;
		try {
			const res = await fetch('/api/admin/jira/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jiraUrl: jiraUrlInput,
					jiraApimSubscriptionKey: jiraApimKeyInput,
					jiraMtlsCert: jiraMtlsCertInput,
					jiraMtlsKey: jiraMtlsKeyInput
				})
			});
			jiraTestResult = await res.json();
		} catch (e) {
			jiraTestResult = { success: false, message: 'Network error while testing connection' };
		} finally {
			testingJira = false;
		}
	}
</script>

<svelte:head>
	<title>AI Settings - Innovation Radar</title>
</svelte:head>

<div class="max-w-3xl space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">AI & Automation</h1>
		<p class="text-text-secondary mt-1">Configure AI filtering criteria and automatic mode</p>
	</div>
	
	{#if form?.success}
		<div class="p-4 rounded-lg bg-success/10 border border-success/30 text-success">
			{form.message}
		</div>
	{/if}
	
	{#if form?.error}
		<div class="p-4 rounded-lg bg-error/10 border border-error/30 text-error">
			{form.error}
		</div>
	{/if}
	
	<form
		class="space-y-6"
		method="POST" 
		action="?/save"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
	>
		<!-- AI Filter Criteria -->
		<Card padding="lg" class="mb-6">
			<h2 class="text-xl font-semibold text-text-primary mb-4">AI Filter Criteria</h2>
			<p class="text-text-secondary mb-4">
				Customize the AI prompt used to filter incoming articles and determine relevance. 
				This controls what types of innovations the system looks for.
			</p>
			
			<div class="space-y-4">
				<div>
					<label for="filterPrompt" class="block text-sm font-medium text-text-secondary mb-2">
						Filter Prompt
					</label>
					<textarea
						id="filterPrompt"
						name="filterPrompt"
						rows="12"
						class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
						placeholder={defaultFilterPrompt}
					>{currentSettings.filterPrompt || ''}</textarea>
					<p class="text-xs text-text-muted mt-2">
						Leave empty to use the default prompt. Include criteria like industry focus, technology preferences, and what to reject.
					</p>
				</div>
				
				<div>
					<label for="researchPrompt" class="block text-sm font-medium text-text-secondary mb-2">
						Research Context Prompt
					</label>
					<textarea
						id="researchPrompt"
						name="researchPrompt"
						rows="4"
						class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
						placeholder={defaultResearchPrompt}
					>{currentSettings.researchPrompt || ''}</textarea>
					<p class="text-xs text-text-muted mt-2">
						Context provided to the AI when researching and creating detailed reports for innovations.
					</p>
				</div>
			</div>
			
			<div class="mt-4 pt-4 border-t border-border">
				<details class="text-sm">
					<summary class="text-text-secondary cursor-pointer hover:text-text-primary">
						View default prompts (click to expand)
					</summary>
					<div class="mt-4 space-y-4">
						<div>
							<h4 class="font-medium text-text-primary mb-2">Default Filter Prompt:</h4>
							<pre class="p-3 bg-bg-hover rounded-lg text-xs text-text-secondary whitespace-pre-wrap">{defaultFilterPrompt}</pre>
						</div>
						<div>
							<h4 class="font-medium text-text-primary mb-2">Default Research Prompt:</h4>
							<pre class="p-3 bg-bg-hover rounded-lg text-xs text-text-secondary whitespace-pre-wrap">{defaultResearchPrompt}</pre>
						</div>
					</div>
				</details>
			</div>
		</Card>
		
	<!-- News Generation Settings -->
		<Card padding="lg" class="mb-6">
			<h2 class="text-xl font-semibold text-text-primary mb-4">News Generation</h2>
			
			<p class="text-text-secondary mb-6">
				AI-curated news digests per department, compiled from real innovations already in the radar (feed-scanned and researched). The AI selects and summarises the most relevant items — it does not invent content.
			</p>
			<p class="text-xs text-text-muted mb-4">
				Enable/disable, set interval, and choose departments in
				<a href="/admin/schedule" class="text-primary hover:underline">Schedule</a>.
			</p>
			
			<div>
				<label for="newsPrompt" class="block text-sm font-medium text-text-secondary mb-2">
					News Prompt
				</label>
				<textarea
					id="newsPrompt"
					name="newsPrompt"
					rows="8"
					class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
					placeholder={defaultNewsPrompt}
				>{currentSettings.newsPrompt || ''}</textarea>
				<p class="text-xs text-text-muted mt-2">
					Leave empty to use the default prompt. Use {'{department}'} as a placeholder for the department name.
				</p>
			</div>
		</Card>
		
		<!-- Ideas Generation Settings -->
		<Card padding="lg" class="mb-6">
			<h2 class="text-xl font-semibold text-text-primary mb-4">Ideas Generation</h2>
			
			<p class="text-text-secondary mb-6">
				AI-generated innovation ideas evaluated and realized with mockups for practical understanding.
			</p>
			<p class="text-xs text-text-muted mb-4">
				Enable/disable, set interval, per-batch count, auto-realize, and choose departments in
				<a href="/admin/schedule" class="text-primary hover:underline">Schedule</a>.
			</p>
			
			<div class="space-y-4">
			<div>
				<label for="ideasPrompt" class="block text-sm font-medium text-text-secondary mb-2">
					Ideas Generation Prompt
				</label>
				<textarea
					id="ideasPrompt"
					name="ideasPrompt"
					rows="8"
					class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
					placeholder={defaultIdeasPrompt}
				>{currentSettings.ideasPrompt || ''}</textarea>
				<p class="text-xs text-text-muted mt-2">
					Leave empty to use the default prompt. Use {'{department}'} and {'{count}'} as placeholders.
				</p>
			</div>

			<div>
				<label for="evaluationPrompt" class="block text-sm font-medium text-text-secondary mb-2">
					Idea Evaluation Prompt
				</label>
				<textarea
					id="evaluationPrompt"
					name="evaluationPrompt"
					rows="4"
					class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
					placeholder={defaultEvaluationPrompt}
				>{currentSettings.evaluationPrompt || ''}</textarea>
				<p class="text-xs text-text-muted mt-2">
					Context provided to the AI when scoring ideas across impact, feasibility, cost-effectiveness, innovation, and urgency. Leave empty to use the default.
				</p>
			</div>

			<div>
				<label for="realizationPrompt" class="block text-sm font-medium text-text-secondary mb-2">
					Idea Realization Prompt
				</label>
				<textarea
					id="realizationPrompt"
					name="realizationPrompt"
					rows="4"
					class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
					placeholder={defaultRealizationPrompt}
				>{currentSettings.realizationPrompt || ''}</textarea>
				<p class="text-xs text-text-muted mt-2">
					Context provided to the AI when generating HTML mockups, architecture diagrams, and implementation notes for realized ideas. Leave empty to use the default.
				</p>
			</div>
			</div>
		</Card>

		<!-- Jira Integration Settings -->
		<Card padding="lg" class="mb-6">
			<h2 class="text-xl font-semibold text-text-primary mb-4">Jira Integration</h2>

			<p class="text-text-secondary mb-6">
				Automatically import ideas from a Jira project. Jira issues go through the full pipeline (draft → evaluated → realized → published). Requires on-premise Jira Server / Data Center with REST API v2.
			</p>
			<p class="text-xs text-text-muted mb-4">
				Enable/disable, set fetch interval and max issues per run in
				<a href="/admin/schedule" class="text-primary hover:underline">Schedule</a>.
			</p>

			<div class="space-y-4">
				<!-- Jira Base URL -->
				<div>
					<label for="jiraUrl" class="block text-sm font-medium text-text-secondary mb-2">
						Jira Base URL
					</label>
					<input
						type="url"
						id="jiraUrl"
						name="jiraUrl"
						bind:value={jiraUrlInput}
						placeholder="https://jira.company.com"
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">Base URL without trailing slash (e.g. https://jira.company.com)</p>
				</div>

				<!-- OCP-APIM Subscription Key -->
				<div>
					<label for="jiraApimSubscriptionKey" class="block text-sm font-medium text-text-secondary mb-2">
						OCP-APIM-Subscription-Key
					</label>
					<input
						type="password"
						id="jiraApimSubscriptionKey"
						name="jiraApimSubscriptionKey"
						bind:value={jiraApimKeyInput}
						placeholder="Enter API gateway subscription key"
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">
						Currently stored: {currentSettings.jiraApimSubscriptionKey ? '••••••••' : 'Not set'}
					</p>
				</div>

				<!-- mTLS Client Certificate -->
				<div>
					<label for="jiraMtlsCert" class="block text-sm font-medium text-text-secondary mb-2">
						Client Certificate (PEM)
					</label>
					<textarea
						id="jiraMtlsCert"
						name="jiraMtlsCert"
						rows="6"
						bind:value={jiraMtlsCertInput}
						placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
						class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-xs"
					>{currentSettings.jiraMtlsCert || ''}</textarea>
					<p class="text-xs text-text-muted mt-1">PEM-encoded client certificate for mTLS authentication</p>
				</div>

				<!-- mTLS Client Private Key -->
				<div>
					<label for="jiraMtlsKey" class="block text-sm font-medium text-text-secondary mb-2">
						Client Private Key (PEM)
					</label>
					<textarea
						id="jiraMtlsKey"
						name="jiraMtlsKey"
						rows="6"
						bind:value={jiraMtlsKeyInput}
						placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
						class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-xs"
					>{currentSettings.jiraMtlsKey || ''}</textarea>
					<p class="text-xs text-text-muted mt-1">PEM-encoded client private key (kept secret, never exposed to browser)</p>
				</div>

			<!-- JQL Query -->
			<div>
				<label for="jiraJql" class="block text-sm font-medium text-text-secondary mb-2">
					JQL Query
				</label>
				<textarea
					id="jiraJql"
					name="jiraJql"
					rows="3"
					class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
					placeholder="project = INNOV AND status != Done ORDER BY created DESC"
				>{currentSettings.jiraJql || ''}</textarea>
				<p class="text-xs text-text-muted mt-1">JQL query to select issues to import (e.g. project = INNOV AND status != Done)</p>
			</div>

			<!-- Jira Extraction Prompt -->
			<div>
				<label for="jiraExtractionPrompt" class="block text-sm font-medium text-text-secondary mb-2">
					Jira Idea Extraction Prompt
				</label>
				<textarea
					id="jiraExtractionPrompt"
					name="jiraExtractionPrompt"
					rows="8"
					class="w-full px-4 py-3 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono text-sm"
					placeholder={defaultJiraExtractionPrompt}
				>{currentSettings.jiraExtractionPrompt || ''}</textarea>
				<p class="text-xs text-text-muted mt-1">
					Instructions given to the AI when extracting a structured innovation idea from a Jira issue's title, description, and attachments. Leave empty to use the default.
				</p>
			</div>

				<!-- Test connection button + result -->
				<div class="flex items-center gap-4 pt-2">
					<button
						type="button"
						onclick={testJiraConnection}
						disabled={testingJira}
						class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-hover hover:bg-bg-surface border border-border text-text-secondary hover:text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
					>
						{#if testingJira}
							<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Testing...
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
							</svg>
							Test Connection
						{/if}
					</button>
					{#if jiraTestResult}
						<span class="text-sm {jiraTestResult.success ? 'text-success' : 'text-error'}">
							{jiraTestResult.success ? '✓' : '✗'} {jiraTestResult.message}
						</span>
					{/if}
				</div>
			</div>
		</Card>

		<!-- LLM Settings -->
		<Card padding="lg" class="mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold text-text-primary">LLM Settings</h2>
			</div>
			
			<p class="text-text-secondary mb-6">
				Configure the LLM provider for AI features. These settings can also be set via environment variables.
			</p>
			
			<div class="space-y-4">
				<div>
					<label for="llmApiKey" class="block text-sm font-medium text-text-secondary mb-2">
						API Key
					</label>
					<input
						type="password"
						id="llmApiKey"
						name="llmApiKey"
						value={currentSettings.llmApiKey || ''}
						placeholder="Enter API key (leave empty to keep current)"
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">
						Currently stored: {currentSettings.llmApiKey ? '••••••••' : 'Not set'}
					</p>
				</div>
				
				<div>
					<label for="llmModel" class="block text-sm font-medium text-text-secondary mb-2">
						Model
					</label>
					<input
						type="text"
						id="llmModel"
						name="llmModel"
						value={currentSettings.llmModel || 'models/gemini-3-flash-preview'}
						placeholder="models/gemini-3-flash-preview"
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">
						Example: models/gemini-3-flash-preview, models/gemini-2.0-flash-exp
					</p>
				</div>
			</div>
		</Card>

		<!-- OIDC Settings -->
		<Card padding="lg" class="mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold text-text-primary">OIDC / SSO Settings</h2>
				<label class="relative inline-flex items-center cursor-pointer">
					<input 
						type="checkbox" 
						name="oidcEnabled" 
						class="sr-only peer"
						checked={currentSettings.oidcEnabled}
					>
					<div class="w-11 h-6 bg-bg-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
					<span class="ms-3 text-sm font-medium text-text-secondary">
						{currentSettings.oidcEnabled ? 'Enabled' : 'Disabled'}
					</span>
				</label>
			</div>
			
			<p class="text-text-secondary mb-6">
				Configure OpenID Connect (OIDC) for single sign-on authentication. These settings can also be set via environment variables.
			</p>
			
			<div class="space-y-4">
				<div>
					<label for="oidcIssuer" class="block text-sm font-medium text-text-secondary mb-2">
						Issuer URL
					</label>
					<input
						type="url"
						id="oidcIssuer"
						name="oidcIssuer"
						value={currentSettings.oidcIssuer || ''}
						placeholder="https://your-idp.example.com"
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">
						The OIDC provider's issuer URL (e.g., https://accounts.google.com, https://your-keycloak-server/auth/realms/your-realm)
					</p>
				</div>
				
				<div>
					<label for="oidcClientId" class="block text-sm font-medium text-text-secondary mb-2">
						Client ID
					</label>
					<input
						type="text"
						id="oidcClientId"
						name="oidcClientId"
						value={currentSettings.oidcClientId || ''}
						placeholder="your-client-id"
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
				</div>
				
			<div>
				<label for="oidcClientSecret" class="block text-sm font-medium text-text-secondary mb-2">
					Client Secret <span class="text-text-muted font-normal">(optional — omit for public clients using PKCE)</span>
				</label>
				<input
					type="password"
					id="oidcClientSecret"
					name="oidcClientSecret"
					value={currentSettings.oidcClientSecret || ''}
					placeholder="Leave empty for public client (PKCE only)"
					class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
				>
				<p class="text-xs text-text-muted mt-1">
					Currently stored: {currentSettings.oidcClientSecret ? '••••••••' : 'Not set (public client mode)'}
				</p>
			</div>
			</div>
		</Card>
		
		<!-- Action Buttons -->
		<div class="flex items-center justify-between">
			<div><!-- Placeholder for reset button outside form --></div>
			
			<Button type="submit" variant="primary" loading={saving}>
				Save Settings
			</Button>
		</div>
	</form>
	
	<!-- Reset Prompts Form (separate from main form) -->
	<div class="mt-4">
		<form 
			method="POST" 
			action="?/resetPrompts"
			use:enhance={() => {
				resetting = true;
				return async ({ update }) => {
					await update({ reset: false });
					resetting = false;
				};
			}}
		>
			<Button type="submit" variant="ghost" loading={resetting}>
				Reset Prompts to Defaults
			</Button>
		</form>
	</div>
	
	<!-- Quick Info -->
	<Card padding="lg" class="mt-8">
		<h2 class="text-xl font-semibold text-text-primary mb-4">How Automatic Mode Works</h2>
		<div class="space-y-4 text-text-secondary">
			<div class="flex gap-3">
				<div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
					<span class="text-primary font-bold">1</span>
				</div>
				<div>
					<h4 class="font-medium text-text-primary">Scan Sources</h4>
					<p class="text-sm">Fetches new articles from configured RSS feeds and APIs</p>
				</div>
			</div>
			
			<div class="flex gap-3">
				<div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
					<span class="text-primary font-bold">2</span>
				</div>
				<div>
					<h4 class="font-medium text-text-primary">AI Filter</h4>
					<p class="text-sm">Uses your custom prompt to evaluate relevance and filter articles</p>
				</div>
			</div>
			
			<div class="flex gap-3">
				<div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
					<span class="text-primary font-bold">3</span>
				</div>
				<div>
					<h4 class="font-medium text-text-primary">Research</h4>
					<p class="text-sm">Creates detailed reports with benefits, use cases, competitors, and scores</p>
				</div>
			</div>
			
			<div class="flex gap-3">
				<div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
					<span class="text-primary font-bold">4</span>
				</div>
				<div>
					<h4 class="font-medium text-text-primary">Auto-Publish</h4>
					<p class="text-sm">Innovations scoring above the threshold are automatically published</p>
				</div>
			</div>
			
			<div class="flex gap-3">
				<div class="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
					<span class="text-secondary font-bold">+</span>
				</div>
				<div>
					<h4 class="font-medium text-text-primary">Autonomous Discovery</h4>
					<p class="text-sm">If not enough innovations are found from feeds, AI will proactively discover trending tools and projects</p>
				</div>
			</div>
		</div>
	</Card>
</div>
