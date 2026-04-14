<script lang="ts">
	import { base } from '$app/paths';

	let {
		currentPage,
		totalPages,
		baseUrl,
		class: className = ''
	}: {
		currentPage: number;
		totalPages: number;
		baseUrl: string;
		class?: string;
	} = $props();

	let pages = $derived(() => {
		const p: (number | '...')[] = [];
		if (totalPages <= 7) {
			for (let i = 1; i <= totalPages; i++) p.push(i);
		} else {
			p.push(1);
			if (currentPage > 3) p.push('...');
			for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
				p.push(i);
			}
			if (currentPage < totalPages - 2) p.push('...');
			p.push(totalPages);
		}
		return p;
	});
</script>

{#if totalPages > 1}
	<nav class="flex items-center justify-center gap-1 {className}" aria-label="Pagination">
		<a
			href="{baseUrl}?page={currentPage - 1}"
			class="px-3 py-2 text-sm font-medium rounded-lg {currentPage <= 1 ? 'text-gray-300 pointer-events-none' : 'text-gray-700 hover:bg-gray-100'}"
			aria-disabled={currentPage <= 1}
		>
			Previous
		</a>
		{#each pages() as page}
			{#if page === '...'}
				<span class="px-3 py-2 text-sm text-gray-500">...</span>
			{:else}
				<a
					href="{baseUrl}?page={page}"
					class="px-3 py-2 text-sm font-medium rounded-lg {page === currentPage ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					aria-current={page === currentPage ? 'page' : undefined}
				>
					{page}
				</a>
			{/if}
		{/each}
		<a
			href="{baseUrl}?page={currentPage + 1}"
			class="px-3 py-2 text-sm font-medium rounded-lg {currentPage >= totalPages ? 'text-gray-300 pointer-events-none' : 'text-gray-700 hover:bg-gray-100'}"
			aria-disabled={currentPage >= totalPages}
		>
			Next
		</a>
	</nav>
{/if}
