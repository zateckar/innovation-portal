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
	
	const paddings = {
		none: '',
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8'
	};
</script>

<div 
	class="rounded-xl {paddings[padding]} {className}"
	style="
		background: rgba(23, 32, 48, 0.88);
		backdrop-filter: blur(16px) saturate(1.5);
		-webkit-backdrop-filter: blur(16px) saturate(1.5);
		border: 1px solid var(--color-border);
		{variant === 'elevated' ? 'box-shadow: 0 4px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.05) inset;' : ''}
		{variant === 'interactive' ? 'box-shadow: 0 2px 16px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.04) inset; cursor: pointer;' : ''}
		{variant !== 'interactive' ? 'box-shadow: 0 2px 16px rgba(0,0,0,0.2);' : ''}
		transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
	"
	{...rest}
>
	{@render children()}
</div>
