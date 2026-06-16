<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

	let {
		variant = 'default',
		size = 'md',
		class: className = '',
		children,
		...rest
	}: {
		variant?: BadgeVariant | (string & {});
		size?: 'sm' | 'md';
		class?: string;
		children?: import('svelte').Snippet;
	} & HTMLAttributes<HTMLSpanElement> = $props();

	const variantClasses = {
		default: 'bg-gray-100 text-gray-700',
		success: 'bg-green-100 text-green-700',
		warning: 'bg-yellow-100 text-yellow-800',
		danger: 'bg-red-100 text-red-700',
		info: 'bg-blue-100 text-blue-700',
		purple: 'bg-purple-100 text-purple-700'
	};

	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-0.5 text-sm'
	};

	const variantClass = $derived(variantClasses[variant as BadgeVariant] ?? variantClasses.default);
</script>

<span class="inline-flex items-center font-medium rounded-full {variantClass} {sizeClasses[size]} {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</span>
