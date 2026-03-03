<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	
	interface Props extends HTMLInputAttributes {
		label?: string;
		error?: string;
		hint?: string;
	}
	
	let { 
		label,
		error,
		hint,
		id,
		class: className = '',
		...rest
	}: Props = $props();
	
	const fallbackId = `input-${Math.random().toString(36).slice(2, 9)}`;
	const inputId = $derived(id || fallbackId);
</script>

<div class="space-y-2">
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-text-secondary">
			{label}
		</label>
	{/if}
	
	<input
		id={inputId}
		class="w-full px-4 py-3 rounded-lg bg-bg-surface border text-text-primary placeholder:text-text-muted transition-colors {error ? 'border-error focus:border-error focus:ring-error' : 'border-border focus:border-primary focus:ring-primary'} focus:ring-1 {className}"
		{...rest}
	/>
	
	{#if error}
		<p class="text-sm text-error">{error}</p>
	{:else if hint}
		<p class="text-sm text-text-muted">{hint}</p>
	{/if}
</div>
