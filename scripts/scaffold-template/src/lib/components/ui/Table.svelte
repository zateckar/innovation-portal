<script lang="ts">
	let {
		columns,
		rows,
		emptyTitle = 'No data yet',
		emptyMessage = '',
		class: className = '',
		rowClick,
		renderCell
	}: {
		columns: { key: string; label: string; class?: string }[];
		rows: Record<string, unknown>[];
		emptyTitle?: string;
		emptyMessage?: string;
		class?: string;
		rowClick?: (row: Record<string, unknown>) => void;
		renderCell?: import('svelte').Snippet<[{ row: Record<string, unknown>; column: { key: string; label: string }; value: unknown }]>;
	} = $props();
</script>

{#if rows.length === 0}
	<div class="text-center py-12 px-4">
		<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
		</svg>
		<h3 class="mt-2 text-sm font-semibold text-gray-900">{emptyTitle}</h3>
		{#if emptyMessage}
			<p class="mt-1 text-sm text-gray-500">{emptyMessage}</p>
		{/if}
	</div>
{:else}
	<div class="overflow-x-auto {className}">
		<table class="min-w-full divide-y divide-gray-200">
			<thead class="bg-gray-50">
				<tr>
					{#each columns as col}
						<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider {col.class || ''}">
							{col.label}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="bg-white divide-y divide-gray-200">
				{#each rows as row, i (i)}
					<tr
						class={rowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
						onclick={() => rowClick?.(row)}
					>
						{#each columns as col}
							<td class="px-4 py-3 text-sm text-gray-900 {col.class || ''}">
								{#if renderCell}
									{@render renderCell({ row, column: col, value: row[col.key] })}
								{:else}
									{String(row[col.key] ?? '')}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
