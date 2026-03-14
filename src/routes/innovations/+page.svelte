<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { InnovationCard } from '$lib/components/innovations';
	import { Badge, Card, Input, Select } from '$lib/components/ui';
	import { CATEGORY_LABELS, type InnovationCategory } from '$lib/types';
	import { loadFilters, saveFilters } from '$lib/stores/filters';
	
	let { data } = $props();
	
	let searchQuery = $state('');

	// On mount, if no URL filters are active, restore from localStorage
	$effect(() => {
		const urlCategory = data.filters.category;
		const urlSearch = data.filters.search;
		const urlSort = data.filters.sort;
		const hasUrlFilters = urlCategory || urlSearch || (urlSort && urlSort !== 'votes');

		if (!hasUrlFilters) {
			const saved = loadFilters('innovations');
			if (saved.category || saved.q || saved.sort) {
				const params = new URLSearchParams();
				if (saved.category) params.set('category', saved.category);
				if (saved.q) params.set('q', saved.q);
				if (saved.sort) params.set('sort', saved.sort);
				goto(`?${params.toString()}`, { keepFocus: true, replaceState: true });
				return;
			}
		}

		searchQuery = urlSearch || '';
	});
	
	const categories = Object.entries(CATEGORY_LABELS) as [InnovationCategory, string][];
	
	function updateFilters(updates: Record<string, string | null>) {
		const params = new URLSearchParams($page.url.searchParams);
		
		for (const [key, value] of Object.entries(updates)) {
			if (value) {
				params.set(key, value);
			} else {
				params.delete(key);
			}
		}

		// Persist to localStorage
		saveFilters('innovations', {
			category: params.get('category') || '',
			q: params.get('q') || '',
			sort: params.get('sort') || ''
		});
		
		goto(`?${params.toString()}`, { keepFocus: true });
	}
	
	function handleSearch(e: Event) {
		e.preventDefault();
		updateFilters({ q: searchQuery || null });
	}
</script>

<svelte:head>
	<title>Browse Innovations - Innovation Radar</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-text-primary mb-2">Browse Innovations</h1>
		<p class="text-text-secondary">Explore all discovered innovations and find your next project</p>
	</div>
	
	<!-- Filters -->
	<Card padding="md" class="mb-8">
		<div class="flex flex-col md:flex-row gap-4">
			<!-- Search -->
			<form onsubmit={handleSearch} class="flex-1">
				<div class="relative">
					<input
						type="text"
						placeholder="Search innovations..."
						bind:value={searchQuery}
						class="w-full px-4 py-2 pl-10 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
					/>
					<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
					</svg>
				</div>
			</form>
			
			<!-- Category filter -->
			<select
				value={data.filters.category || ''}
				onchange={(e) => updateFilters({ category: e.currentTarget.value || null })}
				class="px-4 py-2 rounded-lg bg-bg-surface border border-border text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
			>
				<option value="">All Categories</option>
				{#each categories as [value, label]}
					<option {value}>{label}</option>
				{/each}
			</select>
			
			<!-- Sort -->
			<select
				value={data.filters.sort || 'votes'}
				onchange={(e) => updateFilters({ sort: e.currentTarget.value })}
				class="px-4 py-2 rounded-lg bg-bg-surface border border-border text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
			>
				<option value="votes">Most Voted</option>
				<option value="recent">Most Recent</option>
				<option value="relevance">Highest Relevance</option>
			</select>
		</div>
		
		<!-- Active filters -->
		{#if data.filters.category || data.filters.search}
			<div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
				<span class="text-sm text-text-muted">Active filters:</span>
				{#if data.filters.category}
					<button 
						onclick={() => updateFilters({ category: null })}
						class="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-sm"
					>
						{CATEGORY_LABELS[data.filters.category as InnovationCategory]}
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
					onclick={() => { searchQuery = ''; updateFilters({ category: null, q: null, sort: null }); }}
					class="text-sm text-text-muted hover:text-text-primary ml-2"
				>
					Clear all
				</button>
			</div>
		{/if}
	</Card>
	
	<!-- Results -->
	{#if data.innovations.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{#each data.innovations as innovation (innovation.id)}
				<div class="animate-fade-in">
					<InnovationCard {innovation} />
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-16">
			<div class="w-20 h-20 mx-auto mb-6 rounded-full bg-bg-elevated flex items-center justify-center">
				<svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-text-primary mb-2">No innovations found</h2>
			<p class="text-text-secondary mb-6">
				{#if data.filters.search || data.filters.category}
					Try adjusting your filters or search query
				{:else}
					No innovations have been published yet
				{/if}
			</p>
			{#if data.filters.search || data.filters.category}
				<button 
					onclick={() => { searchQuery = ''; updateFilters({ category: null, q: null }); }}
					class="px-4 py-2 rounded-lg bg-bg-elevated text-text-primary hover:bg-bg-hover transition-colors"
				>
					Clear filters
				</button>
			{/if}
		</div>
	{/if}
</div>
