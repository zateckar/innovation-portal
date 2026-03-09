<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import NewsCard from '$lib/components/news/NewsCard.svelte';
	import { Card } from '$lib/components/ui';
	import { DEPARTMENT_LABELS, type DepartmentCategory } from '$lib/types';
	
	let { data } = $props();
	
	let searchQuery = $state('');
	
	$effect(() => {
		searchQuery = data.filters.search || '';
	});
	
	const departments = Object.entries(DEPARTMENT_LABELS) as [DepartmentCategory, string][];
	
	function updateFilters(updates: Record<string, string | null>) {
		const params = new URLSearchParams($page.url.searchParams);
		
		for (const [key, value] of Object.entries(updates)) {
			if (value) {
				params.set(key, value);
			} else {
				params.delete(key);
			}
		}
		
		goto(`?${params.toString()}`, { keepFocus: true });
	}
	
	function handleSearch(e: Event) {
		e.preventDefault();
		updateFilters({ q: searchQuery || null });
	}
</script>

<svelte:head>
	<title>Industry News & Trends - Innovation Radar</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-text-primary mb-2">Industry News & Trends</h1>
		<p class="text-text-secondary">AI-researched news and insights for automotive digital transformation</p>
	</div>
	
	<!-- Filters -->
	<Card padding="md" class="mb-8">
		<div class="flex flex-col md:flex-row gap-4">
			<!-- Search -->
			<form onsubmit={handleSearch} class="flex-1">
				<div class="relative">
					<input
						type="text"
						placeholder="Search news..."
						bind:value={searchQuery}
						class="w-full px-4 py-2 pl-10 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
					/>
					<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
					</svg>
				</div>
			</form>
			
			<!-- Department filter -->
			<select
				value={data.filters.department || ''}
				onchange={(e) => updateFilters({ department: e.currentTarget.value || null })}
				class="px-4 py-2 rounded-lg bg-bg-surface border border-border text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
			>
				<option value="">All Departments</option>
				{#each departments as [value, label]}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>
		
		<!-- Active filters -->
		{#if data.filters.department || data.filters.search}
			<div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
				<span class="text-sm text-text-muted">Active filters:</span>
				{#if data.filters.department}
					<button 
						onclick={() => updateFilters({ department: null })}
						class="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-sm"
					>
						{DEPARTMENT_LABELS[data.filters.department as DepartmentCategory]}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				{/if}
				{#if data.filters.search}
					<button 
						onclick={() => { searchQuery = ''; updateFilters({ q: null }); }}
						class="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-sm"
					>
						"{data.filters.search}"
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				{/if}
				<button 
					onclick={() => { searchQuery = ''; updateFilters({ department: null, q: null }); }}
					class="text-sm text-text-muted hover:text-text-primary ml-2"
				>
					Clear all
				</button>
			</div>
		{/if}
	</Card>
	
	<!-- Results -->
	{#if data.news.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each data.news as newsItem (newsItem.id)}
				<div class="animate-fade-in">
					<NewsCard {newsItem} />
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-16">
			<div class="w-20 h-20 mx-auto mb-6 rounded-full bg-bg-elevated flex items-center justify-center">
				<svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-text-primary mb-2">No news found</h2>
			<p class="text-text-secondary mb-6">
				{#if data.filters.search || data.filters.department}
					Try adjusting your filters or search query
				{:else}
					No news articles have been published yet
				{/if}
			</p>
			{#if data.filters.search || data.filters.department}
				<button 
					onclick={() => { searchQuery = ''; updateFilters({ department: null, q: null }); }}
					class="px-4 py-2 rounded-lg bg-bg-elevated text-text-primary hover:bg-bg-hover transition-colors"
				>
					Clear filters
				</button>
			{/if}
		</div>
	{/if}
</div>
