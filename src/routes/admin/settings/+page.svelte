<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button } from '$lib/components/ui';
	
	let { data, form } = $props();
	
	let saving = $state(false);
	let resetting = $state(false);
	
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
</script>

<svelte:head>
	<title>AI Settings - Innovation Radar</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold text-text-primary">AI Settings</h1>
			<p class="text-text-secondary">Configure AI filtering criteria and automatic mode</p>
		</div>
		<a href="/admin" class="text-primary hover:underline">← Back to Dashboard</a>
	</div>
	
	{#if form?.success}
		<div class="mb-6 p-4 rounded-lg bg-success/10 border border-success/30 text-success">
			{form.message}
		</div>
	{/if}
	
	{#if form?.error}
		<div class="mb-6 p-4 rounded-lg bg-error/10 border border-error/30 text-error">
			{form.error}
		</div>
	{/if}
	
	<form 
		method="POST" 
		action="?/save"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update();
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
					>{data.settings.filterPrompt || ''}</textarea>
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
					>{data.settings.researchPrompt || ''}</textarea>
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
		
		<!-- Automatic Mode Settings -->
		<Card padding="lg" class="mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold text-text-primary">Automatic Mode</h2>
				<label class="relative inline-flex items-center cursor-pointer">
					<input 
						type="checkbox" 
						name="autoModeEnabled" 
						class="sr-only peer"
						checked={data.settings.autoModeEnabled}
					>
					<div class="w-11 h-6 bg-bg-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
					<span class="ms-3 text-sm font-medium text-text-secondary">
						{data.settings.autoModeEnabled ? 'Enabled' : 'Disabled'}
					</span>
				</label>
			</div>
			
			<p class="text-text-secondary mb-6">
				When enabled, the system will automatically scan sources, filter articles, research innovations, 
				and auto-publish those that meet the quality threshold.
			</p>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div>
					<label for="autoPublishThreshold" class="block text-sm font-medium text-text-secondary mb-2">
						Auto-Publish Threshold (1-10)
					</label>
					<input
						type="number"
						id="autoPublishThreshold"
						name="autoPublishThreshold"
						min="1"
						max="10"
						step="0.5"
						value={data.settings.autoPublishThreshold ?? 7.0}
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">
						Minimum average score (relevance + innovation + actionability) / 3 to auto-publish
					</p>
				</div>
				
				<div>
					<label for="autoInnovationsPerRun" class="block text-sm font-medium text-text-secondary mb-2">
						Innovations Per Run
					</label>
					<input
						type="number"
						id="autoInnovationsPerRun"
						name="autoInnovationsPerRun"
						min="1"
						max="20"
						value={data.settings.autoInnovationsPerRun ?? 3}
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">
						Target number of innovations to create per auto-mode run
					</p>
				</div>
				
				<div>
					<label for="autoRunIntervalMinutes" class="block text-sm font-medium text-text-secondary mb-2">
						Auto-Mode Interval (minutes)
					</label>
					<input
						type="number"
						id="autoRunIntervalMinutes"
						name="autoRunIntervalMinutes"
						min="30"
						max="1440"
						value={data.settings.autoRunIntervalMinutes ?? 60}
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">
						How often to run the full auto-mode pipeline (scan → filter → research → publish)
					</p>
				</div>
				
				<div>
					<label for="scanIntervalMinutes" class="block text-sm font-medium text-text-secondary mb-2">
						Feed Scan Interval (minutes)
					</label>
					<input
						type="number"
						id="scanIntervalMinutes"
						name="scanIntervalMinutes"
						min="15"
						max="720"
						value={data.settings.scanIntervalMinutes ?? 120}
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">
						How often to scan RSS feeds and APIs for new articles
					</p>
				</div>
				
				<div>
					<label for="filterIntervalMinutes" class="block text-sm font-medium text-text-secondary mb-2">
						AI Filter Interval (minutes)
					</label>
					<input
						type="number"
						id="filterIntervalMinutes"
						name="filterIntervalMinutes"
						min="15"
						max="360"
						value={data.settings.filterIntervalMinutes ?? 30}
						class="w-full px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
					>
					<p class="text-xs text-text-muted mt-1">
						How often to run AI filtering on pending items
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
					await update();
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
