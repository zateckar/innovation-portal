<script lang="ts">
	import type { IdeaChatMessage } from '$lib/types';

	interface Props {
		ideaId: string;
		initialMessages: IdeaChatMessage[];
		specStatus: 'not_started' | 'in_progress' | 'completed';
		currentUserName?: string;
	}

	let { ideaId, initialMessages, specStatus, currentUserName = 'You' }: Props = $props();

	let messages = $state<IdeaChatMessage[]>([...initialMessages]);
	let inputText = $state('');
	let sending = $state(false);
	let sendError = $state<string | null>(null);
	let messagesEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (messagesEl) {
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}
	});

	async function sendMessage() {
		if (!inputText.trim() || sending || specStatus === 'completed') return;
		sending = true;
		sendError = null;
		const content = inputText.trim();
		inputText = '';

		// Optimistic user message
		messages = [
			...messages,
			{
				id: crypto.randomUUID(),
				ideaId,
				role: 'user',
				userId: null,
				userName: currentUserName,
				content,
				createdAt: new Date()
			}
		];

		try {
			const res = await fetch(`/api/ideas/${ideaId}/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content })
			});

			if (!res.ok) throw new Error(await res.text());

			// Reload all messages to get AI reply with correct IDs/timestamps
			const refreshRes = await fetch(`/api/ideas/${ideaId}/chat`);
			if (refreshRes.ok) {
				messages = await refreshRes.json();
			}
		} catch (err) {
			sendError = 'Failed to send message. Please try again.';
			console.error(err);
		} finally {
			sending = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<div class="rounded-xl border border-border bg-bg-surface overflow-hidden">
	<div class="px-5 py-4 border-b border-border flex items-center gap-3">
		<div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
			<svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
			</svg>
		</div>
		<div>
			<h3 class="font-semibold text-text-primary">Refinement Chat</h3>
			<p class="text-xs text-text-muted">
				{#if specStatus === 'completed'}
					Conversation complete — specification has been generated
				{:else}
					Help shape this idea into a specification
				{/if}
			</p>
		</div>
	</div>

	<!-- Message history -->
	<div bind:this={messagesEl} class="h-96 overflow-y-auto p-5 space-y-4 scroll-smooth">
		{#each messages as msg (msg.id)}
			<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-3">
				{#if msg.role === 'ai'}
					<div
						class="w-7 h-7 shrink-0 rounded-full bg-primary/20 flex items-center justify-center mt-1"
					>
						<svg
							class="w-3.5 h-3.5 text-primary"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2"
							/>
						</svg>
					</div>
				{/if}
				<div
					class="max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
					{msg.role === 'ai'
						? 'bg-bg-elevated text-text-primary rounded-tl-sm'
						: 'bg-primary text-white rounded-tr-sm'}"
				>
					{#if msg.role === 'ai'}
						<!-- Render basic markdown: bold and line breaks -->
						{@html msg.content
							.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
							.replace(/\n/g, '<br>')}
					{:else}
						{msg.content}
					{/if}
					<div class="mt-1.5 text-xs opacity-50">
						{msg.role === 'user' ? (msg.userName ?? (msg.userId ? 'User' : 'AI')) : 'AI Facilitator'}
						{msg.createdAt
							? ' · ' +
								new Date(msg.createdAt).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit'
								})
							: ''}
					</div>
				</div>
				{#if msg.role === 'user'}
					<div
						class="w-7 h-7 shrink-0 rounded-full bg-bg-elevated flex items-center justify-center mt-1"
					>
						<svg
							class="w-3.5 h-3.5 text-text-muted"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
					</div>
				{/if}
			</div>
		{/each}

		{#if sending}
			<div class="flex justify-start gap-3">
				<div
					class="w-7 h-7 shrink-0 rounded-full bg-primary/20 flex items-center justify-center mt-1"
				>
					<svg
						class="w-3.5 h-3.5 text-primary"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2"
						/>
					</svg>
				</div>
				<div class="bg-bg-elevated rounded-2xl rounded-tl-sm px-4 py-3">
					<div class="flex gap-1 items-center h-5">
						<span
							class="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]"
						></span>
						<span
							class="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]"
						></span>
						<span
							class="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]"
						></span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if sendError}
		<div class="px-5 py-2 text-sm text-error bg-error/10">{sendError}</div>
	{/if}

	<!-- Input area -->
	{#if specStatus !== 'completed'}
		<div class="px-5 py-4 border-t border-border flex gap-3">
			<textarea
				bind:value={inputText}
				onkeydown={handleKeydown}
				placeholder="Share your thoughts or answer the AI's question… (Enter to send, Shift+Enter for new line)"
				rows="2"
				disabled={sending}
				class="flex-1 resize-none rounded-lg bg-bg-elevated border border-border text-text-primary placeholder:text-text-muted text-sm px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50"
			></textarea>
			<button
				onclick={sendMessage}
				disabled={sending || !inputText.trim()}
				class="self-end px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Send
			</button>
		</div>
	{/if}
</div>
