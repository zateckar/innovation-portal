<script lang="ts">
	import { renderMarkdown } from '$lib/utils/markdown';
	import { MicButton } from '$lib/components/ui';
	import type { SpecEditProposal, SpecEditTurn } from '$lib/types';

	interface Props {
		ideaId: string;
		/** Section the user is focused on (passed to the AI as focus context). */
		sectionName?: string;
		/** Extra context for the AI, e.g. "Visual feedback on the 'Dashboard' screen mockup". */
		sourceContext?: string;
		/** Heading shown at the top of the panel. */
		title?: string;
		/** Placeholder for the first instruction. */
		placeholder?: string;
		onUpdated: (newSpec: string) => void;
		onClose: () => void;
	}

	let {
		ideaId,
		sectionName,
		sourceContext,
		title,
		placeholder = "Describe what you'd like to change…",
		onUpdated,
		onClose
	}: Props = $props();

	type Phase = 'input' | 'reviewing';

	let phase = $state<Phase>('input');
	let instruction = $state('');
	let followup = $state('');
	let busy = $state(false);
	let applying = $state(false);
	let errorMsg = $state('');
	let showPreview = $state(false);

	// Running discussion + the latest proposal under review
	let turns = $state<SpecEditTurn[]>([]);
	let proposal = $state<SpecEditProposal | null>(null);
	let firstInstruction = $state('');

	const headerTitle = $derived(title ?? (sectionName ? `Revise: ${sectionName}` : 'Revise specification'));

	async function callPropose(newInstruction: string) {
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch(`/api/ideas/${ideaId}/spec-edit/propose`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					instruction: newInstruction,
					sectionName,
					sourceContext,
					messages: turns
				})
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error((data as { message?: string }).message ?? `Request failed (${res.status})`);
			}
			const result = (await res.json()) as SpecEditProposal;
			// Record the exchange so refinements build on each other
			turns = [
				...turns,
				{ role: 'user', content: newInstruction },
				{ role: 'ai', content: result.analysis }
			];
			proposal = result;
			phase = 'reviewing';
			showPreview = false;
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			busy = false;
		}
	}

	function startDiscussion() {
		if (!instruction.trim() || busy) return;
		firstInstruction = instruction.trim();
		callPropose(instruction.trim());
	}

	function refine() {
		if (!followup.trim() || busy) return;
		const f = followup.trim();
		followup = '';
		callPropose(f);
	}

	async function apply() {
		if (!proposal || applying) return;
		applying = true;
		errorMsg = '';
		try {
			const summary = turns
				.filter((t) => t.role === 'user')
				.map((t) => t.content)
				.join(' → ') || firstInstruction;
			const res = await fetch(`/api/ideas/${ideaId}/spec-edit/apply`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ proposedSpec: proposal.proposedSpec, summary, sectionName })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error((data as { message?: string }).message ?? `Request failed (${res.status})`);
			}
			const { updatedSpec } = (await res.json()) as { updatedSpec: string };
			onUpdated(updatedSpec);
			onClose();
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			applying = false;
		}
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startDiscussion(); }
		if (e.key === 'Escape') onClose();
	}
	function handleFollowupKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); refine(); }
		if (e.key === 'Escape') onClose();
	}
</script>

