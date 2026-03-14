<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button, Input, Select } from '$lib/components/ui';
	
	let { data, form } = $props();
	let showAddForm = $state(false);
</script>

<svelte:head>
	<title>Manage Sources - Admin - Innovation Radar</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Sources</h1>
			<p class="text-text-secondary mt-1">Configure RSS feeds and APIs to scan for innovations</p>
		</div>
		<Button onclick={() => showAddForm = !showAddForm}>
			{showAddForm ? 'Cancel' : 'Add Source'}
		</Button>
	</div>
	
	{#if form?.error}
		<div class="p-4 rounded-lg bg-error/10 border border-error/30 text-error">
			{form.error}
		</div>
	{/if}
	
	{#if form?.success}
		<div class="p-4 rounded-lg bg-success/10 border border-success/30 text-success">
			Source updated successfully
		</div>
	{/if}
	
	<!-- Add Source Form -->
	{#if showAddForm}
		<Card padding="lg">
			<h2 class="text-xl font-semibold text-text-primary mb-4">Add New Source</h2>
			<form 
				method="POST" 
				action="?/add"
				use:enhance={() => {
					return async ({ update, result }) => {
						await update();
						if (result.type === 'success') {
							showAddForm = false;
						}
					};
				}}
				class="space-y-4"
			>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Input name="name" label="Name" placeholder="e.g., Hacker News" required />
					
					<Select name="type" label="Type" required>
						<option value="">Select type...</option>
						<option value="rss">RSS Feed</option>
						<option value="api">API (Hacker News)</option>
					</Select>
				</div>
				
				<Input 
					name="url" 
					type="url" 
					label="URL" 
					placeholder="https://example.com/feed.xml" 
					required 
					hint="For RSS feeds, use the feed URL. For Hacker News API, use: https://hacker-news.firebaseio.com"
				/>
				
				<Input 
					name="interval" 
					type="number" 
					label="Scan Interval (minutes)" 
					value="120"
					min="30"
					hint="How often to check for new items"
				/>
				
				<div class="flex justify-end gap-3">
					<Button type="button" variant="ghost" onclick={() => showAddForm = false}>
						Cancel
					</Button>
					<Button type="submit">
						Add Source
					</Button>
				</div>
			</form>
		</Card>
	{/if}
	
	<!-- Sources List -->
	<Card padding="none">
		{#if data.sources.length > 0}
			<div class="divide-y divide-border">
				{#each data.sources as source}
					<div class="p-4 flex items-center justify-between gap-4">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-3">
								<span class="text-text-primary font-medium">{source.name}</span>
								<span class="text-xs px-2 py-0.5 rounded bg-bg-hover text-text-muted uppercase">
									{source.type}
								</span>
								<span class="text-xs px-2 py-0.5 rounded {source.enabled ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}">
									{source.enabled ? 'Active' : 'Disabled'}
								</span>
							</div>
							<div class="text-sm text-text-muted truncate mt-1">
								{source.url}
							</div>
							<div class="text-xs text-text-muted mt-1">
								Last scanned: {source.lastScannedAt ? new Date(source.lastScannedAt).toLocaleString() : 'Never'} 
								| Interval: {source.scanIntervalMinutes} min
							</div>
						</div>
						
						<div class="flex items-center gap-2">
							<form method="POST" action="?/toggle" use:enhance>
								<input type="hidden" name="id" value={source.id} />
								<input type="hidden" name="enabled" value={String(source.enabled)} />
								<Button type="submit" variant="ghost" size="sm">
									{source.enabled ? 'Disable' : 'Enable'}
								</Button>
							</form>
							
							<form 
								method="POST" 
								action="?/delete" 
								use:enhance={({ cancel }) => {
									if (!confirm('Are you sure you want to delete this source?')) {
										cancel();
										return;
									}
									return async ({ update }) => update();
								}}
							>
								<input type="hidden" name="id" value={source.id} />
								<Button type="submit" variant="danger" size="sm">
									Delete
								</Button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="p-8 text-center">
				<p class="text-text-muted mb-4">No sources configured yet</p>
				<Button onclick={() => showAddForm = true}>
					Add Your First Source
				</Button>
			</div>
		{/if}
	</Card>
	
	<!-- Suggested Sources -->
	<div>
		<h3 class="text-lg font-semibold text-text-primary mb-1">Default Sources</h3>
		<p class="text-sm text-text-muted mb-4">All of these sources are seeded automatically on first install.</p>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<Card padding="md" class="text-sm">
				<div class="font-medium text-text-primary">Hacker News</div>
				<div class="text-text-muted">Type: API</div>
				<div class="text-text-muted truncate">https://hacker-news.firebaseio.com</div>
			</Card>
			<Card padding="md" class="text-sm">
				<div class="font-medium text-text-primary">Ars Technica</div>
				<div class="text-text-muted">Type: RSS</div>
				<div class="text-text-muted truncate">https://feeds.arstechnica.com/arstechnica/technology-lab</div>
			</Card>
			<Card padding="md" class="text-sm">
				<div class="font-medium text-text-primary">TechCrunch</div>
				<div class="text-text-muted">Type: RSS</div>
				<div class="text-text-muted truncate">https://techcrunch.com/feed/</div>
			</Card>
			<Card padding="md" class="text-sm">
				<div class="font-medium text-text-primary">Tom's Hardware</div>
				<div class="text-text-muted">Type: RSS</div>
				<div class="text-text-muted truncate">https://www.tomshardware.com/feeds.xml</div>
			</Card>
			<Card padding="md" class="text-sm">
				<div class="font-medium text-text-primary">ZDNet</div>
				<div class="text-text-muted">Type: RSS</div>
				<div class="text-text-muted truncate">https://zdnet.com/news/rss.xml</div>
			</Card>
			<Card padding="md" class="text-sm">
				<div class="font-medium text-text-primary">Dev.to</div>
				<div class="text-text-muted">Type: RSS</div>
				<div class="text-text-muted truncate">https://dev.to/feed</div>
			</Card>
		</div>
	</div>
</div>
