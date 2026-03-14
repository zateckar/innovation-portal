<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import IdeaCard from '$lib/components/ideas/IdeaCard.svelte';
	import { Card } from '$lib/components/ui';
	import { DEPARTMENT_LABELS, type DepartmentCategory } from '$lib/types';
	import { loadFilters, saveFilters } from '$lib/stores/filters';
	
	let { data } = $props();
	
	let searchQuery = $state('');

	// On mount, if no URL filters are active, restore from localStorage
	$effect(() => {
		const urlDepartment = data.filters.department;
		const urlSearch = data.filters.search;
		const urlSort = data.filters.sort;
		const hasUrlFilters = urlDepartment || urlSearch || (urlSort && urlSort !== 'recent');

		if (!hasUrlFilters) {
			const saved = loadFilters('ideas');
			if (saved.department || saved.q || saved.sort) {
				const params = new URLSearchParams();
				if (saved.department) params.set('department', saved.department);
				if (saved.q) params.set('q', saved.q);
				if (saved.sort) params.set('sort', saved.sort);
				goto(`?${params.toString()}`, { keepFocus: true, replaceState: true });
				return;
			}
		}

		searchQuery = urlSearch || '';
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

		// Persist to localStorage
		saveFilters('ideas', {
			department: params.get('department') || '',
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
	<title>Innovation Ideas - Innovation Radar</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-text-primary mb-2">Innovation Ideas</h1>
		<p class="text-text-secondary">AI-generated and evaluated innovation proposals for automotive transformation</p>
	</div>
	
	<!-- Filters -->
	<Card padding="md" class="mb-8">
		<div class="flex flex-col md:flex-row gap-4">
			<!-- Search -->
			<form onsubmit={handleSearch} class="flex-1">
				<div class="relative">
					<input
						type="text"
						placeholder="Search ideas..."
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
			
			<!-- Sort -->
			<select
				value={data.filters.sort || 'recent'}
				onchange={(e) => updateFilters({ sort: e.currentTarget.value })}
				class="px-4 py-2 rounded-lg bg-bg-surface border border-border text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
			>
				<option value="recent">Most Recent</option>
				<option value="score">Highest Score</option>
				<option value="votes">Most Voted</option>
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
					onclick={() => { searchQuery = ''; updateFilters({ department: null, q: null, sort: null }); }}
					class="text-sm text-text-muted hover:text-text-primary ml-2"
				>
					Clear all
				</button>
			</div>
		{/if}
	</Card>
	
	<!-- Results -->
	{#if data.ideas.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each data.ideas as idea (idea.id)}
				<div class="animate-fade-in">
					<IdeaCard {idea} />
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-16">
			<div class="w-20 h-20 mx-auto mb-6 rounded-full bg-bg-elevated flex items-center justify-center">
				<svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-text-primary mb-2">No ideas found</h2>
			<p class="text-text-secondary mb-6">
				{#if data.filters.search || data.filters.department}
					Try adjusting your filters or search query
				{:else}
					No innovation ideas have been published yet
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
