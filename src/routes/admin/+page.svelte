<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button } from '$lib/components/ui';
	
	let { data, form } = $props();
	
	let runningJob = $state<string | null>(null);
</script>

<svelte:head>
	<title>Admin Dashboard - Innovation Radar</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold text-text-primary">Admin Dashboard</h1>
			<p class="text-text-secondary">Manage sources, review items, and monitor the system</p>
		</div>
		<div class="flex items-center gap-2">
			{#if data.settings.autoModeEnabled}
				<span class="px-3 py-1 rounded-full bg-success/20 text-success text-sm font-medium">
					Auto Mode Active
				</span>
			{/if}
		</div>
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
	
	<!-- Stats Grid -->
	<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-text-primary">{data.stats.innovations}</div>
			<div class="text-sm text-text-muted">Total Innovations</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-success">{data.stats.published}</div>
			<div class="text-sm text-text-muted">Published</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-warning">{data.stats.pendingItems}</div>
			<div class="text-sm text-text-muted">Pending Items</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-primary">{data.stats.acceptedItems}</div>
			<div class="text-sm text-text-muted">Accepted Items</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-text-muted">{data.stats.processedItems}</div>
			<div class="text-sm text-text-muted">Processed</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-text-primary">{data.stats.users}</div>
			<div class="text-sm text-text-muted">Users</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-secondary">{data.stats.votes}</div>
			<div class="text-sm text-text-muted">Total Votes</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-text-primary">{data.stats.sources}</div>
			<div class="text-sm text-text-muted">Sources</div>
		</Card>
	</div>
	
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Quick Actions -->
		<Card padding="lg">
			<h2 class="text-xl font-semibold text-text-primary mb-4">Quick Actions</h2>
			<div class="space-y-3">
				<!-- Auto Mode (Primary action) -->
				<form 
					method="POST" 
					action="?/runAutoMode"
					use:enhance={() => {
						runningJob = 'auto';
						return async ({ update }) => {
							await update();
							runningJob = null;
						};
					}}
				>
					<Button type="submit" variant="primary" class="w-full justify-start" loading={runningJob === 'auto'}>
						<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
						</svg>
						Run Auto Mode Pipeline
						<span class="ml-auto text-xs opacity-70">(scan → filter → research → publish)</span>
					</Button>
				</form>
				
				<!-- AI Discovery -->
				<form 
					method="POST" 
					action="?/runDiscover"
					use:enhance={() => {
						runningJob = 'discover';
						return async ({ update }) => {
							await update();
							runningJob = null;
						};
					}}
				>
					<Button type="submit" variant="secondary" class="w-full justify-start" loading={runningJob === 'discover'}>
						<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
						</svg>
						AI Discovery Mode
						<span class="ml-auto text-xs opacity-70">(discover new innovations)</span>
					</Button>
				</form>
				
				<div class="border-t border-border my-4"></div>
				
				<!-- Individual Steps -->
				<form 
					method="POST" 
					action="?/runScan"
					use:enhance={() => {
						runningJob = 'scan';
						return async ({ update }) => {
							await update();
							runningJob = null;
						};
					}}
				>
					<Button type="submit" variant="ghost" class="w-full justify-start" loading={runningJob === 'scan'}>
						<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
						</svg>
						Run Feed Scan
					</Button>
				</form>
				
				<form 
					method="POST" 
					action="?/runFilter"
					use:enhance={() => {
						runningJob = 'filter';
						return async ({ update }) => {
							await update();
							runningJob = null;
						};
					}}
				>
					<Button type="submit" variant="ghost" class="w-full justify-start" loading={runningJob === 'filter'}>
						<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
						</svg>
						Run AI Filter
					</Button>
				</form>
				
				<form 
					method="POST" 
					action="?/runResearch"
					use:enhance={() => {
						runningJob = 'research';
						return async ({ update }) => {
							await update();
							runningJob = null;
						};
					}}
				>
					<Button type="submit" variant="ghost" class="w-full justify-start" loading={runningJob === 'research'}>
						<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
						</svg>
						Run AI Research
					</Button>
				</form>
			</div>
			
			<div class="mt-6 pt-6 border-t border-border space-y-2">
				<a href="/admin/catalog" class="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
					</svg>
					Incubator Catalog →
				</a>
				<a href="/admin/settings" class="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
					</svg>
					AI Settings & Auto Mode →
				</a>
				<a href="/admin/sources" class="block px-4 py-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors">
					Manage Sources →
				</a>
				<a href="/admin/pending" class="block px-4 py-2 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors">
					Review Pending Items →
				</a>
			</div>
		</Card>
		
		<!-- Recent Innovations -->
		<Card padding="lg">
			<h2 class="text-xl font-semibold text-text-primary mb-4">Recent Innovations</h2>
			{#if data.recentInnovations.length > 0}
				<div class="space-y-3">
					{#each data.recentInnovations as innovation}
						<a 
							href="/innovations/{innovation.slug}"
							class="block p-3 rounded-lg bg-bg-hover hover:bg-bg-surface transition-colors"
						>
							<div class="flex items-center justify-between">
								<span class="text-text-primary font-medium truncate">{innovation.title}</span>
								<div class="flex items-center gap-2">
									<span class="text-xs px-2 py-0.5 rounded {innovation.status === 'published' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}">
										{innovation.status}
									</span>
									{#if innovation.status !== 'archived'}
										<form method="POST" action="?/archiveInnovation" use:enhance>
											<input type="hidden" name="id" value={innovation.id} />
											<button 
												type="submit" 
												class="text-xs px-2 py-0.5 rounded bg-error/10 hover:bg-error/20 text-error transition-colors"
												onclick={(e) => {
													e.stopPropagation();
													if (!confirm('Archive this innovation?')) {
														e.preventDefault();
													}
												}}
											>
												Archive
											</button>
										</form>
									{/if}
								</div>
							</div>
							{#if innovation.publishedAt}
								<div class="text-xs text-text-muted mt-1">
									{new Date(innovation.publishedAt).toLocaleDateString()}
								</div>
							{/if}
						</a>
					{/each}
				</div>
			{:else}
				<div class="text-center py-8">
					<p class="text-text-muted mb-4">No innovations yet</p>
					<p class="text-sm text-text-secondary">
						Use the <strong>AI Discovery Mode</strong> or <strong>Auto Mode Pipeline</strong> to discover innovations automatically!
					</p>
				</div>
			{/if}
		</Card>
		
		<!-- Sources Status -->
		<Card padding="lg" class="lg:col-span-2">
			<h2 class="text-xl font-semibold text-text-primary mb-4">Sources Status</h2>
			{#if data.sourcesStatus.length > 0}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="text-left text-text-muted text-sm border-b border-border">
								<th class="pb-3 font-medium">Name</th>
								<th class="pb-3 font-medium">Status</th>
								<th class="pb-3 font-medium">Last Scanned</th>
							</tr>
						</thead>
						<tbody>
							{#each data.sourcesStatus as source}
								<tr class="border-b border-border/50">
									<td class="py-3 text-text-primary">{source.name}</td>
									<td class="py-3">
										<span class="text-xs px-2 py-0.5 rounded {source.enabled ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}">
											{source.enabled ? 'Active' : 'Disabled'}
										</span>
									</td>
									<td class="py-3 text-text-muted text-sm">
										{source.lastScannedAt ? new Date(source.lastScannedAt).toLocaleString() : 'Never'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="text-text-muted text-center py-4">No sources configured. <a href="/admin/sources" class="text-primary hover:underline">Add sources</a></p>
			{/if}
		</Card>
	</div>
</div>
