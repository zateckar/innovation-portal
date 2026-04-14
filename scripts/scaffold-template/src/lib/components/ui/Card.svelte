<script lang="ts">
	let {
		title = '',
		padding = true,
		class: className = '',
		header,
		children,
		footer
	}: {
		title?: string;
		padding?: boolean;
		class?: string;
		header?: import('svelte').Snippet;
		children?: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	} = $props();
</script>

<div class="bg-white rounded-lg border border-gray-200 shadow-sm {className}">
	{#if title || header}
		<div class="px-4 py-3 sm:px-6 border-b border-gray-200">
			{#if header}
				{@render header()}
			{:else}
				<h3 class="text-lg font-semibold text-gray-900">{title}</h3>
			{/if}
		</div>
	{/if}
	<div class={padding ? 'px-4 py-4 sm:px-6' : ''}>
		{#if children}
			{@render children()}
		{/if}
	</div>
	{#if footer}
		<div class="px-4 py-3 sm:px-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
			{@render footer()}
		</div>
	{/if}
</div>
