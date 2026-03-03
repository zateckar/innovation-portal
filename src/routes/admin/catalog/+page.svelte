<script lang="ts">
	import { Card, Button } from '$lib/components/ui';
	import { CATEGORY_LABELS, CATEGORY_COLORS, CATALOG_STATUS_LABELS, CATALOG_STATUS_COLORS } from '$lib/types';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Incubator Catalog Management | Admin</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-white">Incubator Catalog</h1>
			<p class="text-zinc-400 mt-1">Manage implemented innovations ready for users to try</p>
		</div>
		<a
			href="/admin/catalog/new"
			class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			Add New Item
		</a>
	</div>

	<!-- Status message -->
	{#if form?.success}
		<div class="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
			{form.message}
		</div>
	{/if}
	{#if form?.error}
		<div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
			{form.error}
		</div>
	{/if}

	<!-- Promotion Suggestions -->
	{#if data.suggestedForPromotion.length > 0}
		<Card>
			<div class="p-4 border-b border-zinc-800">
				<h2 class="font-semibold text-white flex items-center gap-2">
					<svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
					</svg>
					Top Voted - Ready for Promotion
				</h2>
				<p class="text-sm text-zinc-500 mt-1">
					These innovations have received votes and could be promoted to the Incubator Catalog
				</p>
			</div>
			<div class="divide-y divide-zinc-800">
				{#each data.suggestedForPromotion.slice(0, 5) as innovation}
					<div class="p-4 flex items-center justify-between gap-4">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<a href="/innovations/{innovation.slug}" class="font-medium text-white hover:text-violet-400 transition-colors truncate">
									{innovation.title}
								</a>
								<span 
									class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs"
									style="background-color: {CATEGORY_COLORS[innovation.category]}20; color: {CATEGORY_COLORS[innovation.category]}; border-color: {CATEGORY_COLORS[innovation.category]}40;"
								>
									{CATEGORY_LABELS[innovation.category]}
								</span>
							</div>
							<p class="text-sm text-zinc-500 truncate">{innovation.tagline}</p>
						</div>
						<div class="flex items-center gap-4 shrink-0">
							<div class="text-center">
								<div class="text-lg font-bold text-violet-400">{innovation.voteCount}</div>
								<div class="text-xs text-zinc-500">votes</div>
							</div>
							<form method="POST" action="?/quickPromote" use:enhance>
								<input type="hidden" name="innovationId" value={innovation.id} />
								<Button type="submit" variant="primary" size="sm">
									Promote
								</Button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</Card>
	{/if}

	<!-- Catalog Items List -->
	<Card>
		<div class="p-4 border-b border-zinc-800">
			<h2 class="font-semibold text-white">Catalog Items ({data.catalogItems.length})</h2>
		</div>

		{#if data.catalogItems.length > 0}
			<div class="divide-y divide-zinc-800">
				{#each data.catalogItems as item}
					<div class="p-4 flex items-center justify-between gap-4">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<a href="/catalog/{item.slug}" class="font-medium text-white hover:text-emerald-400 transition-colors">
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
							<p class="text-sm text-zinc-500 truncate mt-1">{item.description}</p>
							<p class="text-xs text-zinc-600 mt-1">
								Added: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
								{#if item.updatedAt}
									• Updated: {new Date(item.updatedAt).toLocaleDateString()}
								{/if}
							</p>
						</div>
						<div class="flex items-center gap-2 shrink-0">
							<a
								href="/admin/catalog/{item.id}/edit"
								class="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
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
										class="p-2 rounded-lg bg-zinc-800 hover:bg-amber-500/20 text-zinc-400 hover:text-amber-400 transition-colors"
										title="Set Maintenance"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
										</svg>
									</button>
								</form>
							{/if}

							{#if item.status !== 'archived'}
								<form method="POST" action="?/archive" use:enhance>
									<input type="hidden" name="id" value={item.id} />
									<button
										type="submit"
										class="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
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
										class="p-2 rounded-lg bg-zinc-800 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 transition-colors"
										title="Restore"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
										</svg>
									</button>
								</form>
								<form method="POST" action="?/delete" use:enhance={() => {
									return async ({ result, update }) => {
										if (confirm('Are you sure you want to permanently delete this item?')) {
											await update();
										}
									};
								}}>
									<input type="hidden" name="id" value={item.id} />
									<button
										type="submit"
										class="p-2 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
										title="Delete Permanently"
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
			<div class="p-8 text-center text-zinc-500">
				<p>No catalog items yet. Add your first implementation or promote from Innovation Radar.</p>
			</div>
		{/if}
	</Card>
</div>
