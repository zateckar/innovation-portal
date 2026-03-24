<script lang="ts">
	interface Props {
		ideaId: string;
		sectionName: string;
		onUpdated: (newSpec: string) => void;
		onClose: () => void;
	}

	let { ideaId, sectionName, onUpdated, onClose }: Props = $props();

	let instruction = $state('');
	let submitting = $state(false);
	let submitError = $state('');

	async function submit() {
		if (!instruction.trim() || submitting) return;
		submitting = true;
		submitError = '';
		try {
			const res = await fetch(`/api/ideas/${ideaId}/spec-edit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ instruction: instruction.trim(), sectionName })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error((data as { message?: string }).message ?? `Request failed (${res.status})`);
			}
			const { updatedSpec } = await res.json() as { updatedSpec: string };
			onUpdated(updatedSpec);
			onClose();
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			submitting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
		if (e.key === 'Escape') onClose();
	}
</script>

<div class="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
	<div class="flex items-center justify-between">
		<span class="text-sm font-semibold text-violet-300">
			Ask AI to revise: <span class="text-white">{sectionName}</span>
		</span>
		<button onclick={onClose} aria-label="Close" class="text-white/40 hover:text-white/70 transition-colors">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<textarea
		bind:value={instruction}
		onkeydown={handleKeydown}
		rows="3"
		placeholder="Describe what you'd like to change in this section..."
		class="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white
			placeholder:text-white/30 focus:outline-none focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30"
		disabled={submitting}
	></textarea>

	{#if submitError}
		<p class="text-sm text-red-400">{submitError}</p>
	{/if}

	<div class="flex justify-end gap-2">
		<button
			onclick={onClose}
			class="px-3 py-1.5 text-sm text-white/60 hover:text-white/80 transition-colors"
			disabled={submitting}
		>
			Cancel
		</button>
		<button
			onclick={submit}
			disabled={submitting || !instruction.trim()}
			class="px-4 py-1.5 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white
				disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
		>
			{#if submitting}
				<span class="flex items-center gap-1.5">
					<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
					</svg>
					Applying...
				</span>
			{:else}
				Apply Change
			{/if}
		</button>
	</div>
</div>
