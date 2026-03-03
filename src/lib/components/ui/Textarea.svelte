<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	
	interface Props extends Omit<HTMLTextareaAttributes, 'value'> {
		label?: string;
		error?: string;
		hint?: string;
		value?: string;
	}
	
	let { 
		label,
		error,
		hint,
		id,
		value = $bindable(''),
		class: className = '',
		...rest
	}: Props = $props();
	
	const fallbackId = `textarea-${Math.random().toString(36).slice(2, 9)}`;
	const textareaId = $derived(id || fallbackId);
</script>

<div class="space-y-2">
	{#if label}
		<label for={textareaId} class="block text-sm font-medium text-text-secondary">
			{label}
		</label>
	{/if}
	
	<textarea
		id={textareaId}
		bind:value
		class="w-full px-4 py-3 rounded-lg bg-bg-surface border text-text-primary placeholder:text-text-muted transition-colors resize-y min-h-[100px] {error ? 'border-error focus:border-error focus:ring-error' : 'border-border focus:border-primary focus:ring-primary'} focus:ring-1 {className}"
		{...rest}
	></textarea>
	
	{#if error}
		<p class="text-sm text-error">{error}</p>
	{:else if hint}
		<p class="text-sm text-text-muted">{hint}</p>
	{/if}
</div>
