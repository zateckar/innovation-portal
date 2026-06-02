<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Card } from '$lib/components/ui';
	import { TrendCard } from '$lib/components/trends';
	import {
		TREND_GROUP_LABELS,
		TREND_GROUP_COLORS,
		DEPARTMENT_LABELS,
		DEPARTMENT_COLORS,
		type TrendCategoryGroup,
		type TrendSummary,
		type DepartmentCategory
	} from '$lib/types';
	import { loadFilters, saveFilters } from '$lib/stores/filters';

	let { data } = $props();

	let searchQuery = $state('');

	$effect(() => {
		const urlGroup = data.filters.categoryGroup;
		const urlDept = data.filters.department;
		const urlSearch = data.filters.search;
		const hasUrlFilters = urlGroup || urlDept || urlSearch;

		if (!hasUrlFilters) {
			const saved = loadFilters('trends');
			if (saved.group || saved.department || saved.q) {
				const params = new URLSearchParams();
				if (saved.group) params.set('group', saved.group);
				if (saved.department) params.set('dept', saved.department);
				if (saved.q) params.set('q', saved.q);
				goto(`?${params.toString()}`, { keepFocus: true, replaceState: true });
				return;
			}
		}

		searchQuery = urlSearch || '';
	});

	const groups: [TrendCategoryGroup, string][] = [
		['automotive', TREND_GROUP_LABELS.automotive],
		['department', TREND_GROUP_LABELS.department],
		['it', TREND_GROUP_LABELS.it]
	];

	const departments = Object.entries(DEPARTMENT_LABELS) as [DepartmentCategory, string][];

	function updateFilters(updates: Record<string, string | null>) {
		const params = new URLSearchParams($page.url.searchParams);
		for (const [key, value] of Object.entries(updates)) {
			if (value) params.set(key, value);
			else params.delete(key);
		}
		saveFilters('trends', {
			group: params.get('group') || '',
			department: params.get('dept') || '',
			q: params.get('q') || ''
		});
		goto(`?${params.toString()}`, { keepFocus: true });
	}

	function handleSearch(e: Event) {
		e.preventDefault();
		updateFilters({ q: searchQuery || null });
	}

	// Group trends by categoryGroup for display
	const groupedTrends = $derived(() => {
		const grouped: Record<TrendCategoryGroup, TrendSummary[]> = {
			automotive: [],
			department: [],
			it: []
		};
		for (const t of data.trends) {
			const group = t.categoryGroup as TrendCategoryGroup;
			if (grouped[group]) {
				grouped[group].push(t);
			}
		}
		return grouped;
	});
</script>

<svelte:head>
	<title>Industry Trends - Innovation Radar</title>
</svelte:head>

