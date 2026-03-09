<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card } from '$lib/components/ui';
	
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Admin Dashboard - Innovation Radar</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Dashboard</h1>
			<p class="text-text-secondary mt-1">Overview of the Innovation Radar system</p>
		</div>
		{#if data.settings.autoModeEnabled}
			<span class="px-3 py-1 rounded-full bg-success/20 text-success text-sm font-medium">
				Auto Mode Active
			</span>
		{/if}
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

	<!-- Stats Grid -->
	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-text-primary">{data.stats.innovations}</div>
			<div class="text-xs text-text-muted mt-1">Total Innovations</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-success">{data.stats.published}</div>
			<div class="text-xs text-text-muted mt-1">Published</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-warning">{data.stats.pendingItems}</div>
			<div class="text-xs text-text-muted mt-1">Pending Items</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-primary">{data.stats.acceptedItems}</div>
			<div class="text-xs text-text-muted mt-1">Accepted</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-text-muted">{data.stats.processedItems}</div>
			<div class="text-xs text-text-muted mt-1">Processed</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-text-primary">{data.stats.users}</div>
			<div class="text-xs text-text-muted mt-1">Users</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-secondary">{data.stats.votes}</div>
			<div class="text-xs text-text-muted mt-1">Total Votes</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-text-primary">{data.stats.sources}</div>
			<div class="text-xs text-text-muted mt-1">Sources</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-blue-400">{data.stats.newsPublished}</div>
			<div class="text-xs text-text-muted mt-1">News ({data.stats.news} total)</div>
		</Card>
		<Card padding="md" class="text-center">
			<div class="text-3xl font-bold text-amber-400">{data.stats.ideasPublished}</div>
			<div class="text-xs text-text-muted mt-1">Ideas ({data.stats.ideas} total)</div>
		</Card>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Recent Innovations -->
		<Card padding="lg">
			<h2 class="text-base font-semibold text-text-primary mb-4">Recent Innovations</h2>
			{#if data.recentInnovations.length > 0}
				<div class="space-y-2">
					{#each data.recentInnovations as innovation}
						<a 
							href="/innovations/{innovation.slug}"
							class="flex items-center justify-between p-3 rounded-lg bg-bg-hover hover:bg-bg-elevated transition-colors"
						>
							<span class="text-text-primary font-medium truncate">{innovation.title}</span>
							<div class="flex items-center gap-2 shrink-0 ml-3">
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
												if (!confirm('Archive this innovation?')) e.preventDefault();
											}}
										>
											Archive
										</button>
									</form>
								{/if}
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<div class="text-center py-8">
					<p class="text-text-muted mb-2">No innovations yet</p>
					<p class="text-sm text-text-secondary">
						Use <a href="/admin/pipeline" class="text-primary hover:underline">Pipeline</a> to discover innovations automatically.
					</p>
				</div>
			{/if}
		</Card>

		<!-- Sources Status -->
		<Card padding="lg">
			<h2 class="text-base font-semibold text-text-primary mb-4">Sources Status</h2>
			{#if data.sourcesStatus.length > 0}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="text-left text-text-muted text-xs border-b border-border">
								<th class="pb-2 font-medium">Name</th>
								<th class="pb-2 font-medium">Status</th>
								<th class="pb-2 font-medium">Last Scanned</th>
							</tr>
						</thead>
						<tbody>
							{#each data.sourcesStatus as source}
								<tr class="border-b border-border/50">
									<td class="py-2 text-text-primary text-sm">{source.name}</td>
									<td class="py-2">
										<span class="text-xs px-2 py-0.5 rounded {source.enabled ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}">
											{source.enabled ? 'Active' : 'Disabled'}
										</span>
									</td>
									<td class="py-2 text-text-muted text-xs">
										{source.lastScannedAt ? new Date(source.lastScannedAt).toLocaleString() : 'Never'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="text-text-muted text-sm text-center py-4">
					No sources configured.
					<a href="/admin/sources" class="text-primary hover:underline">Add sources</a>
				</p>
			{/if}
		</Card>
	</div>
</div>
