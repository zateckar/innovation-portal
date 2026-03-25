<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Card, Button } from '$lib/components/ui';
	import { CATEGORY_LABELS, CATEGORY_COLORS, CATALOG_STATUS_LABELS, CATALOG_STATUS_COLORS, DEPARTMENT_LABELS, DEPARTMENT_COLORS } from '$lib/types';

	let { data, form } = $props();

	// Tab state — driven by URL hash so links stay shareable
	let activeTab = $state<'pending' | 'catalog'>('pending');

	$effect(() => {
		const hash = $page.url.hash;
		if (hash === '#catalog') activeTab = 'catalog';
		else activeTab = 'pending';
	});

	function setTab(tab: 'pending' | 'catalog') {
		activeTab = tab;
		goto(`#${tab}`, { replaceState: true, noScroll: true });
	}

	const pendingCount = $derived(
		data.pendingItems.length + data.acceptedItems.length + data.pendingInnovations.length
	);
</script>

<svelte:head>
	<title>Innovations - Admin - Innovation Radar</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">Innovations</h1>
		<p class="text-text-secondary mt-1">Review incoming items and manage the Incubator Catalog</p>
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

	<!-- Tabs -->
	<div class="border-b border-border">
		<nav class="-mb-px flex gap-0" aria-label="Innovations tabs">
			<button
				onclick={() => setTab('pending')}
				class="px-5 py-3 text-sm font-medium border-b-2 transition-colors
					{activeTab === 'pending'
						? 'border-primary text-primary'
						: 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'}"
			>
				Pending Review
				{#if pendingCount > 0}
					<span class="ml-2 px-2 py-0.5 rounded-full text-xs
						{activeTab === 'pending' ? 'bg-primary/20 text-primary' : 'bg-bg-elevated text-text-muted'}">
						{pendingCount}
					</span>
				{/if}
			</button>
			<button
				onclick={() => setTab('catalog')}
				class="px-5 py-3 text-sm font-medium border-b-2 transition-colors
					{activeTab === 'catalog'
						? 'border-emerald-500 text-emerald-400'
						: 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'}"
			>
				Incubator Catalog
				<span class="ml-2 px-2 py-0.5 rounded-full text-xs
					{activeTab === 'catalog' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-bg-elevated text-text-muted'}">
					{data.catalogItems.length}
				</span>
			</button>
		</nav>
	</div>

	<!-- ── PENDING TAB ────────────────────────────────────────── -->
	{#if activeTab === 'pending'}
		<div class="space-y-10">

			<!-- Pending Items -->
			<section>
				<h2 class="text-lg font-semibold text-text-primary mb-4">
					Pending Items
					<span class="ml-2 text-sm font-normal text-text-muted">({data.pendingItems.length})</span>
				</h2>

				{#if data.pendingItems.length > 0}
					<div class="space-y-3">
						{#each data.pendingItems as item}
							<Card padding="md">
								<div class="flex items-start justify-between gap-4">
									<div class="flex-1 min-w-0">
										<a
											href={item.url}
											target="_blank"
											rel="noopener noreferrer"
											class="text-base font-medium text-text-primary hover:text-primary transition-colors"
										>
											{item.title}
										</a>
										{#if item.sourceName}
											<p class="text-sm text-text-muted mt-1">Source: {item.sourceName}</p>
										{/if}
										{#if item.content}
											<p class="text-sm text-text-secondary mt-2 line-clamp-2">{item.content}</p>
										{/if}
										<p class="text-xs text-text-muted mt-2">
											Discovered: {item.discoveredAt ? new Date(item.discoveredAt).toLocaleString() : 'Unknown'}
										</p>
									</div>
									<div class="flex gap-2 shrink-0">
										<form method="POST" action="?/accept" use:enhance>
											<input type="hidden" name="id" value={item.id} />
											<Button type="submit" variant="primary" size="sm">Accept</Button>
										</form>
										<form method="POST" action="?/reject" use:enhance>
											<input type="hidden" name="id" value={item.id} />
											<Button type="submit" variant="ghost" size="sm">Reject</Button>
										</form>
									</div>
								</div>
							</Card>
						{/each}
					</div>
				{:else}
					<Card padding="lg" class="text-center">
						<p class="text-text-muted">No pending items to review</p>
					</Card>
				{/if}
			</section>

			<!-- Divider -->
			<div class="border-t border-border"></div>

			<!-- Accepted - Awaiting Research -->
			<section>
				<h2 class="text-lg font-semibold text-text-primary mb-4">
					Awaiting AI Research
					<span class="ml-2 text-sm font-normal text-text-muted">({data.acceptedItems.length})</span>
				</h2>

				{#if data.acceptedItems.length > 0}
					<div class="space-y-3">
						{#each data.acceptedItems as item}
							<Card padding="md" class="bg-success/5 border-success/20">
								<div class="flex items-start justify-between gap-4">
									<div class="flex-1 min-w-0">
										<a
											href={item.url}
											target="_blank"
											rel="noopener noreferrer"
											class="text-base font-medium text-text-primary hover:text-primary transition-colors"
										>
											{item.title}
										</a>
										{#if item.sourceName}
											<p class="text-sm text-text-muted mt-1">Source: {item.sourceName}</p>
										{/if}
										<p class="text-xs text-text-muted mt-2">
											Discovered: {item.discoveredAt ? new Date(item.discoveredAt).toLocaleString() : 'Unknown'}
										</p>
									</div>
									<span class="px-2 py-1 text-xs rounded bg-success/20 text-success shrink-0">
										Awaiting AI Research
									</span>
								</div>
							</Card>
						{/each}
					</div>
				{:else}
					<Card padding="lg" class="text-center">
						<p class="text-text-muted">No accepted items awaiting research</p>
					</Card>
				{/if}
			</section>

			<!-- Divider -->
			<div class="border-t border-border"></div>

			<!-- Ready to Publish -->
			<section>
				<h2 class="text-lg font-semibold text-text-primary mb-4">
					Ready to Publish
					<span class="ml-2 text-sm font-normal text-text-muted">({data.pendingInnovations.length})</span>
				</h2>

				{#if data.pendingInnovations.length > 0}
					<div class="space-y-3">
						{#each data.pendingInnovations as innovation}
							<Card padding="md" class="bg-primary/5 border-primary/20">
								<div class="flex items-start justify-between gap-4">
									<div class="flex-1 min-w-0">
										<a
											href="/innovations/{innovation.slug}"
											class="text-base font-medium text-text-primary hover:text-primary transition-colors"
										>
											{innovation.title}
										</a>
										<p class="text-sm text-text-secondary mt-1">{innovation.tagline}</p>
										<div class="flex flex-wrap gap-3 mt-2">
											<span class="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted">
												{innovation.category}
											</span>
											{#if innovation.relevanceScore}
												<span class="text-xs text-text-muted">Relevance: {innovation.relevanceScore.toFixed(1)}</span>
											{/if}
											{#if innovation.innovationScore}
												<span class="text-xs text-text-muted">Innovation: {innovation.innovationScore.toFixed(1)}</span>
											{/if}
											{#if innovation.actionabilityScore}
												<span class="text-xs text-text-muted">Actionability: {innovation.actionabilityScore.toFixed(1)}</span>
											{/if}
										</div>
										<p class="text-xs text-text-muted mt-2">
											Researched: {innovation.researchedAt ? new Date(innovation.researchedAt).toLocaleString() : 'Unknown'}
										</p>
									</div>
									<div class="flex flex-col gap-2 shrink-0 items-end">
										<form method="POST" action="?/publish" use:enhance class="flex items-center gap-2">
											<input type="hidden" name="id" value={innovation.id} />
											<select
												name="department"
												style="font-size:0.75rem; padding:0.25rem 0.5rem; border-radius:0.375rem; background:#1e293b; border:1px solid #334155; color:#cbd5e1; outline:none;"
												title="Set department before publishing"
											>
												{#each Object.entries(DEPARTMENT_LABELS) as [val, label]}
													<option
														value={val}
														selected={val === (innovation.department ?? 'general')}
													>{label}</option>
												{/each}
											</select>
											<Button type="submit" variant="primary" size="sm">Publish</Button>
										</form>
										<form method="POST" action="?/archiveInnovation" use:enhance>
											<input type="hidden" name="id" value={innovation.id} />
											<Button type="submit" variant="ghost" size="sm">Archive</Button>
										</form>
									</div>
								</div>
							</Card>
						{/each}
					</div>
				{:else}
					<Card padding="lg" class="text-center">
						<p class="text-text-muted">No researched innovations awaiting publication</p>
						<p class="text-sm text-text-secondary mt-2">
							Run AI Research on accepted items to generate innovation reports
						</p>
					</Card>
				{/if}
			</section>
		</div>

	<!-- ── CATALOG TAB ────────────────────────────────────────── -->
	{:else}
		<div class="space-y-6">
			<div class="flex justify-end">
				<a
					href="/admin/catalog/new"
					class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors text-sm"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Add New Item
				</a>
			</div>

			<!-- Promotion Suggestions -->
			{#if data.suggestedForPromotion.length > 0}
				<Card>
					<div class="p-4 border-b border-border">
						<h2 class="font-semibold text-text-primary flex items-center gap-2">
							<svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
							</svg>
							Top Voted — Ready for Promotion
						</h2>
						<p class="text-sm text-text-muted mt-1">
							These innovations have received the most votes and could be promoted to the Catalog
						</p>
					</div>
					<div class="divide-y divide-border">
						{#each data.suggestedForPromotion.slice(0, 5) as innovation}
							<div class="p-4 flex items-center justify-between gap-4">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<a href="/innovations/{innovation.slug}" class="font-medium text-text-primary hover:text-violet-400 transition-colors truncate">
											{innovation.title}
										</a>
										<span
											class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs shrink-0"
											style="background-color: {CATEGORY_COLORS[innovation.category]}20; color: {CATEGORY_COLORS[innovation.category]}; border-color: {CATEGORY_COLORS[innovation.category]}40;"
										>
											{CATEGORY_LABELS[innovation.category]}
										</span>
									</div>
									<p class="text-sm text-text-muted truncate">{innovation.tagline}</p>
								</div>
								<div class="flex items-center gap-4 shrink-0">
									<div class="text-center">
										<div class="text-lg font-bold text-violet-400">{innovation.voteCount}</div>
										<div class="text-xs text-text-muted">votes</div>
									</div>
									<form method="POST" action="?/quickPromote" use:enhance>
										<input type="hidden" name="innovationId" value={innovation.id} />
										<Button type="submit" variant="primary" size="sm">Promote</Button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			<!-- Catalog Items List -->
			<Card>
				<div class="p-4 border-b border-border">
					<h2 class="font-semibold text-text-primary">
						Catalog Items
						<span class="ml-2 text-sm font-normal text-text-muted">({data.catalogItems.length})</span>
					</h2>
				</div>

				{#if data.catalogItems.length > 0}
					<div class="divide-y divide-border">
						{#each data.catalogItems as item}
							<div class="p-4 flex items-center justify-between gap-4">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<a href="/catalog/{item.slug}" class="font-medium text-text-primary hover:text-emerald-400 transition-colors">
											{item.name}
										</a>
										<span
											class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs"
											style="background-color: {CATEGORY_COLORS[item.category]}20; color: {CATEGORY_COLORS[item.category]}; border-color: {CATEGORY_COLORS[item.category]}40;"
										>
											{CATEGORY_LABELS[item.category]}
										</span>
										<span
											class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs"
											style="background-color: {CATALOG_STATUS_COLORS[item.status]}20; color: {CATALOG_STATUS_COLORS[item.status]}; border-color: {CATALOG_STATUS_COLORS[item.status]}40;"
										>
											{CATALOG_STATUS_LABELS[item.status]}
										</span>
										{#if item.innovationId}
											<span class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs bg-violet-500/20 text-violet-400 border-violet-500/30">
												From Radar
											</span>
										{/if}
									</div>
									<p class="text-sm text-text-muted truncate mt-1">{item.description}</p>
									<p class="text-xs text-text-muted mt-1">
										Added: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
										{#if item.updatedAt}
											· Updated: {new Date(item.updatedAt).toLocaleDateString()}
										{/if}
									</p>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<a
										href="/admin/catalog/{item.id}/edit"
										class="p-2 rounded-lg bg-bg-elevated hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
										title="Edit"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
									</a>

									{#if item.status === 'active'}
										<form method="POST" action="?/setMaintenance" use:enhance>
											<input type="hidden" name="id" value={item.id} />
											<button
												type="submit"
												class="p-2 rounded-lg bg-bg-elevated hover:bg-warning/20 text-text-muted hover:text-warning transition-colors"
												title="Set Maintenance"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
												</svg>
											</button>
										</form>
									{/if}

									{#if item.status !== 'archived'}
										<form method="POST" action="?/archiveCatalog" use:enhance>
											<input type="hidden" name="id" value={item.id} />
											<button
												type="submit"
												class="p-2 rounded-lg bg-bg-elevated hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
												title="Archive"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
												</svg>
											</button>
										</form>
									{:else}
										<form method="POST" action="?/restore" use:enhance>
											<input type="hidden" name="id" value={item.id} />
											<button
												type="submit"
												class="p-2 rounded-lg bg-bg-elevated hover:bg-emerald-500/20 text-text-muted hover:text-emerald-400 transition-colors"
												title="Restore"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
												</svg>
											</button>
										</form>
										<form method="POST" action="?/deleteCatalog" use:enhance>
											<input type="hidden" name="id" value={item.id} />
											<button
												type="submit"
												class="p-2 rounded-lg bg-bg-elevated hover:bg-error/20 text-text-muted hover:text-error transition-colors"
												title="Delete Permanently"
												onclick={(e) => {
													if (!confirm('Permanently delete this item?')) e.preventDefault();
												}}
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										</form>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="p-8 text-center text-text-muted">
						<p>No catalog items yet. Add your first implementation or promote a top-voted innovation.</p>
					</div>
				{/if}
			</Card>
		</div>
	{/if}
</div>
