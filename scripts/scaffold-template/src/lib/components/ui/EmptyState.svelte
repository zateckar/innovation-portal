<script lang="ts">
	import { base } from '$app/paths';

	let {
		title = 'Nothing here yet',
		message = '',
		icon,
		action
	}: {
		title?: string;
		message?: string;
		icon?: import('svelte').Snippet;
		action?: { label: string; href: string };
	} = $props();
</script>

<div class="text-center py-12 px-4">
	{#if icon}
		<div class="flex justify-center mb-4">
			{@render icon()}
		</div>
	{:else}
		<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
		</svg>
	{/if}
	<h3 class="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
	{#if message}
		<p class="mt-1 text-sm text-gray-500">{message}</p>
	{/if}
	{#if action}
		<div class="mt-6">
			<a
				href="{action.href}"
				class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
			>
				<svg class="-ml-0.5 mr-1.5 h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
				</svg>
				{action.label}
			</a>
		</div>
	{/if}
</div>
