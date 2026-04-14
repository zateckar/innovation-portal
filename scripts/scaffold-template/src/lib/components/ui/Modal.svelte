<script lang="ts">
	let {
		open = false,
		title = '',
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		variant = 'default',
		onconfirm,
		oncancel,
		children
	}: {
		open: boolean;
		title?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'default' | 'danger';
		onconfirm?: () => void;
		oncancel?: () => void;
		children?: import('svelte').Snippet;
	} = $props();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) oncancel?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') oncancel?.();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full">
			{#if title}
				<div class="px-6 py-4 border-b border-gray-200">
					<h2 id="modal-title" class="text-lg font-semibold text-gray-900">{title}</h2>
				</div>
			{/if}
			<div class="px-6 py-4">
				{#if children}
					{@render children()}
				{/if}
			</div>
			<div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
					onclick={oncancel}
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 {variant === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}"
					onclick={onconfirm}
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
