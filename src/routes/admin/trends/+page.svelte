<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Card, Button } from '$lib/components/ui';
	import {
		TREND_CATEGORIES,
		TREND_GROUP_LABELS,
		TREND_GROUP_COLORS,
		MATURITY_LABELS,
		MATURITY_COLORS,
		type TrendCategoryGroup,
		type TrendMaturityLevel
	} from '$lib/types';

	let { data, form } = $props();

	let generating = $state(false);
	let expandedId = $state<string | null>(null);

	function formatDate(d: Date | null | undefined): string {
		if (!d) return '—';
		return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function getCatInfo(key: string) {
		return TREND_CATEGORIES[key] || { label: key, icon: '📊', color: '#94A3B8', group: 'it' };
	}

	const statusColors: Record<string, string> = {
		draft: '#F59E0B',
		published: '#10B981',
		archived: '#6B7280'
	};

	function updateFilter(key: string, value: string | null) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) params.set(key, value);
		else params.delete(key);
		params.delete('page');
		goto(`?${params.toString()}`, { keepFocus: true });
	}
</script>

<svelte:head>
	<title>Trends Management - Admin - Innovation Radar</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Trends Management</h1>
			<p class="text-text-secondary mt-1">Manage AI-generated trend analyses across {Object.keys(TREND_CATEGORIES).length} categories</p>
		</div>
		<form
			method="POST"
			action="?/generate"
			use:enhance={() => {
				generating = true;
				return async ({ update }) => { await update({ reset: false }); generating = false; };
			}}
		>
			<Button type="submit" variant="primary" loading={generating}>
				<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
				</svg>
				Generate All Trends
			</Button>
		</form>
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

	<!-- Filters -->
	<Card padding="md">
		<div class="flex flex-wrap gap-3">
			<select
				value={$page.url.searchParams.get('group') || ''}
				onchange={(e) => updateFilter('group', e.currentTarget.value || null)}
				class="px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:border-primary focus:ring-1 focus:ring-primary"
			>
				<option value="">All Groups</option>
				{#each Object.entries(TREND_GROUP_LABELS) as [value, label]}
					<option {value}>{label}</option>
				{/each}
			</select>

			<select
				value={$page.url.searchParams.get('status') || ''}
				onchange={(e) => updateFilter('status', e.currentTarget.value || null)}
				class="px-3 py-1.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:border-primary focus:ring-1 focus:ring-primary"
			>
				<option value="">All Statuses</option>
				<option value="published">Published</option>
				<option value="draft">Draft</option>
				<option value="archived">Archived</option>
			</select>

			<span class="ml-auto text-sm text-text-muted self-center">{data.total} total</span>
		</div>
	</Card>

	<!-- Trends Table -->
	{#if data.trends.length > 0}
		<div class="space-y-2">
			{#each data.trends as trend (trend.id)}
				{@const catInfo = getCatInfo(trend.category)}
				{@const isExpanded = expandedId === trend.id}
				<Card padding="none">
					<!-- Row header -->
					<button
						type="button"
						onclick={() => expandedId = isExpanded ? null : trend.id}
						class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-bg-hover/50 transition-colors"
					>
						<!-- Category icon -->
						<span class="text-lg shrink-0">{catInfo.icon}</span>

						<!-- Title + category -->
						<div class="flex-1 min-w-0">
							<div class="font-medium text-text-primary text-sm truncate">{trend.title}</div>
							<div class="flex items-center gap-2 mt-0.5">
								<span class="text-xs" style="color: {catInfo.color};">{catInfo.label}</span>
								<span class="text-text-muted text-xs">·</span>
								<span class="text-xs" style="color: {TREND_GROUP_COLORS[trend.categoryGroup as TrendCategoryGroup]};">
									{TREND_GROUP_LABELS[trend.categoryGroup as TrendCategoryGroup]}
								</span>
							</div>
						</div>

						<!-- Maturity -->
						{#if trend.maturityLevel}
							<span class="hidden md:inline text-xs font-medium px-2 py-0.5 rounded"
								style="color: {MATURITY_COLORS[trend.maturityLevel as TrendMaturityLevel]}; background: {MATURITY_COLORS[trend.maturityLevel as TrendMaturityLevel]}15;">
								{MATURITY_LABELS[trend.maturityLevel as TrendMaturityLevel]}
							</span>
						{/if}

						<!-- Status -->
						<span class="text-xs font-medium px-2 py-0.5 rounded capitalize"
							style="color: {statusColors[trend.status] || '#94A3B8'}; background: {statusColors[trend.status] || '#94A3B8'}15;">
							{trend.status}
						</span>

						<!-- Date -->
						<span class="hidden sm:inline text-xs text-text-muted w-28 text-right">{formatDate(trend.publishedAt || trend.createdAt)}</span>

						<!-- Expand chevron -->
						<svg class="w-4 h-4 text-text-muted transition-transform {isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</button>

					<!-- Expanded detail -->
					{#if isExpanded}
						<div class="border-t border-border px-5 py-4 space-y-4">
							<!-- Summary -->
							<p class="text-sm text-text-secondary">{trend.summary}</p>

							<!-- Meta grid -->
							<div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
								<div>
									<span class="text-text-muted block">Impact Score</span>
									<span class="text-text-primary font-medium">{trend.impactScore !== null ? Math.round((trend.impactScore ?? 0) * 100) + '%' : '—'}</span>
								</div>
								<div>
									<span class="text-text-muted block">Time Horizon</span>
									<span class="text-text-primary font-medium capitalize">{trend.timeHorizon?.replace('-', ' ') || '—'}</span>
								</div>
								<div>
									<span class="text-text-muted block">Generated</span>
									<span class="text-text-primary font-medium">{formatDate(trend.generatedAt)}</span>
								</div>
								<div>
									<span class="text-text-muted block">Published</span>
									<span class="text-text-primary font-medium">{formatDate(trend.publishedAt)}</span>
								</div>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-2 pt-2 border-t border-border">
								{#if trend.status !== 'published'}
									<form method="POST" action="?/publish" use:enhance>
										<input type="hidden" name="id" value={trend.id}>
										<Button type="submit" variant="ghost" size="sm">Publish</Button>
									</form>
								{/if}
								{#if trend.status !== 'archived'}
									<form method="POST" action="?/archive" use:enhance>
										<input type="hidden" name="id" value={trend.id}>
										<Button type="submit" variant="ghost" size="sm">Archive</Button>
									</form>
								{/if}
								<a href="/trends/{trend.slug}" target="_blank" class="text-xs text-primary hover:underline ml-auto">
									View →
								</a>
								<form method="POST" action="?/delete" use:enhance={() => {
									return async ({ update }) => {
										if (confirm('Delete this trend analysis? This cannot be undone.')) {
											await update({ reset: false });
										}
									};
								}}>
									<input type="hidden" name="id" value={trend.id}>
									<Button type="submit" variant="ghost" size="sm" class="text-error hover:text-error">Delete</Button>
								</form>
							</div>
						</div>
					{/if}
				</Card>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.total > data.limit}
			<div class="flex items-center justify-center gap-3">
				{#if data.page > 1}
					<a
						href="?page={data.page - 1}&{$page.url.searchParams.toString().replace(/page=\d+&?/, '')}"
						class="px-3 py-1.5 rounded-lg bg-bg-elevated text-text-secondary text-sm hover:bg-bg-hover"
					>Previous</a>
				{/if}
				<span class="text-sm text-text-muted">Page {data.page} of {Math.ceil(data.total / data.limit)}</span>
				{#if data.page * data.limit < data.total}
					<a
						href="?page={data.page + 1}&{$page.url.searchParams.toString().replace(/page=\d+&?/, '')}"
						class="px-3 py-1.5 rounded-lg bg-bg-elevated text-text-secondary text-sm hover:bg-bg-hover"
					>Next</a>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="text-center py-16">
			<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-bg-elevated flex items-center justify-center">
				<svg class="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
				</svg>
			</div>
			<h2 class="text-lg font-semibold text-text-primary mb-2">No trends yet</h2>
			<p class="text-text-secondary mb-4">Click "Generate All Trends" to create AI-powered trend analyses for all categories.</p>
		</div>
	{/if}
</div>
