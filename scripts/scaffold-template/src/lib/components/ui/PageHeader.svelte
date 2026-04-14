<script lang="ts">
	let {
		title,
		description = '',
		class: className = '',
		actions
	}: {
		title: string;
		description?: string;
		class?: string;
		actions?: import('svelte').Snippet;
	} = $props();
</script>

<div class="mb-6 sm:flex sm:items-center sm:justify-between {className}">
	<div>
		<h1 class="text-2xl font-bold text-gray-900">{title}</h1>
		{#if description}
			<p class="mt-1 text-sm text-gray-500">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="mt-4 sm:mt-0 sm:ml-4 flex gap-3">
			{@render actions()}
		</div>
	{/if}
</div>