<div class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header with animated gradient -->
	<div class="mb-8 relative">
		<div class="absolute -top-4 -left-4 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none" style="background: radial-gradient(circle, #FF7D55 0%, transparent 70%);"></div>
		<h1 class="text-3xl font-bold text-text-primary mb-2 relative">
			<span style="background: linear-gradient(135deg, #FF7D55, #93D9FF); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">Industry Trends</span>
		</h1>
		<p class="text-text-secondary relative">AI-researched long-term trends across automotive, enterprise departments, and IT focus areas</p>
	</div>

	<!-- Filters -->
	<Card padding="md" class="mb-8">
		<div class="flex flex-col md:flex-row gap-4">
			<!-- Search -->
			<form onsubmit={handleSearch} class="flex-1">
				<div class="relative">
					<input
						type="text"
						placeholder="Search trends..."
						bind:value={searchQuery}
						class="w-full px-4 py-2 pl-10 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
					/>
					<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
					</svg>
				</div>
			</form>

			<!-- Group filter -->
			<select
				value={data.filters.categoryGroup || ''}
				onchange={(e) => updateFilters({ group: e.currentTarget.value || null })}
				class="px-4 py-2 rounded-lg bg-bg-surface border border-border text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
			>
				<option value="">All Groups</option>
				{#each groups as [value, label]}
					<option {value}>{label}</option>
				{/each}
			</select>

			<!-- Department filter (single source of truth from $lib/types DEPARTMENTS) -->
			<select
				value={data.filters.department || ''}
				onchange={(e) => updateFilters({ dept: e.currentTarget.value || null })}
				class="px-4 py-2 rounded-lg bg-bg-surface border border-border text-text-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
			>
				<option value="">All Departments</option>
				{#each departments as [value, label]}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>

		<!-- Active filters -->
		{#if data.filters.categoryGroup || data.filters.department || data.filters.search}
			<div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
				<span class="text-sm text-text-muted">Active filters:</span>
				{#if data.filters.categoryGroup}
					<button
						onclick={() => updateFilters({ group: null })}
						class="inline-flex items-center gap-1 px-2 py-1 rounded text-sm"
						style="background: {TREND_GROUP_COLORS[data.filters.categoryGroup as TrendCategoryGroup]}20; color: {TREND_GROUP_COLORS[data.filters.categoryGroup as TrendCategoryGroup]};"
					>
						{TREND_GROUP_LABELS[data.filters.categoryGroup as TrendCategoryGroup]}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				{/if}
				{#if data.filters.department}
					{@const deptColor = DEPARTMENT_COLORS[data.filters.department as DepartmentCategory]}
					<button
						onclick={() => updateFilters({ dept: null })}
						class="inline-flex items-center gap-1 px-2 py-1 rounded text-sm"
						style="background: {deptColor}20; color: {deptColor};"
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
					onclick={() => { searchQuery = ''; updateFilters({ group: null, dept: null, q: null }); }}
					class="text-sm text-text-muted hover:text-text-primary ml-2"
				>
					Clear all
				</button>
			</div>
		{/if}
	</Card>

	<!-- Results -->
	{#if data.trends.length > 0}
		{@const grouped = groupedTrends()}
		{#each (['automotive', 'department', 'it'] as TrendCategoryGroup[]) as group}
			{@const items = data.filters.categoryGroup ? (data.filters.categoryGroup === group ? grouped[group] : []) : grouped[group]}
			{#if items.length > 0}
				<div class="mb-10">
					<!-- Group header -->
					<div class="flex items-center gap-3 mb-5">
						<div class="w-1 h-8 rounded-full" style="background: {TREND_GROUP_COLORS[group]};"></div>
						<h2 class="text-xl font-bold" style="color: {TREND_GROUP_COLORS[group]};">
							{TREND_GROUP_LABELS[group]}
						</h2>
						<span class="text-xs text-text-muted px-2 py-0.5 rounded-full bg-bg-elevated">{items.length} trend{items.length !== 1 ? 's' : ''}</span>
					</div>

					<!-- Trend cards grid -->
					<div class="list-card-grid grid grid-cols-1 gap-4">
						{#each items as trend (trend.id)}
							<div class="animate-fade-in">
								<TrendCard {trend} />
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{:else}
		<div class="text-center py-16">
			<div class="w-20 h-20 mx-auto mb-6 rounded-full bg-bg-elevated flex items-center justify-center">
				<svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-text-primary mb-2">No trends found</h2>
			<p class="text-text-secondary mb-6">
				{#if data.filters.search || data.filters.categoryGroup || data.filters.department}
					Try adjusting your filters or search query
				{:else}
					No trend analyses have been published yet. Check back soon!
				{/if}
			</p>
			{#if data.filters.search || data.filters.categoryGroup || data.filters.department}
				<button
					onclick={() => { searchQuery = ''; updateFilters({ group: null, dept: null, q: null }); }}
					class="px-4 py-2 rounded-lg bg-bg-elevated text-text-primary hover:bg-bg-hover transition-colors"
				>
					Clear filters
				</button>
			{/if}
		</div>
	{/if}
</div>
