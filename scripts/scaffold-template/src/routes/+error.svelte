<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Error {$page.status}</title>
</svelte:head>

<div class="flex items-center justify-center min-h-[60vh]">
	<div class="text-center px-4">
		<p class="text-6xl font-bold text-gray-300">{$page.status}</p>
		<h1 class="mt-4 text-xl font-semibold text-gray-900">
			{#if $page.status === 404}
				Page not found
			{:else if $page.status === 500}
				Something went wrong
			{:else}
				An error occurred
			{/if}
		</h1>
		<p class="mt-2 text-sm text-gray-500">{$page.error?.message || 'An unexpected error occurred.'}</p>
		<div class="mt-6">
			<a
				href="{base}/"
				class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
			>
				Go back home
			</a>
		</div>
	</div>
</div>
