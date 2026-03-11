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
		{ value: 'evaluated', label: 'Evaluated' },
		{ value: 'realized', label: 'Realized' },
		{ value: 'published', label: 'Published' },
		{ value: 'archived', label: 'Archived' }
	];

	const sources = [
		{ value: '', label: 'All Sources' },
		{ value: 'ai', label: 'AI Generated' },
		{ value: 'jira', label: 'Jira' }
	];

	function getStatusClasses(status: string): string {
		switch (status) {
			case 'draft': return 'bg-bg-hover text-text-muted border-border';
			case 'evaluated': return 'bg-primary/20 text-primary border-primary/30';
			case 'realized': return 'bg-secondary/20 text-secondary border-secondary/30';
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

	function truncateBatchId(batchId: string | null): string {
		if (!batchId) return '—';
		return batchId.length > 8 ? batchId.slice(0, 8) + '...' : batchId;
	}

	interface BatchSummary {
		batchId: string;
		label: string;       // human-readable name, e.g. "IT · 5 ideas · 7 Mar 2026"
		count: number;
		departments: string[];
		date: Date | null;
		source: string;
	}

	// Group ideas by batchId and derive a human-readable label for each batch
	function getBatches(): BatchSummary[] {
		const map = new Map<string, BatchSummary>();
		for (const idea of data.ideas) {
			if (!idea.batchId) continue;
			if (!map.has(idea.batchId)) {
				map.set(idea.batchId, {
					batchId: idea.batchId,
					label: '',
					count: 0,
					departments: [],
					date: idea.createdAt ? new Date(idea.createdAt) : null,
					source: idea.source ?? 'ai'
				});
			}
			const b = map.get(idea.batchId)!;
			b.count++;
			const deptLabel = DEPARTMENT_LABELS[idea.department as DepartmentCategory] ?? idea.department;
			if (deptLabel && !b.departments.includes(deptLabel)) b.departments.push(deptLabel);
		}

		for (const b of map.values()) {
			const deptPart = b.departments.length > 0
				? b.departments.slice(0, 3).join(', ') + (b.departments.length > 3 ? ` +${b.departments.length - 3}` : '')
				: 'Mixed';
			const datePart = b.date
				? b.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
				: '';
			const sourcePart = b.source === 'jira' ? 'Jira' : 'AI';
			b.label = [sourcePart, deptPart, `${b.count} idea${b.count !== 1 ? 's' : ''}`, datePart]
				.filter(Boolean)
				.join(' · ');
		}

		return Array.from(map.values()).sort((a, b) =>
			(b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)
		);
	}
</script>

<svelte:head>
	<title>Ideas Management - Admin - Innovation Radar</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Ideas</h1>
			<p class="text-text-secondary mt-1">Generate, evaluate, and manage AI-generated innovation ideas</p>
		</div>
		<div class="flex items-center gap-3">
			<form
				method="POST"
				action="?/importJira"
				use:enhance={() => {
					runningJob = 'importJira';
					return async ({ update }) => {
						await update();
						runningJob = null;
					};
				}}
			>
				<Button type="submit" variant="secondary" loading={runningJob === 'importJira'}>
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
					</svg>
					Import from Jira
				</Button>
			</form>
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
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
					Generate Ideas Now
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
			<div class="flex items-center gap-2">
				<label for="source-filter" class="text-sm text-text-muted">Source:</label>
				<select
					id="source-filter"
					class="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-primary"
					value={$page.url.searchParams.get('source') || ''}
					onchange={(e) => handleFilterChange('source', e.currentTarget.value)}
				>
					{#each sources as src}
						<option value={src.value}>{src.label}</option>
					{/each}
				</select>
			</div>
		<span class="text-sm text-text-muted ml-auto">
			{data.total} idea{data.total !== 1 ? 's' : ''} total
		</span>
		</div>
	</Card>

	<!-- Batch Actions -->
	{#if getBatches().length > 0}
		<Card padding="md">
			<h3 class="text-sm font-semibold text-text-primary mb-1">Batch Actions</h3>
			<p class="text-xs text-text-muted mb-3">Run AI evaluation or realization across an entire generation batch</p>
			<div class="space-y-2">
				{#each getBatches() as batch}
					<div class="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-elevated border border-border">
						<div class="flex-1 min-w-0">
							<span class="text-sm text-text-primary">{batch.label}</span>
							<span class="ml-2 text-xs text-text-muted font-mono" title={batch.batchId}>
								#{truncateBatchId(batch.batchId)}
							</span>
						</div>
						<div class="flex gap-2 shrink-0">
							<form
								method="POST"
								action="?/evaluate"
								use:enhance={() => {
									runningJob = `evaluate-${batch.batchId}`;
									return async ({ update }) => {
										await update();
										runningJob = null;
									};
								}}
							>
								<input type="hidden" name="batchId" value={batch.batchId} />
								<Button type="submit" variant="secondary" size="sm" loading={runningJob === `evaluate-${batch.batchId}`}>
									Evaluate
								</Button>
							</form>
							<form
								method="POST"
								action="?/realize"
								use:enhance={() => {
									runningJob = `realize-${batch.batchId}`;
									return async ({ update }) => {
										await update();
										runningJob = null;
									};
								}}
							>
								<input type="hidden" name="batchId" value={batch.batchId} />
								<Button type="submit" variant="secondary" size="sm" loading={runningJob === `realize-${batch.batchId}`}>
									Realize Top
								</Button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</Card>
	{/if}

	<!-- Ideas List -->
	{#if data.ideas.length > 0}
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="text-left text-text-muted text-sm border-b border-border">
						<th class="pb-3 font-medium">Title</th>
						<th class="pb-3 font-medium">Source</th>
						<th class="pb-3 font-medium">Department</th>
						<th class="pb-3 font-medium">Status</th>
						<th class="pb-3 font-medium">Score</th>
						<th class="pb-3 font-medium">Rank</th>
						<th class="pb-3 font-medium">Batch</th>
						<th class="pb-3 font-medium">Votes</th>
						<th class="pb-3 font-medium">Created</th>
						<th class="pb-3 font-medium text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.ideas as idea}
						<tr class="border-b border-border/50 hover:bg-bg-hover/50 transition-colors">
							<td class="py-3 pr-4">
								<button
									type="button"
									class="text-left text-text-primary font-medium hover:text-primary transition-colors max-w-xs truncate block"
									onclick={() => toggleExpand(idea.id)}
									title="Click to expand preview"
								>
									{idea.title}
								</button>
							</td>
							<td class="py-3 pr-4">
								{#if idea.source === 'jira'}
									<div class="flex flex-col gap-1">
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
											</svg>
											Jira
										</span>
										{#if idea.jiraIssueKey && idea.jiraIssueUrl}
											<a
												href={idea.jiraIssueUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline"
												title="Open in Jira"
											>
												{idea.jiraIssueKey} ↗
											</a>
										{:else if idea.jiraIssueKey}
											<span class="text-xs font-mono text-text-muted">{idea.jiraIssueKey}</span>
										{/if}
									</div>
								{:else}
									<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-bg-hover text-text-muted border border-border">
										AI
									</span>
								{/if}
							</td>
							<td class="py-3 pr-4">
								<span class="text-sm text-text-secondary">
									{DEPARTMENT_LABELS[idea.department as DepartmentCategory] || idea.department}
								</span>
							</td>
							<td class="py-3 pr-4">
								<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {getStatusClasses(idea.status)}">
									{idea.status}
								</span>
							</td>
							<td class="py-3 pr-4">
								{#if idea.evaluationScore != null}
									<div class="flex items-center gap-2">
										<div class="w-16 h-2 rounded-full bg-bg-elevated overflow-hidden">
											<div
												class="h-full rounded-full {idea.evaluationScore >= 7 ? 'bg-success' : idea.evaluationScore >= 4 ? 'bg-warning' : 'bg-error'}"
												style="width: {Math.min(idea.evaluationScore * 10, 100)}%"
											></div>
										</div>
										<span class="text-xs text-text-secondary">{idea.evaluationScore.toFixed(1)}</span>
									</div>
								{:else}
									<span class="text-sm text-text-muted">—</span>
								{/if}
							</td>
							<td class="py-3 pr-4">
								{#if idea.rank != null}
									<span class="text-sm text-text-secondary">#{idea.rank}</span>
								{:else}
									<span class="text-sm text-text-muted">—</span>
								{/if}
							</td>
							<td class="py-3 pr-4">
								{#if idea.batchId}
									<span
										class="text-xs font-mono text-text-muted cursor-help"
										title={idea.batchId}
									>
										{truncateBatchId(idea.batchId)}
									</span>
								{:else}
									<span class="text-sm text-text-muted">—</span>
								{/if}
							</td>
							<td class="py-3 pr-4">
								<span class="text-sm text-text-secondary">{idea.voteCount}</span>
							</td>
							<td class="py-3 pr-4 text-sm text-text-muted whitespace-nowrap">
								{idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : '—'}
							</td>
							<td class="py-3 text-right">
								<div class="flex items-center justify-end gap-2">
									{#if idea.status !== 'published' && idea.status !== 'archived'}
										<form method="POST" action="?/publish" use:enhance>
											<input type="hidden" name="id" value={idea.id} />
											<Button type="submit" variant="primary" size="sm">Publish</Button>
										</form>
									{/if}
									{#if idea.status !== 'archived'}
										<form method="POST" action="?/archive" use:enhance>
											<input type="hidden" name="id" value={idea.id} />
											<Button type="submit" variant="ghost" size="sm">Archive</Button>
										</form>
									{/if}
									<form method="POST" action="?/delete" use:enhance>
										<input type="hidden" name="id" value={idea.id} />
										<Button
											type="submit"
											variant="danger"
											size="sm"
											onclick={(e: MouseEvent) => {
												if (!confirm('Are you sure you want to delete this idea? This cannot be undone.')) {
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
						{#if expandedId === idea.id}
							<tr class="bg-bg-hover/30">
								<td colspan="10" class="px-4 py-4">
									<div class="text-sm text-text-secondary max-w-3xl">
										<p class="font-medium text-text-primary mb-2">Summary:</p>
										<p>{idea.summary}</p>
										{#if idea.slug}
											<a
												href="/ideas/{idea.slug}"
												class="inline-block mt-3 text-xs text-primary hover:underline"
											>
												View full idea →
											</a>
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
			<p class="text-text-muted mb-2">No ideas found</p>
			<p class="text-sm text-text-secondary">
				Use the <strong>Generate Ideas Now</strong> button to create AI-generated innovation ideas.
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
