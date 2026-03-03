<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	
	interface Props extends HTMLSelectAttributes {
		label?: string;
		error?: string;
		children: Snippet;
	}
	
	let { 
		label,
		error,
		id,
		class: className = '',
		children,
		...rest
	}: Props = $props();
	
	const fallbackId = `select-${Math.random().toString(36).slice(2, 9)}`;
	const selectId = $derived(id || fallbackId);
</script>

<div class="space-y-2">
	{#if label}
		<label for={selectId} class="block text-sm font-medium text-text-secondary">
			{label}
		</label>
	{/if}
	
	<div class="relative">
		<select
			id={selectId}
			class="w-full px-4 py-3 rounded-lg bg-bg-surface border text-text-primary appearance-none cursor-pointer transition-colors {error ? 'border-error focus:border-error focus:ring-error' : 'border-border focus:border-primary focus:ring-primary'} focus:ring-1 {className}"
			{...rest}
		>
			{@render children()}
		</select>
		<div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
			<svg class="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
			</svg>
		</div>
	</div>
	
	{#if error}
		<p class="text-sm text-error">{error}</p>
	{/if}
</div>
