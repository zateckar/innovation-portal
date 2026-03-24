<script lang="ts">
	import { diffLines } from 'diff';
	import type { SpecVersion } from '$lib/types';

	interface Props {
		ideaId: string;
		currentSpec: string;
		hasParticipated: boolean;
		onRolledBack: (restoredSpec: string) => void;
	}

	let { ideaId, currentSpec, hasParticipated, onRolledBack }: Props = $props();

	let versions = $state<SpecVersion[]>([]);
	let loading = $state(false);
	let expanded = $state(false);
	let selectedVersionId = $state<string | null>(null);
	let showingDiff = $state(false);
	let rollingBack = $state<string | null>(null);
	let rollbackError = $state('');

	async function loadVersions() {
		if (versions.length > 0) return;
		loading = true;
		try {
			const res = await fetch(`/api/ideas/${ideaId}/spec-versions`);
			if (res.ok) versions = await res.json() as SpecVersion[];
		} finally {
			loading = false;
		}
	}

	function togglePanel() {
		expanded = !expanded;
		if (expanded) loadVersions();
	}

	async function rollback(version: SpecVersion) {
		if (!confirm(`Roll back to version ${version.versionNumber}? The current spec will be saved to history first.`)) return;
		rollingBack = version.id;
		rollbackError = '';
		try {
			const res = await fetch(`/api/ideas/${ideaId}/spec-versions/${version.id}/rollback`, { method: 'POST' });
			if (!res.ok) throw new Error(`Failed (${res.status})`);
			const { restoredSpec } = await res.json() as { restoredSpec: string };
			versions = [];
			await loadVersions();
			selectedVersionId = null;
			onRolledBack(restoredSpec);
		} catch (err) {
			rollbackError = err instanceof Error ? err.message : 'Rollback failed';
		} finally {
			rollingBack = null;
		}
	}

	function formatDate(d: Date | string | null) {
		if (!d) return '—';
		return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	}

	function getDiff(versionContent: string) {
		return diffLines(versionContent, currentSpec);
	}
</script>

<!-- Toggle button -->
<button
	onclick={togglePanel}
	class="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10
		bg-white/[0.03] hover:bg-white/5 transition-colors text-sm text-white/60 hover:text-white/80"
>
	<span class="flex items-center gap-2">
		<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
				d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
		Version History
		{#if versions.length > 0}
			<span class="text-xs text-white/40">({versions.length} saved)</span>
		{/if}
	</span>
	<svg class="w-4 h-4 transition-transform {expanded ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
	</svg>
</button>

{#if expanded}
	<div class="rounded-xl border border-white/10 overflow-hidden mt-1">
		{#if loading}
			<div class="p-6 text-center text-sm text-white/40">Loading versions...</div>
		{:else if versions.length === 0}
			<div class="p-6 text-center text-sm text-white/40">
				No prior versions yet. Each AI edit saves a version here automatically.
			</div>
		{:else}
			<div class="divide-y divide-white/5">
				{#each versions as version (version.id)}
					{@const isSelected = selectedVersionId === version.id}
					<div class="p-4 space-y-3">
						<div class="flex items-start justify-between gap-4">
							<div class="space-y-0.5 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="text-sm font-semibold text-white">v{version.versionNumber}</span>
									<span class="text-xs text-white/40">{formatDate(version.createdAt)}</span>
									<span class="text-xs text-white/50">by {version.authorName}</span>
								</div>
								{#if version.changeDescription}
									<p class="text-xs text-white/50 italic truncate">{version.changeDescription}</p>
								{/if}
							</div>
							<div class="flex items-center gap-2 shrink-0">
								<button
									onclick={() => {
										if (isSelected && !showingDiff) { selectedVersionId = null; }
										else { selectedVersionId = version.id; showingDiff = false; }
									}}
									class="px-2.5 py-1 text-xs rounded-lg border border-white/10 text-white/60
										hover:text-white/80 hover:border-white/20 transition-colors"
								>
									{isSelected && !showingDiff ? 'Hide' : 'View'}
								</button>
								<button
									onclick={() => { selectedVersionId = version.id; showingDiff = true; }}
									class="px-2.5 py-1 text-xs rounded-lg border border-sky-500/30 text-sky-400
										hover:bg-sky-500/10 transition-colors"
								>
									Diff vs current
								</button>
								{#if hasParticipated}
									<button
										onclick={() => rollback(version)}
										disabled={rollingBack === version.id}
										class="px-2.5 py-1 text-xs rounded-lg border border-amber-500/30 text-amber-400
											hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
									>
										{rollingBack === version.id ? '...' : 'Rollback'}
									</button>
								{/if}
							</div>
						</div>

						{#if isSelected && !showingDiff}
							<div class="rounded-lg border border-white/10 bg-black/20 max-h-64 overflow-y-auto p-3">
								<pre class="text-xs text-white/70 whitespace-pre-wrap font-mono leading-relaxed">{version.content}</pre>
							</div>
						{/if}

						{#if isSelected && showingDiff}
							{@const changes = getDiff(version.content)}
							<div class="rounded-lg border border-white/10 bg-black/20 max-h-64 overflow-y-auto p-3 space-y-0.5">
								<p class="text-xs text-white/40 mb-2 font-medium">&#8592; v{version.versionNumber} &#8594; current</p>
								{#each changes as change}
									{#if change.added}
										<div class="font-mono text-xs leading-relaxed px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 whitespace-pre-wrap">
											{#each change.value.split('\n').filter((l, i, a) => i < a.length - 1 || l) as line}
												<div>+ {line}</div>
											{/each}
										</div>
									{:else if change.removed}
										<div class="font-mono text-xs leading-relaxed px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 whitespace-pre-wrap">
											{#each change.value.split('\n').filter((l, i, a) => i < a.length - 1 || l) as line}
												<div>- {line}</div>
											{/each}
										</div>
									{/if}
								{/each}
								{#if changes.every(c => !c.added && !c.removed)}
									<p class="text-xs text-white/40 text-center py-2">No differences.</p>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if rollbackError}
			<div class="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-sm text-red-400">{rollbackError}</div>
		{/if}
	</div>
{/if}
