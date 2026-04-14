<script lang="ts">
	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		type = 'button',
		class: className = '',
		onclick,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		onclick?: (e: MouseEvent) => void;
		children?: import('svelte').Snippet;
	} = $props();

	const baseClasses =
		'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

	const variantClasses = {
		primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
		secondary:
			'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500',
		danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
		ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500'
	};

	const sizeClasses = {
		sm: 'px-3 py-1.5 text-sm gap-1.5',
		md: 'px-4 py-2 text-sm gap-2',
		lg: 'px-6 py-3 text-base gap-2'
	};
</script>

<button
	{type}
	disabled={disabled || loading}
	{onclick}
	class="{baseClasses} {variantClasses[variant]} {sizeClasses[size]} {className}"
>
	{#if loading}
		<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
		</svg>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</button>
