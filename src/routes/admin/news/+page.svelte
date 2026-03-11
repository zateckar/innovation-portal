<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Card, Button, Badge } from '$lib/components/ui';
	import { DEPARTMENT_LABELS } from '$lib/types';
	import type { DepartmentCategory } from '$lib/types';

	let { data, form } = $props();

	let runningJob = $state<string | null>(null);
	let expandedId = $state<string | null>(null);

	const departments: { value: string; label: string }[] = [
		{ value: '', label: 'All Departments' },
		...Object.entries(DEPARTMENT_LABELS).map(([value, label]) => ({ value, label }))
	];

	const statuses = [
		{ value: '', label: 'All Statuses' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'published', label: 'Published' },
		{ value: 'archived', label: 'Archived' }
	];

	function getStatusClasses(status: string): string {
		switch (status) {
			case 'draft': return 'bg-warning/20 text-warning border-warning/30';
			case 'published': return 'bg-success/20 text-success border-success/30';
			case 'archived': return 'bg-bg-hover text-text-muted border-border';
			default: return 'bg-bg-hover text-text-secondary border-border';
		}
	}

	function handleFilterChange(key: string, value: string) {
		const url = new URL($page.url);
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
		// Reset to page 1 when filter changes
		url.searchParams.delete('page');
		goto(url.toString(), { replaceState: true, invalidateAll: true });
	}

	function goToPage(p: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', String(p));
		goto(url.toString(), { replaceState: true, invalidateAll: true });
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<svelte:head>
	<title>News Management - Admin - Innovation Radar</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">News</h1>
			<p class="text-text-secondary mt-1">AI-curated digests from real innovations in the radar</p>
		</div>
		<div class="flex items-center gap-3">
			<form
				method="POST"
				action="?/generate"
				use:enhance={() => {
					runningJob = 'generate';
					return async ({ update }) => {
						await update();
						runningJob = null;
					};
				}}
			>
				<Button type="submit" variant="primary" loading={runningJob === 'generate'}>
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
					</svg>
					Generate News Now
				</Button>
			</form>
		</div>
	</div>

	<!-- Messages -->
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
		<div class="flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<label for="department-filter" class="text-sm text-text-muted">Department:</label>
				<select
					id="department-filter"
					class="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary"
					value={$page.url.searchParams.get('department') || ''}
					onchange={(e) => handleFilterChange('department', e.currentTarget.value)}
				>
					{#each departments as dept}
						<option value={dept.value}>{dept.label}</option>
					{/each}
				</select>
			</div>
			<div class="flex items-center gap-2">
				<label for="status-filter" class="text-sm text-text-muted">Status:</label>
				<select
					id="status-filter"
					class="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary"
					value={$page.url.searchParams.get('status') || ''}
					onchange={(e) => handleFilterChange('status', e.currentTarget.value)}
				>
					{#each statuses as s}
						<option value={s.value}>{s.label}</option>
					{/each}
				</select>
			</div>
		<span class="text-sm text-text-muted ml-auto">
			{data.total} article{data.total !== 1 ? 's' : ''} total
		</span>
		</div>
	</Card>

	<!-- News List -->
	{#if data.news.length > 0}
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="text-left text-text-muted text-sm border-b border-border">
						<th class="pb-3 font-medium">Title</th>
						<th class="pb-3 font-medium">Department</th>
						<th class="pb-3 font-medium">Status</th>
						<th class="pb-3 font-medium">Relevance</th>
						<th class="pb-3 font-medium">Created</th>
						<th class="pb-3 font-medium text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.news as article}
						<tr class="border-b border-border/50 hover:bg-bg-hover/50 transition-colors">
							<td class="py-3 pr-4">
								<button
									type="button"
									class="text-left text-text-primary font-medium hover:text-primary transition-colors max-w-md truncate block"
									onclick={() => toggleExpand(article.id)}
									title="Click to expand preview"
								>
									{article.title}
								</button>
							</td>
							<td class="py-3 pr-4">
								<span class="text-sm text-text-secondary">
									{DEPARTMENT_LABELS[article.category as DepartmentCategory] || article.category}
								</span>
							</td>
							<td class="py-3 pr-4">
								<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {getStatusClasses(article.status)}">
									{article.status}
								</span>
							</td>
							<td class="py-3 pr-4">
								{#if article.relevanceScore != null}
									<span class="text-sm text-text-secondary">{article.relevanceScore}/10</span>
								{:else}
									<span class="text-sm text-text-muted">—</span>
								{/if}
							</td>
							<td class="py-3 pr-4 text-sm text-text-muted whitespace-nowrap">
								{article.createdAt ? new Date(article.createdAt).toLocaleDateString() : '—'}
							</td>
							<td class="py-3 text-right">
								<div class="flex items-center justify-end gap-2">
									{#if article.status === 'draft'}
										<form method="POST" action="?/publish" use:enhance>
											<input type="hidden" name="id" value={article.id} />
											<Button type="submit" variant="primary" size="sm">Publish</Button>
										</form>
									{/if}
									{#if article.status === 'published'}
										<form method="POST" action="?/archive" use:enhance>
											<input type="hidden" name="id" value={article.id} />
											<Button type="submit" variant="ghost" size="sm">Archive</Button>
										</form>
									{/if}
									<form method="POST" action="?/delete" use:enhance>
										<input type="hidden" name="id" value={article.id} />
										<Button
											type="submit"
											variant="danger"
											size="sm"
											onclick={(e: MouseEvent) => {
												if (!confirm('Are you sure you want to delete this article? This cannot be undone.')) {
													e.preventDefault();
												}
											}}
										>
											Delete
										</Button>
									</form>
								</div>
							</td>
						</tr>
						{#if expandedId === article.id}
							<tr class="bg-bg-hover/30">
								<td colspan="6" class="px-4 py-4">
									<div class="text-sm text-text-secondary max-w-3xl">
										<p class="font-medium text-text-primary mb-2">Preview:</p>
										<p>{article.summary.slice(0, 200)}{article.summary.length > 200 ? '...' : ''}</p>
										{#if article.publishedAt}
											<p class="text-xs text-text-muted mt-2">
												Published: {new Date(article.publishedAt).toLocaleString()}
											</p>
										{/if}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<Card padding="lg" class="text-center">
			<p class="text-text-muted mb-2">No news articles found</p>
			<p class="text-sm text-text-secondary">
				Use the <strong>Generate News Now</strong> button to create AI-generated news articles.
			</p>
		</Card>
	{/if}

	<!-- Pagination -->
	{#if data.total > data.limit}
		{@const totalPages = Math.ceil(data.total / data.limit)}
		<div class="flex items-center justify-between pt-2">
			<span class="text-sm text-text-muted">
				Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}
			</span>
			<div class="flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					disabled={data.page <= 1}
					onclick={() => goToPage(data.page - 1)}
				>
					&larr; Prev
				</Button>
				{#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
					<button
						type="button"
						class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors {p === data.page ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-hover'}"
						onclick={() => goToPage(p)}
					>
						{p}
					</button>
				{/each}
				<Button
					variant="ghost"
					size="sm"
					disabled={data.page >= totalPages}
					onclick={() => goToPage(data.page + 1)}
				>
					Next &rarr;
				</Button>
			</div>
		</div>
	{/if}
</div>