<div class="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
	<div class="flex items-center justify-between">
		<span class="text-sm font-semibold text-violet-300">{headerTitle}</span>
		<button onclick={onClose} aria-label="Close" class="text-white/40 hover:text-white/70 transition-colors">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	{#if phase === 'input'}
		<p class="text-xs text-white/50">
			The AI will think through your request first — what it will change and what else in the spec
			it affects — and show you a proposal to review before anything is saved.
		</p>
		<div class="relative">
			<textarea
				bind:value={instruction}
				onkeydown={handleInputKeydown}
				rows="3"
				{placeholder}
				class="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-20 text-sm text-white
					placeholder:text-white/30 focus:outline-none focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30"
				disabled={busy}
			></textarea>
			<MicButton bind:value={instruction} disabled={busy} class="absolute bottom-2 right-2" size="w-8 h-8" />
		</div>

		{#if errorMsg}<p class="text-sm text-red-400">{errorMsg}</p>{/if}

		<div class="flex justify-end gap-2">
			<button onclick={onClose} class="px-3 py-1.5 text-sm text-white/60 hover:text-white/80 transition-colors" disabled={busy}>
				Cancel
			</button>
			<button
				onclick={startDiscussion}
				disabled={busy || !instruction.trim()}
				class="px-4 py-1.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white
					disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
			>
				{#if busy}
					<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
					</svg>
					Thinking…
				{:else}
					Discuss change
				{/if}
			</button>
		</div>
	{:else if proposal}
		<!-- Proposal under review -->
		<div class="space-y-3">
			<div>
				<div class="text-[11px] font-semibold uppercase tracking-wider text-violet-300/70 mb-1.5">
					Proposed change & implications
				</div>
				<div class="rounded-lg border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white/80
					prose prose-sm prose-invert max-w-none
					[&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:text-white">
					{@html renderMarkdown(proposal.analysis)}
				</div>
			</div>

			{#if proposal.affectedSections.length > 0}
				<div class="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5">
					<div class="flex items-center gap-1.5 text-xs font-medium text-amber-300 mb-1.5">
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						Also affects these sections
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each proposal.affectedSections as s}
							<span class="px-2 py-0.5 rounded-md text-[11px] bg-amber-500/10 text-amber-200/90 border border-amber-500/20">{s}</span>
						{/each}
					</div>
				</div>
			{/if}

			<button
				onclick={() => (showPreview = !showPreview)}
				class="text-xs text-violet-300/80 hover:text-violet-200 transition-colors flex items-center gap-1"
			>
				<svg class="w-3 h-3 transition-transform {showPreview ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				{showPreview ? 'Hide' : 'Preview'} full proposed specification
			</button>
			{#if showPreview}
				<div class="max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-black/20 px-3.5 py-3 text-sm
					prose prose-sm prose-invert max-w-none
					[&_h1]:text-base [&_h2]:text-sm [&_h2]:mt-3 [&_p]:my-1.5 [&_li]:my-0.5">
					{@html renderMarkdown(proposal.proposedSpec)}
				</div>
			{/if}

			<!-- Continue the discussion -->
			<div>
				<div class="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
					Not quite right? Keep discussing
				</div>
				<div class="relative">
					<textarea
						bind:value={followup}
						onkeydown={handleFollowupKeydown}
						rows="2"
						placeholder="Refine the request or ask the AI to reconsider something…"
						class="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-20 text-sm text-white
							placeholder:text-white/30 focus:outline-none focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30"
						disabled={busy || applying}
					></textarea>
					<MicButton bind:value={followup} disabled={busy || applying} class="absolute bottom-2 right-2" size="w-8 h-8" />
				</div>
			</div>

			{#if errorMsg}<p class="text-sm text-red-400">{errorMsg}</p>{/if}

			<div class="flex items-center justify-between gap-2">
				<button onclick={onClose} class="px-3 py-1.5 text-sm text-white/60 hover:text-white/80 transition-colors" disabled={busy || applying}>
					Cancel
				</button>
				<div class="flex gap-2">
					<button
						onclick={refine}
						disabled={busy || applying || !followup.trim()}
						class="px-3 py-1.5 text-sm font-medium rounded-lg border border-violet-500/40 text-violet-200
							hover:bg-violet-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
					>
						{#if busy}
							<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
							</svg>
							Rethinking…
						{:else}
							Discuss again
						{/if}
					</button>
					<button
						onclick={apply}
						disabled={busy || applying}
						class="px-4 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white
							disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
					>
						{#if applying}
							<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
							</svg>
							Applying…
						{:else}
							Apply changes
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
