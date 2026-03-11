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
		primary: [
			'text-bg-base font-semibold',
			'transition-all duration-200',
		].join(' '),
		secondary: [
			'bg-bg-elevated border border-border text-text-primary',
			'hover:bg-bg-hover hover:border-border-hover',
			'transition-all duration-200',
		].join(' '),
		ghost: [
			'bg-transparent text-text-secondary',
			'hover:text-text-primary hover:bg-bg-hover',
			'transition-all duration-200',
		].join(' '),
		danger: [
			'border text-error',
			'hover:bg-error/10',
			'transition-all duration-200',
		].join(' '),
	};
	
	const sizes = {
		sm: 'px-3 py-1.5 text-sm gap-1.5',
		md: 'px-4 py-2 text-sm gap-2',
		lg: 'px-6 py-3 text-base gap-2',
	};
</script>

<button
	class="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed {variants[variant]} {sizes[size]} {className}"
	style="
		{variant === 'primary' ? `
			background: linear-gradient(135deg, #00D4AA 0%, #00A884 100%);
			box-shadow: 0 0 16px rgba(0, 212, 170, 0.2), 0 2px 8px rgba(0,0,0,0.3);
			font-family: var(--font-display);
			letter-spacing: 0.02em;
		` : ''}
		{variant === 'danger' ? `
			background: rgba(255, 71, 87, 0.06);
			border-color: rgba(255, 71, 87, 0.25);
		` : ''}
	"
	disabled={disabled || loading}
	{...rest}
>
	{#if loading}
		<svg class="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
	{/if}
	{@render children()}
</button>
