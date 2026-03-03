<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button } from '$lib/components/ui';
	
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Review Pending Items - Admin - Innovation Radar</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold text-text-primary">Review Pending Items</h1>
			<p class="text-text-secondary">Accept or reject discovered items for AI research</p>
		</div>
		<a href="/admin" class="text-primary hover:underline">
			← Back to Dashboard
		</a>
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
	
	<!-- Pending Items -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold text-text-primary mb-4">
			Pending Items ({data.pendingItems.length})
		</h2>
		
		{#if data.pendingItems.length > 0}
			<div class="space-y-4">
				{#each data.pendingItems as item}
					<Card padding="md">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<a 
									href={item.url} 
									target="_blank" 
									rel="noopener noreferrer"
									class="text-lg font-medium text-text-primary hover:text-primary transition-colors"
								>
									{item.title}
								</a>
								{#if item.sourceName}
									<p class="text-sm text-text-muted mt-1">
										Source: {item.sourceName}
									</p>
								{/if}
								{#if item.content}
									<p class="text-sm text-text-secondary mt-2 line-clamp-2">
										{item.content}
									</p>
								{/if}
								<p class="text-xs text-text-muted mt-2">
									Discovered: {item.discoveredAt ? new Date(item.discoveredAt).toLocaleString() : 'Unknown'}
								</p>
							</div>
							<div class="flex gap-2 flex-shrink-0">
								<form method="POST" action="?/accept" use:enhance>
									<input type="hidden" name="id" value={item.id} />
									<Button type="submit" variant="primary" size="sm">
										Accept
									</Button>
								</form>
								<form method="POST" action="?/reject" use:enhance>
									<input type="hidden" name="id" value={item.id} />
									<Button type="submit" variant="ghost" size="sm">
										Reject
									</Button>
								</form>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{:else}
			<Card padding="lg" class="text-center">
				<p class="text-text-muted">No pending items to review</p>
			</Card>
		{/if}
	</section>
	
	<!-- Accepted Items (Awaiting Research) -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold text-text-primary mb-4">
			Accepted Items - Awaiting Research ({data.acceptedItems.length})
		</h2>
		
		{#if data.acceptedItems.length > 0}
			<div class="space-y-4">
				{#each data.acceptedItems as item}
					<Card padding="md" class="bg-success/5 border-success/20">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<a 
									href={item.url} 
									target="_blank" 
									rel="noopener noreferrer"
									class="text-lg font-medium text-text-primary hover:text-primary transition-colors"
								>
									{item.title}
								</a>
								{#if item.sourceName}
									<p class="text-sm text-text-muted mt-1">
										Source: {item.sourceName}
									</p>
								{/if}
								<p class="text-xs text-text-muted mt-2">
									Discovered: {item.discoveredAt ? new Date(item.discoveredAt).toLocaleString() : 'Unknown'}
								</p>
							</div>
							<span class="px-2 py-1 text-xs rounded bg-success/20 text-success">
								Awaiting AI Research
							</span>
						</div>
					</Card>
				{/each}
			</div>
		{:else}
			<Card padding="lg" class="text-center">
				<p class="text-text-muted">No accepted items awaiting research</p>
			</Card>
		{/if}
	</section>
	
	<!-- Researched Innovations (Awaiting Publication) -->
	<section>
		<h2 class="text-xl font-semibold text-text-primary mb-4">
			Researched Innovations - Ready to Publish ({data.pendingInnovations.length})
		</h2>
		
		{#if data.pendingInnovations.length > 0}
			<div class="space-y-4">
				{#each data.pendingInnovations as innovation}
					<Card padding="md" class="bg-primary/5 border-primary/20">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<a 
									href="/innovations/{innovation.slug}"
									class="text-lg font-medium text-text-primary hover:text-primary transition-colors"
								>
									{innovation.title}
								</a>
								<p class="text-sm text-text-secondary mt-1">
									{innovation.tagline}
								</p>
								<div class="flex flex-wrap gap-3 mt-2">
									<span class="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted">
										{innovation.category}
									</span>
									{#if innovation.relevanceScore}
										<span class="text-xs text-text-muted">
											Relevance: {innovation.relevanceScore.toFixed(1)}
										</span>
									{/if}
									{#if innovation.innovationScore}
										<span class="text-xs text-text-muted">
											Innovation: {innovation.innovationScore.toFixed(1)}
										</span>
									{/if}
									{#if innovation.actionabilityScore}
										<span class="text-xs text-text-muted">
											Actionability: {innovation.actionabilityScore.toFixed(1)}
										</span>
									{/if}
								</div>
								<p class="text-xs text-text-muted mt-2">
									Researched: {innovation.researchedAt ? new Date(innovation.researchedAt).toLocaleString() : 'Unknown'}
								</p>
							</div>
							<div class="flex gap-2 flex-shrink-0">
								<form method="POST" action="?/publish" use:enhance>
									<input type="hidden" name="id" value={innovation.id} />
									<Button type="submit" variant="primary" size="sm">
										Publish
									</Button>
								</form>
								<form method="POST" action="?/archive" use:enhance>
									<input type="hidden" name="id" value={innovation.id} />
									<Button type="submit" variant="ghost" size="sm">
										Archive
									</Button>
								</form>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{:else}
			<Card padding="lg" class="text-center">
				<p class="text-text-muted">No researched innovations awaiting publication</p>
				<p class="text-sm text-text-secondary mt-2">
					Run AI Research on accepted items to generate innovation reports
				</p>
			</Card>
		{/if}
	</section>
</div>
