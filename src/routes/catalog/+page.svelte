<script lang="ts">
	import { Card, Input, Select } from '$lib/components/ui';
	import { CatalogCard } from '$lib/components/catalog';
	import { CATEGORY_LABELS, CATEGORY_COLORS, type InnovationCategory } from '$lib/types';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { loadFilters, saveFilters } from '$lib/stores/filters';

	let { data } = $props();

	let searchQuery = $state('');
	let selectedCategory = $state('');

	// On mount, if no URL filters are active, restore from localStorage
	$effect(() => {
		const urlCategory = data.filters.category;
		const urlSearch = data.filters.search;
		const hasUrlFilters = urlCategory || urlSearch;

		if (!hasUrlFilters) {
			const saved = loadFilters('catalog');
			if (saved.category || saved.q) {
				const params = new URLSearchParams();
				if (saved.category) params.set('category', saved.category);
				if (saved.q) params.set('q', saved.q);
				goto(`/catalog?${params.toString()}`, { replaceState: true });
				return;
			}
		}

		searchQuery = urlSearch || '';
		selectedCategory = urlCategory || '';
	});

	const categories: { value: string; label: string }[] = [
		{ value: '', label: 'All Categories' },
		...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
	];

	function handleSearch(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams($page.url.searchParams);
		if (searchQuery) {
			params.set('q', searchQuery);
		} else {
			params.delete('q');
		}
		saveFilters('catalog', { category: params.get('category') || '', q: params.get('q') || '' });
		goto(`/catalog?${params.toString()}`);
	}

	function handleCategoryChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const params = new URLSearchParams($page.url.searchParams);
		if (target.value) {
			params.set('category', target.value);
		} else {
			params.delete('category');
		}
		saveFilters('catalog', { category: params.get('category') || '', q: params.get('q') || '' });
		goto(`/catalog?${params.toString()}`);
	}

	function clearFilter(filter: 'category' | 'search') {
		const params = new URLSearchParams($page.url.searchParams);
		if (filter === 'category') {
			params.delete('category');
			selectedCategory = '';
		} else {
			params.delete('q');
			searchQuery = '';
		}
		saveFilters('catalog', { category: params.get('category') || '', q: params.get('q') || '' });
		goto(`/catalog?${params.toString()}`);
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
	<div class="flex flex-col sm:flex-row gap-4">
		<form onsubmit={handleSearch} class="flex-1">
			<Input
				type="search"
				placeholder="Search implementations..."
				value={searchQuery}
				oninput={(e) => searchQuery = e.currentTarget.value}
			/>
		</form>
		<div class="sm:w-48">
			<Select
				value={selectedCategory}
				onchange={handleCategoryChange}
			>
				{#each categories as cat}
					<option value={cat.value}>{cat.label}</option>
				{/each}
			</Select>
		</div>
	</div>

	<!-- Active Filters -->
	{#if data.filters.category || data.filters.search}
		<div class="flex flex-wrap gap-2">
			{#if data.filters.category}
				<button
					onclick={() => clearFilter('category')}
					class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
					style="background-color: {CATEGORY_COLORS[data.filters.category as InnovationCategory]}20; color: {CATEGORY_COLORS[data.filters.category as InnovationCategory]};"
				>
					{CATEGORY_LABELS[data.filters.category as InnovationCategory]}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
			{#if data.filters.search}
				<button
					onclick={() => clearFilter('search')}
					class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-zinc-700 text-zinc-300"
				>
					"{data.filters.search}"
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	{/if}

	<!-- Category Quick Links -->
	{#if !data.filters.category && !data.filters.search}
		<div class="flex flex-wrap gap-2">
			{#each Object.entries(CATEGORY_LABELS) as [value, label]}
				{@const count = data.categoryCounts[value] || 0}
				{#if count > 0}
					<a
						href="/catalog?category={value}"
						class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors hover:opacity-80"
						style="background-color: {CATEGORY_COLORS[value as InnovationCategory]}20; color: {CATEGORY_COLORS[value as InnovationCategory]}; border: 1px solid {CATEGORY_COLORS[value as InnovationCategory]}30;"
					>
						{label}
						<span class="px-1.5 py-0.5 rounded-full text-xs" style="background-color: {CATEGORY_COLORS[value as InnovationCategory]}30;">
							{count}
						</span>
					</a>
				{/if}
			{/each}
		</div>
	{/if}

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
					{#if data.filters.category || data.filters.search}
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
