<script lang="ts">
	import { base } from '$app/paths';
	import { Card, Badge, ScoreBar } from '$lib/components/ui';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS, type DepartmentCategory } from '$lib/types';
	
	let { data } = $props();
	
	const item = $derived(data.newsItem);
	
	function formatDate(date: Date | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{item.title} - Industry News - Innovation Radar</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Back link -->
	<a 
		href="{base}/news" 
		class="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-6"
	>
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
		</svg>
		Back to News
	</a>
	
	<!-- Header -->
	<Card padding="lg" class="mb-8">
		<!-- Department badge -->
		<div class="flex items-center gap-3 mb-4">
			<span 
				class="inline-flex items-center rounded-full border font-medium px-3 py-1 text-sm"
				style="background-color: {DEPARTMENT_COLORS[item.category]}20; color: {DEPARTMENT_COLORS[item.category]}; border-color: {DEPARTMENT_COLORS[item.category]}40"
			>
				{DEPARTMENT_LABELS[item.category] || item.category}
			</span>
		</div>
		
		<!-- Title -->
		<h1 class="text-3xl font-bold text-text-primary mb-4">
			{item.title}
		</h1>
		
		<!-- Meta -->
		<div class="flex flex-wrap items-center gap-6 mb-6 text-sm text-text-muted">
			{#if item.publishedAt}
				<div class="flex items-center gap-2">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
					</svg>
					{formatDate(item.publishedAt)}
				</div>
			{/if}
			{#if item.relevanceScore !== null}
				<div class="w-40">
					<ScoreBar label="Relevance" value={item.relevanceScore} size="md" />
				</div>
			{/if}
		</div>
		
		<!-- Summary -->
		<p class="text-text-secondary text-lg leading-relaxed border-l-4 border-primary/40 pl-4">
			{item.summary}
		</p>
	</Card>
	
	<!-- Content -->
	<Card padding="lg" class="mb-8">
		<div class="prose-content text-text-primary leading-relaxed space-y-4">
			{@html item.content.replace(/\n\n/g, '</p><p class="mb-4">').replace(/\n/g, '<br />').replace(/^/, '<p class="mb-4">').replace(/$/, '</p>').replace(/## (.*?)(<br \/>|<\/p>)/g, '</p><h2 class="text-xl font-semibold text-text-primary mt-8 mb-4">$1</h2><p class="mb-4">').replace(/### (.*?)(<br \/>|<\/p>)/g, '</p><h3 class="text-lg font-semibold text-text-primary mt-6 mb-3">$1</h3><p class="mb-4">').replace(/\*\*(.*?)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/- (.*?)(<br \/>)/g, '<li class="ml-4 list-disc text-text-secondary">$1</li>')}
		</div>
	</Card>
	
	<!-- Sources -->
	{#if item.sources && item.sources.length > 0}
		<Card padding="lg">
			<h2 class="text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
				<svg class="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
				</svg>
				Sources
			</h2>
			<ul class="space-y-3">
				{#each item.sources as source}
					<li>
						<a 
							href={source.url} 
							target="_blank" 
							rel="noopener noreferrer"
							class="text-primary hover:text-primary/80 transition-colors text-sm inline-flex items-center gap-1"
						>
							{source.title || source.url}
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
							</svg>
						</a>
					</li>
				{/each}
			</ul>
		</Card>
	{/if}
</div>
