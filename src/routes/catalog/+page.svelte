<script lang="ts">
	import { Card } from '$lib/components/ui';
	import { CatalogCard } from '$lib/components/catalog';
	import { DEPARTMENT_LABELS, type DepartmentCategory } from '$lib/types';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { loadFilters, saveFilters } from '$lib/stores/filters';

	let { data } = $props();

	let searchQuery = $state('');

	// On mount, if no URL filters are active, restore from localStorage
	$effect(() => {
		const urlDepartment = data.filters.department;
		const urlSearch = data.filters.search;
		const hasUrlFilters = urlDepartment || urlSearch;

		if (!hasUrlFilters) {
			const saved = loadFilters('catalog');
			if (saved.department || saved.q) {
				const params = new URLSearchParams();
				if (saved.department) params.set('department', saved.department);
				if (saved.q) params.set('q', saved.q);
				goto(`/catalog?${params.toString()}`, { replaceState: true });
				return;
			}
		}

		searchQuery = urlSearch || '';
	});

	const departments = Object.entries(DEPARTMENT_LABELS) as [DepartmentCategory, string][];

	function updateFilters(updates: Record<string, string | null>) {
		const params = new URLSearchParams($page.url.searchParams);
		for (const [key, value] of Object.entries(updates)) {
			if (value) params.set(key, value); else params.delete(key);
		}
		saveFilters('catalog', {
			department: params.get('department') || '',
			q: params.get('q') || ''
		});
		goto(`/catalog?${params.toString()}`);
	}

	function handleSearch(e: Event) {
		e.preventDefault();
		updateFilters({ q: searchQuery || null });
	}

	function clearFilter(filter: 'department' | 'search') {
		if (filter === 'department') {
			updateFilters({ department: null });
		} else {
			searchQuery = '';
			updateFilters({ q: null });
		}
	}
</script>

<svelte:head>
	<title>Incubator Catalog | Innovation Radar</title>
	<meta name="description" content="Try implemented innovations from our Incubator Catalog - real tools and solutions ready for you to use." />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8 space-y-8">
	<!-- Header Section -->
	<div class="text-center space-y-4">
		<div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
			<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
			</svg>
			<span class="text-emerald-400 font-medium">Ready to Try</span>
		</div>
		
		<h1 class="text-4xl font-bold">
			<span class="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
				Incubator Catalog
			</span>
		</h1>
		
		<p class="text-zinc-400 max-w-2xl mx-auto text-lg">
			Explore innovations that have been implemented and are ready for you to try. 
			These are real tools and solutions promoted from our Innovation Radar.
		</p>
	</div>

	<!-- Distinction Banner -->
	<Card class="bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-emerald-500/10 border-violet-500/20">
		<div class="p-6">
			<div class="flex flex-col md:flex-row items-center gap-6">
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30">
						<svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
						<span class="text-violet-300 font-medium">Innovation Radar</span>
					</div>
					<svg class="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
					</svg>
					<div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
						<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
						</svg>
						<span class="text-emerald-300 font-medium">Incubator Catalog</span>
					</div>
				</div>
				<div class="flex-1 text-center md:text-left">
					<p class="text-zinc-300 text-sm">
						<strong>Innovation Radar</strong> is where we discover, research, and vote on new technologies. 
						The most promising innovations get <strong>promoted to the Incubator Catalog</strong> where they're implemented and ready for you to use!
					</p>
				</div>
				<a href="/innovations" class="shrink-0 px-4 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-sm font-medium transition-colors">
					Browse Radar →
				</a>
			</div>
		</div>
	</Card>

	<!-- Search and Filter -->
	<Card padding="md">
		<div class="flex flex-col md:flex-row gap-4">
			<form onsubmit={handleSearch} class="flex-1">
				<div class="relative">
					<input
						type="text"
						placeholder="Search implementations..."
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

		<!-- Active Filters -->
		{#if data.filters.department || data.filters.search}
			<div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
				<span class="text-sm text-text-muted">Active filters:</span>
				{#if data.filters.department}
					<button
						onclick={() => clearFilter('department')}
						class="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-sm"
					>
						{DEPARTMENT_LABELS[data.filters.department as DepartmentCategory]}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
				{#if data.filters.search}
					<button
						onclick={() => clearFilter('search')}
						class="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-sm"
					>
						"{data.filters.search}"
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
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

	<!-- Catalog Grid -->
	{#if data.catalogItems.length > 0}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{#each data.catalogItems as item (item.id)}
				<CatalogCard {item} />
			{/each}
		</div>
	{:else}
		<Card class="p-12 text-center">
			<div class="space-y-4">
				<div class="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
					<svg class="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
					</svg>
				</div>
				<h3 class="text-lg font-medium text-zinc-300">No implementations yet</h3>
				<p class="text-zinc-500 max-w-md mx-auto">
					{#if data.filters.department || data.filters.search}
						No implementations match your filters. Try adjusting your search criteria.
					{:else}
						The Incubator Catalog is waiting for its first implementations. Check back soon or browse the Innovation Radar to see what's being considered!
					{/if}
				</p>
				<a
					href="/innovations"
					class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-sm font-medium transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
					Browse Innovation Radar
				</a>
			</div>
		</Card>
	{/if}
</div>
