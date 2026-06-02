<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';

	interface Entry {
		id: string;
		actorEmail: string | null;
		userId: string | null;
		action: string;
		targetType: string | null;
		targetId: string | null;
		metadata: Record<string, unknown> | null;
		ip: string | null;
		userAgent: string | null;
		reqId: string | null;
		createdAt: string | null;
	}

	let { data }: { data: { filters: { actor: string; action: string; targetType: string }; entries: Entry[] } } = $props();

	// Inputs are local form state, not derived — capture initial URL filters once.
	let actor = $state(untrack(() => data.filters.actor));
	let action = $state(untrack(() => data.filters.action));
	let targetType = $state(untrack(() => data.filters.targetType));

	function applyFilters(e: SubmitEvent) {
		e.preventDefault();
		const params = new URLSearchParams();
		if (actor) params.set('actor', actor);
		if (action) params.set('action', action);
		if (targetType) params.set('targetType', targetType);
		goto(`/admin/audit${params.toString() ? '?' + params.toString() : ''}`);
	}

	function clearFilters() {
		actor = '';
		action = '';
		targetType = '';
		goto('/admin/audit');
	}

	function fmtDate(s: string | null): string {
		if (!s) return '—';
		return new Date(s).toLocaleString();
	}

	function actionTone(action: string): string {
		if (action.includes('delete') || action.includes('revoke') || action.includes('force')) return 'rose';
		if (action.includes('create') || action.includes('change') || action.includes('update')) return 'amber';
		return 'slate';
	}
</script>

<div class="mx-auto max-w-6xl space-y-6 p-6">
	<header>
		<h1 class="font-display text-2xl font-semibold text-white">Audit log</h1>
		<p class="mt-1 text-sm text-slate-400">
			Most recent {data.entries.length} privileged writes. Use the filters to narrow by actor,
			action, or target type.
		</p>
	</header>

	<form
		class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
		onsubmit={applyFilters}
	>
		<label class="flex flex-col text-sm">
			<span class="mb-1 text-slate-300">Actor (email or user id)</span>
			<input
				type="text"
				bind:value={actor}
				placeholder="alice@…"
				class="w-56 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
			/>
		</label>
		<label class="flex flex-col text-sm">
			<span class="mb-1 text-slate-300">Action (substring)</span>
			<input
				type="text"
				bind:value={action}
				placeholder="settings.update"
				class="w-56 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
			/>
		</label>
		<label class="flex flex-col text-sm">
			<span class="mb-1 text-slate-300">Target type</span>
			<input
				type="text"
				bind:value={targetType}
				placeholder="user, idea, settings…"
				class="w-56 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
			/>
		</label>
		<button
			type="submit"
			class="rounded bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
		>Apply</button>
		<button
			type="button"
			onclick={clearFilters}
			class="rounded border border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
		>Clear</button>
	</form>

	<div class="overflow-hidden rounded-lg border border-slate-800">
		<table class="w-full text-sm">
			<thead class="bg-slate-900/80 text-left text-xs uppercase text-slate-500">
				<tr>
					<th class="px-3 py-2.5">When</th>
					<th class="px-3 py-2.5">Actor</th>
					<th class="px-3 py-2.5">Action</th>
					<th class="px-3 py-2.5">Target</th>
					<th class="px-3 py-2.5">Metadata</th>
					<th class="px-3 py-2.5">IP / reqId</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-800">
				{#if data.entries.length === 0}
					<tr>
						<td colspan="6" class="px-3 py-6 text-center text-slate-500">
							No audit entries match the current filters.
						</td>
					</tr>
				{:else}
					{#each data.entries as e (e.id)}
						<tr class="bg-slate-950/40 align-top">
							<td class="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-300">{fmtDate(e.createdAt)}</td>
							<td class="px-3 py-2 text-slate-200">
								<div class="text-white">{e.actorEmail ?? '—'}</div>
								<div class="font-mono text-[10px] text-slate-500">{e.userId ?? ''}</div>
							</td>
							<td class="px-3 py-2">
								<span
									class="rounded px-1.5 py-0.5 font-mono text-xs"
									class:bg-rose-500={actionTone(e.action) === 'rose'}
									class:text-white={actionTone(e.action) === 'rose'}
									class:bg-amber-500={actionTone(e.action) === 'amber'}
									class:text-slate-950={actionTone(e.action) === 'amber'}
									class:bg-slate-700={actionTone(e.action) === 'slate'}
									class:text-slate-200={actionTone(e.action) === 'slate'}
								>{e.action}</span>
							</td>
							<td class="px-3 py-2 font-mono text-xs text-slate-300">
								<div>{e.targetType ?? '—'}</div>
								<div class="text-slate-500">{e.targetId ?? ''}</div>
							</td>
							<td class="max-w-xs truncate px-3 py-2 font-mono text-xs text-slate-400" title={JSON.stringify(e.metadata)}>
								{e.metadata ? JSON.stringify(e.metadata) : '—'}
							</td>
							<td class="px-3 py-2 font-mono text-xs text-slate-400">
								<div>{e.ip ?? '—'}</div>
								<div class="text-slate-500">{e.reqId ?? ''}</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
