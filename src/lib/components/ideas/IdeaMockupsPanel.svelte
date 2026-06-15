<script lang="ts">
	import { untrack, onMount } from 'svelte';
	import SpecSectionEditPanel from './SpecSectionEditPanel.svelte';
	import type { SpecMockup, SpecMockupSet } from '$lib/types';

	interface Props {
		ideaId: string;
		initialMockups: SpecMockupSet | null;
		hasParticipated: boolean;
		/** Called whenever a mockup comment is applied to the spec. */
		onSpecUpdated?: (newSpec: string) => void;
	}

	let { ideaId, initialMockups, hasParticipated, onSpecUpdated }: Props = $props();

	let mockups = $state<SpecMockupSet | null>(untrack(() => initialMockups));
	let generating = $state(false);
	let genError = $state('');
	let activeComment = $state<string | null>(null); // mockup id with open comment panel
	let regeneratingId = $state<string | null>(null);
	// Per-iframe measured heights, keyed by mockup id
	let heights = $state<Record<string, number>>({});

	// Injected into every mockup iframe. Two jobs:
	//  1. Report the rendered height back to the parent so the iframe can size itself.
	//  2. Keep all navigation INSIDE the mockup. Generated mockups sometimes contain
	//     links/forms that point "outside" the page (href="/dashboard", external URLs,
	//     form submits). In a sandboxed iframe those navigations fail and break the
	//     preview, so we neutralise them: in-page #fragments scroll, everything else
	//     is inert.
	const INJECTED_SCRIPT = `<script>
(function () {
  function reportHeight() {
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    parent.postMessage({ type: 'mockup-height', id: window.name, height: h }, '*');
  }
  window.addEventListener('load', reportHeight);

  // Contain all link navigation.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (href && href.charAt(0) === '#' && href.length > 1) {
      // Allow in-page anchor scrolling within the mockup.
      var target = document.getElementById(href.slice(1));
      e.preventDefault();
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    // Any other href (or target=_blank) would leave the mockup — block it.
    e.preventDefault();
  }, true);

  // Forms must never submit/navigate.
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
})();
<\/script>`;

	function srcdocFor(m: SpecMockup): string {
		const html = m.html ?? '';
		return html.includes('</body>')
			? html.replace('</body>', INJECTED_SCRIPT + '</body>')
			: html + INJECTED_SCRIPT;
	}

	function heightFor(id: string): number {
		return heights[id] ?? 600;
	}

	onMount(() => {
		function onMessage(event: MessageEvent) {
			if (event.origin !== 'null' && event.origin !== window.location.origin) return;
			const d = event.data;
			if (d?.type === 'mockup-height' && typeof d.height === 'number' && typeof d.id === 'string') {
				if (d.height > 0) heights = { ...heights, [d.id]: Math.max(d.height, 300) };
			}
		}
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	});

	async function generate() {
		if (generating) return;
		generating = true;
		genError = '';
		const startedAt = mockups?.generatedAt ?? null;
		try {
			const res = await fetch(`/api/ideas/${ideaId}/mockups`, { method: 'POST' });
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error((data as { message?: string }).message ?? `Failed (${res.status})`);
			}
			mockups = (await res.json()) as SpecMockupSet;
		} catch (err) {
			// Generation is slow; a proxy/browser timeout can drop the connection
			// ("Failed to fetch") even though the server finished and persisted the
			// result. Try to recover the saved set before surfacing an error.
			const recovered = await recoverMockups(startedAt);
			if (recovered) {
				mockups = recovered;
			} else {
				genError =
					err instanceof TypeError
						? 'The connection dropped while generating (this can take a while). It may have finished — refresh to check, or try again.'
						: err instanceof Error
							? err.message
							: 'Failed to generate mockups';
			}
		} finally {
			generating = false;
		}
	}

	/**
	 * Poll the GET endpoint to recover a set the server may have finished saving
	 * after the POST connection dropped. Returns the set only if it's newer than
	 * what we started with (so a stale prior set isn't mistaken for success).
	 */
	async function recoverMockups(startedAt: string | null): Promise<SpecMockupSet | null> {
		for (let attempt = 0; attempt < 3; attempt++) {
			await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
			try {
				const res = await fetch(`/api/ideas/${ideaId}/mockups`);
				if (!res.ok) continue;
				const set = (await res.json()) as SpecMockupSet | null;
				if (set?.screens?.length && set.generatedAt !== startedAt) return set;
			} catch {
				// keep polling
			}
		}
		return null;
	}

	async function regenerate(mockupId: string) {
		if (regeneratingId) return;
		regeneratingId = mockupId;
		try {
			const res = await fetch(`/api/ideas/${ideaId}/mockups/${mockupId}/regenerate`, { method: 'POST' });
			if (!res.ok) throw new Error(`Failed (${res.status})`);
			const updated = (await res.json()) as SpecMockup;
			if (mockups) {
				mockups = {
					...mockups,
					screens: mockups.screens.map((s) => (s.id === mockupId ? updated : s))
				};
			}
		} catch (err) {
			genError = err instanceof Error ? err.message : 'Failed to regenerate mockup';
		} finally {
			regeneratingId = null;
		}
	}

	function openInNewTab(m: SpecMockup) {
		const blob = new Blob([srcdocFor(m)], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const win = window.open(url, '_blank');
		if (win) win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
	}

	const screenCount = $derived(mockups?.screens.length ?? 0);
</script>

<div class="rounded-2xl border border-white/10 bg-bg-elevated overflow-hidden">
	<!-- Header -->
	<div class="flex items-center justify-between px-5 py-4 border-b border-white/10 gap-3 flex-wrap">
		<div class="flex items-center gap-2">
			<svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M4 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2h-4l-2 3-2-3H6a2 2 0 01-2-2V5z" />
			</svg>
			<h2 class="font-semibold text-white">Application Mockups</h2>
			{#if screenCount > 0}
				<span class="text-xs text-white/40">({screenCount} screen{screenCount === 1 ? '' : 's'})</span>
			{/if}
		</div>
		{#if mockups && hasParticipated}
			<button
				onclick={generate}
				disabled={generating}
				class="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 text-white/70
					hover:bg-white/10 hover:border-white/20 disabled:opacity-50 transition-colors"
			>
				{generating ? 'Regenerating…' : 'Regenerate all'}
			</button>
		{/if}
	</div>

	<div class="px-5 py-4 space-y-4">
		{#if !mockups}
			<!-- Empty state: generate -->
			<div class="flex flex-col items-center text-center gap-3 py-8">
				<div class="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center">
					<svg class="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M4 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2h-4l-2 3-2-3H6a2 2 0 01-2-2V5z" />
					</svg>
				</div>
				<div>
					<p class="text-sm font-medium text-white">Visualise the specification</p>
					<p class="text-xs text-white/50 max-w-md mt-1">
						Generate clickable HTML mockups of each screen so you can see — and comment on — how the
						application will look before it's built. Your comments feed straight back into the specification.
					</p>
				</div>
				{#if hasParticipated}
					<button
						onclick={generate}
						disabled={generating}
						class="px-5 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600
							hover:from-sky-500 hover:to-indigo-500 text-white disabled:opacity-50 transition-all flex items-center gap-2"
					>
						{#if generating}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
							</svg>
							Generating mockups…
						{:else}
							Generate mockups
						{/if}
					</button>
					{#if generating}
						<p class="text-xs text-white/40">This takes a minute — the AI designs each screen individually.</p>
					{/if}
				{:else}
					<p class="text-xs text-white/40">Only contributors to this idea can generate mockups.</p>
				{/if}
				{#if genError}<p class="text-sm text-red-400">{genError}</p>{/if}
			</div>
		{:else}
			{#if genError}<p class="text-sm text-red-400">{genError}</p>{/if}
			{#each mockups.screens as m (m.id)}
				<div class="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
					<div class="flex items-center justify-between px-4 py-2.5 border-b border-white/10 gap-3 flex-wrap">
						<div class="min-w-0">
							<h3 class="text-sm font-semibold text-white truncate">{m.screenName}</h3>
							{#if m.purpose}<p class="text-xs text-white/45 truncate">{m.purpose}</p>{/if}
						</div>
						<div class="flex items-center gap-2 shrink-0">
							<button
								onclick={() => openInNewTab(m)}
								class="px-2.5 py-1 text-xs font-medium rounded-md border border-white/10 text-white/60 hover:bg-white/10 transition-colors"
							>
								Open &#8599;
							</button>
							{#if hasParticipated}
								<button
									onclick={() => regenerate(m.id)}
									disabled={regeneratingId === m.id}
									class="px-2.5 py-1 text-xs font-medium rounded-md border border-white/10 text-white/60 hover:bg-white/10 disabled:opacity-50 transition-colors"
								>
									{regeneratingId === m.id ? 'Regenerating…' : 'Regenerate'}
								</button>
								<button
									onclick={() => (activeComment = activeComment === m.id ? null : m.id)}
									class="px-2.5 py-1 text-xs font-medium rounded-md border transition-colors
										{activeComment === m.id
											? 'border-violet-500/40 text-violet-300 bg-violet-500/10'
											: 'border-violet-500/30 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20'}"
								>
									{activeComment === m.id ? 'Cancel' : 'Comment'}
								</button>
							{/if}
						</div>
					</div>

					{#if activeComment === m.id}
						<div class="p-3 border-b border-white/10">
							<SpecSectionEditPanel
								{ideaId}
								sectionName="5. What screens does the application need?"
								sourceContext={`Visual feedback on the "${m.screenName}" screen mockup (purpose: ${m.purpose}). Treat this as a request to change the specification so the screen looks/behaves as described.`}
								title={`Comment on: ${m.screenName}`}
								placeholder={`e.g. "Move the filters to the top", "Add a status column", "Use a card layout instead of a table"…`}
								onUpdated={(newSpec) => {
									activeComment = null;
									onSpecUpdated?.(newSpec);
									// Reflect the change visually
									regenerate(m.id);
								}}
								onClose={() => (activeComment = null)}
							/>
						</div>
					{/if}

					<div class="bg-white">
						{#if regeneratingId === m.id}
							<div class="flex items-center justify-center gap-2 py-16 bg-[#0f172a] text-white/60 text-sm">
								<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
								</svg>
								Redrawing this screen from the updated spec…
							</div>
						{:else}
							<iframe
								name={m.id}
								title={m.screenName}
								srcdoc={srcdocFor(m)}
								sandbox="allow-scripts"
								class="w-full block border-0"
								style="height: {heightFor(m.id)}px;"
							></iframe>
						{/if}
					</div>
				</div>
			{/each}

			<p class="text-[11px] text-white/30">
				Mockups are AI-generated visual previews. Comments you apply update the specification and history,
				exactly like editing a section directly.
			</p>
		{/if}
	</div>
</div>
