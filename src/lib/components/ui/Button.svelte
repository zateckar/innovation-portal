<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	
	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		children: Snippet;
	}
	
	let { 
		variant = 'primary', 
		size = 'md', 
		loading = false,
		disabled,
		class: className = '',
		children,
		...rest
	}: Props = $props();
	
	const variants = {
		primary: 'bg-gradient-to-r from-primary to-primary-hover text-white hover:opacity-90',
		secondary: 'bg-bg-elevated border border-border text-text-primary hover:bg-bg-hover hover:border-border-hover',
		ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover',
		danger: 'bg-error/10 border border-error/30 text-error hover:bg-error/20'
	};
	
	const sizes = {
		sm: 'px-3 py-1.5 text-sm',
		md: 'px-4 py-2',
		lg: 'px-6 py-3 text-lg'
	};
</script>

<button
	class="inline-flex items-center justify-center font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed {variants[variant]} {sizes[size]} {className}"
	disabled={disabled || loading}
	{...rest}
>
	{#if loading}
		<svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
	{/if}
	{@render children()}
</button>
