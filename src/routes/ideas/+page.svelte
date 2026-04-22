<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import IdeaCard from '$lib/components/ideas/IdeaCard.svelte';
	import { Card } from '$lib/components/ui';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS, type DepartmentCategory } from '$lib/types';
	import { loadFilters, saveFilters } from '$lib/stores/filters';

	let { data } = $props();

	let searchQuery = $state('');
	let deptDropdownOpen = $state(false);
	let deptDropdownEl: HTMLDivElement | null = $state(null);

	// On mount, if no URL filters are active, restore from localStorage
	$effect(() => {
		const urlDepartments = data.filters.departments;
		const urlSearch = data.filters.search;
		const urlSort = data.filters.sort;
		const hasUrlFilters = urlDepartments.length > 0 || urlSearch || (urlSort && urlSort !== 'recent');

		if (!hasUrlFilters) {
			const saved = loadFilters('ideas');
			// `departments` is stored as a comma-separated string for compatibility
			// with the FilterMap type; legacy `department` (single) is also honoured.
			const savedDepartments = saved.departments
				? saved.departments.split(',').filter(Boolean)
				: saved.department
					? [saved.department]
					: [];
			if (savedDepartments.length > 0 || saved.q || saved.sort) {
				const params = new URLSearchParams();
				for (const d of savedDepartments) params.append('department', d);
				if (saved.q) params.set('q', saved.q);
				if (saved.sort) params.set('sort', saved.sort);
				goto(`?${params.toString()}`, { keepFocus: true, replaceState: true });
				return;
			}
		}

		searchQuery = urlSearch || '';
	});

	// Close the department dropdown when clicking outside
	$effect(() => {
		if (!deptDropdownOpen) return;
		function onDocClick(e: MouseEvent) {
			if (deptDropdownEl && !deptDropdownEl.contains(e.target as Node)) {
				deptDropdownOpen = false;
			}
		}
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});

	const departments = Object.entries(DEPARTMENT_LABELS) as [DepartmentCategory, string][];

	type FilterUpdates = {
		departments?: string[] | null;
		q?: string | null;
		sort?: string | null;
	};

	function updateFilters(updates: FilterUpdates) {
		const params = new URLSearchParams($page.url.searchParams);

		if ('departments' in updates) {
			params.delete('department');
			if (updates.departments && updates.departments.length > 0) {
				for (const d of updates.departments) params.append('department', d);
			}
		}
		if ('q' in updates) {
			if (updates.q) params.set('q', updates.q);
			else params.delete('q');
		}
		if ('sort' in updates) {
			if (updates.sort) params.set('sort', updates.sort);
			else params.delete('sort');
		}

		// Persist to localStorage (multi-department stored as CSV)
		const persistedDepartments = params.getAll('department').join(',');
		saveFilters('ideas', {
			departments: persistedDepartments,
			department: '', // clear legacy single value so it can't shadow
			q: params.get('q') || '',
			sort: params.get('sort') || ''
		});

		goto(`?${params.toString()}`, { keepFocus: true });
	}

	function toggleDepartment(value: DepartmentCategory) {
		const current = new Set(data.filters.departments);
		if (current.has(value)) current.delete(value);
		else current.add(value);
		updateFilters({ departments: Array.from(current) });
	}

	function removeDepartment(value: DepartmentCategory) {
		updateFilters({
			departments: data.filters.departments.filter((d) => d !== value)
		});
	}

	function handleSearch(e: Event) {
		e.preventDefault();
		updateFilters({ q: searchQuery || null });
	}

	const selectedDeptCount = $derived(data.filters.departments.length);
	const deptButtonLabel = $derived(
		selectedDeptCount === 0
			? 'All Departments'
			: selectedDeptCount === 1
				? DEPARTMENT_LABELS[data.filters.departments[0] as DepartmentCategory]
				: `${selectedDeptCount} Departments`
	);
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

			<!-- Department multi-select -->
			<div class="relative" bind:this={deptDropdownEl}>
				<button
					type="button"
					onclick={() => (deptDropdownOpen = !deptDropdownOpen)}
					aria-haspopup="listbox"
					aria-expanded={deptDropdownOpen}
					class="w-full md:w-56 flex items-center justify-between gap-2 px-4 py-2 rounded-lg bg-bg-surface border border-border text-text-primary hover:border-primary focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
				>
					<span class="truncate text-left">
						{deptButtonLabel}
						{#if selectedDeptCount > 1}
							<span class="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs rounded-full bg-primary/20 text-primary">{selectedDeptCount}</span>
						{/if}
					</span>
					<svg
						class="w-4 h-4 text-text-muted transition-transform shrink-0 {deptDropdownOpen ? 'rotate-180' : ''}"
						fill="none" stroke="currentColor" viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
					</svg>
				</button>

				{#if deptDropdownOpen}
					<div
						role="listbox"
						aria-multiselectable="true"
						class="absolute z-20 mt-2 w-full md:w-64 rounded-lg border border-border bg-bg-surface shadow-lg max-h-72 overflow-y-auto"
					>
						<div class="flex items-center justify-between px-3 py-2 border-b border-border text-xs">
							<span class="text-text-muted">
								{selectedDeptCount} selected
							</span>
							{#if selectedDeptCount > 0}
								<button
									type="button"
									onclick={() => updateFilters({ departments: [] })}
									class="text-primary hover:underline"
								>
									Clear
								</button>
							{/if}
						</div>
						<ul class="py-1">
							{#each departments as [value, label]}
								{@const checked = data.filters.departments.includes(value)}
								<li>
									<label class="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover cursor-pointer">
										<input
											type="checkbox"
											{checked}
											onchange={() => toggleDepartment(value)}
											class="w-4 h-4 rounded border-border bg-bg-surface text-primary focus:ring-primary focus:ring-offset-0"
										/>
										<span
											class="inline-block w-2 h-2 rounded-full"
											style="background-color: {DEPARTMENT_COLORS[value]}"
										></span>
										<span class="flex-1 truncate">{label}</span>
									</label>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

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
		{#if selectedDeptCount > 0 || data.filters.search}
			<div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
				<span class="text-sm text-text-muted">Active filters:</span>
				{#each data.filters.departments as dept}
					<button
						onclick={() => removeDepartment(dept as DepartmentCategory)}
						class="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-sm"
					>
						{DEPARTMENT_LABELS[dept as DepartmentCategory]}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				{/each}
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
					onclick={() => { searchQuery = ''; updateFilters({ departments: [], q: null, sort: null }); }}
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
					<IdeaCard {idea} voteThreshold={data.voteThreshold} />
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
				{#if data.filters.search || selectedDeptCount > 0}
					Try adjusting your filters or search query
				{:else}
					No innovation ideas have been published yet
				{/if}
			</p>
			{#if data.filters.search || selectedDeptCount > 0}
				<button
					onclick={() => { searchQuery = ''; updateFilters({ departments: [], q: null }); }}
					class="px-4 py-2 rounded-lg bg-bg-elevated text-text-primary hover:bg-bg-hover transition-colors"
				>
					Clear filters
				</button>
			{/if}
		</div>
	{/if}
</div>
