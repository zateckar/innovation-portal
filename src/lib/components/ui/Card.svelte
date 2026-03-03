<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	
	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: 'default' | 'elevated' | 'interactive';
		padding?: 'none' | 'sm' | 'md' | 'lg';
		children: Snippet;
	}
	
	let { 
		variant = 'default',
		padding = 'md',
		class: className = '',
		children,
		...rest
	}: Props = $props();
	
	const variants = {
		default: 'glass',
		elevated: 'glass shadow-lg',
		interactive: 'glass glass-hover cursor-pointer transition-all duration-200'
	};
	
	const paddings = {
		none: '',
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8'
	};
</script>

<div 
	class="rounded-xl {variants[variant]} {paddings[padding]} {className}"
	{...rest}
>
	{@render children()}
</div>
