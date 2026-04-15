<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { IdeaChatMessage } from '$lib/types';

	interface Props {
		ideaId: string;
		initialMessages: IdeaChatMessage[];
		specStatus: 'not_started' | 'in_progress' | 'completed';
		currentUserName?: string;
	}

	let { ideaId, initialMessages, specStatus, currentUserName = 'You' }: Props = $props();

	// untrack: we intentionally seed from the prop once on mount, not reactively.
	let messages = $state<IdeaChatMessage[]>(untrack(() => [...initialMessages]));
	let inputText = $state('');
	let sending = $state(false);
	let sendError = $state<string | null>(null);
	let messagesEl = $state<HTMLDivElement | null>(null);

	// Spec generation: when AI signals readiness, we show a countdown and auto-reload
	let specGenerating = $state(false);
	let reloadCountdown = $state(0);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	// Track if the user has dismissed/used suggestions
	let suggestionsDismissed = $state(false);

	// Approximate exchange count (user messages sent so far)
	let userMessageCount = $derived(messages.filter((m) => m.role === 'user').length);

	// Detect orphaned user message: last message has no AI reply following it
	let lastMessageIsOrphaned = $derived(
		messages.length > 0 &&
		messages[messages.length - 1].role === 'user' &&
		!sending &&
		!specGenerating
	);

	// Exchange counter state: default → warm → ready
	let exchangeCounterState = $derived(
		userMessageCount >= 8 ? 'ready' :
		userMessageCount >= 6 ? 'warm' : 'default'
	);

	// Quick-start suggestion prompts shown when chat is empty or just started
	const SUGGESTIONS = [
		'Who are the primary users and what are their technical skill levels?',
		'What existing systems or data sources does this need to integrate with?',
		'What does success look like 6 months after launch?'
	];

	$effect(() => {
		if (messagesEl) {
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}
	});

	// Auto-clear sendError after 5 seconds
	$effect(() => {
		const err = sendError;
		if (!err) return;
		const timer = setTimeout(() => { sendError = null; }, 5000);
		return () => clearTimeout(timer);
	});

	// Reset suggestion dismissal when a new AI message arrives (conversation continues)
	$effect(() => {
		const aiCount = messages.filter((m) => m.role === 'ai').length;
		if (aiCount > 0 && userMessageCount <= 1) {
			suggestionsDismissed = false;
		}
	});

	function renderAiMarkdown(content: string): string {
		return Bun.markdown.html(content, { tables: true, strikethrough: true, tasklists: true });
	}

	function startSpecReloadCountdown() {
		specGenerating = true;
		reloadCountdown = 15;
		countdownTimer = setInterval(() => {
			reloadCountdown--;
			if (reloadCountdown <= 0) {
				if (countdownTimer) clearInterval(countdownTimer);
				// Use SvelteKit's invalidateAll() to re-fetch data without a full page reload.
				// The parent page will see specStatus='completed' and render the spec panel.
				invalidateAll();
			}
		}, 1000);
	}

	async function sendMessage() {
		if (!inputText.trim() || sending || specStatus === 'completed' || specGenerating) return;
		sending = true;
		sendError = null;
		suggestionsDismissed = true;
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

			const apiData = await res.json() as { aiReply?: string; specTriggered?: boolean };

			// Reload all messages to get AI reply with correct IDs/timestamps
			const refreshRes = await fetch(`/api/ideas/${ideaId}/chat`);
			if (refreshRes.ok) {
				messages = await refreshRes.json();
			}

			// When AI signals it has enough info, start countdown to reload and show spec
			if (apiData.specTriggered) {
				startSpecReloadCountdown();
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

	function useSuggestion(text: string) {
		inputText = text;
		suggestionsDismissed = true;
	}

	function formatTimestamp(date: Date | string | null | undefined): string {
		if (!date) return '';
		const d = date instanceof Date ? date : new Date(date);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div id="chat" class="rounded-xl border border-border bg-bg-surface overflow-hidden">
	<!-- Header -->
	<div class="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
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
					{:else if specGenerating}
						Generating specification document…
					{:else}
						Help shape this idea into a specification
					{/if}
				</p>
			</div>
		</div>

		<!-- Exchange counter: color-coded progress indicator -->
		{#if specStatus === 'in_progress' && !specGenerating}
			{#if exchangeCounterState === 'ready'}
				<div class="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30 shrink-0 animate-pulse">
					<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
					</svg>
					Almost ready!
				</div>
			{:else if exchangeCounterState === 'warm'}
				<div class="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30 shrink-0">
					{userMessageCount} {userMessageCount === 1 ? 'exchange' : 'exchanges'} · ~{Math.max(0, 8 - userMessageCount)} to go
				</div>
			{:else}
				<div class="text-xs text-text-muted bg-bg-elevated px-2.5 py-1 rounded-full border border-border shrink-0">
					{userMessageCount} {userMessageCount === 1 ? 'exchange' : 'exchanges'} · ~{Math.max(0, 8 - userMessageCount)} to go
				</div>
			{/if}
		{/if}
	</div>

	<!-- Spec generating banner -->
	{#if specGenerating}
		<div class="px-5 py-4 bg-primary/5 border-b border-primary/20 flex items-center gap-3">
			<svg class="animate-spin w-5 h-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
			<div class="flex-1">
				<p class="text-sm font-medium text-primary">Generating specification document</p>
				<p class="text-xs text-text-muted">The AI is compiling everything into a spec. Page refreshes in <strong class="text-text-primary">{reloadCountdown}s</strong>…</p>
			</div>
			<button
				onclick={() => { if (countdownTimer) clearInterval(countdownTimer); invalidateAll(); }}
				class="text-xs text-primary underline hover:no-underline shrink-0"
			>
				Refresh now
			</button>
		</div>
	{/if}

	<!-- Message history -->
	<div bind:this={messagesEl} class="h-[640px] overflow-y-auto p-5 space-y-4 scroll-smooth">
		{#if messages.length === 0}
			<div class="h-full flex flex-col items-center justify-center gap-2 text-center">
				<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-1">
					<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
					</svg>
				</div>
				<p class="text-sm text-text-muted">The AI facilitator will start the conversation.</p>
				<p class="text-xs text-text-muted/60">Share your thoughts to help shape the specification.</p>
			</div>
		{/if}

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
						<!-- Full markdown rendering for AI messages -->
						<div class="chat-ai-content prose prose-sm prose-invert max-w-none
							[&_p]:mb-2 [&_p:last-child]:mb-0
							[&_ol]:my-2 [&_ol]:pl-5 [&_ol_li]:mb-1
							[&_ul]:my-2 [&_ul]:pl-5 [&_ul_li]:mb-1
							[&_strong]:text-white [&_strong]:font-semibold
							[&_em]:italic [&_em]:opacity-80
							[&_code]:bg-bg-hover [&_code]:text-primary [&_code]:px-1 [&_code]:rounded [&_code]:text-xs">
							{@html renderAiMarkdown(msg.content)}
						</div>
					{:else}
						{msg.content}
					{/if}
					<div class="mt-1.5 text-xs opacity-50">
						{msg.role === 'user' ? (msg.userName ?? (msg.userId ? 'User' : 'You')) : 'AI Facilitator'}
						{#if msg.createdAt}
							· <span title={new Date(msg.createdAt).toLocaleString()}>{formatTimestamp(msg.createdAt)}</span>
						{/if}
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

		<!-- Orphaned message notice: shown when the last message is from user with no AI reply -->
		{#if lastMessageIsOrphaned}
			<div class="flex justify-start gap-3">
				<div class="w-7 h-7 shrink-0 rounded-full bg-text-muted/10 flex items-center justify-center mt-0.5">
					<svg class="w-3.5 h-3.5 text-text-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<p class="text-xs text-text-muted/60 italic mt-1.5">
					The AI didn't respond to that message — send another to continue the conversation.
				</p>
			</div>
		{/if}

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

	<!-- Error banner (auto-clears after 5 seconds) -->
	{#if sendError}
		<div class="px-5 py-2.5 text-sm text-error bg-error/10 border-t border-error/20 flex items-center gap-2">
			<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			{sendError}
			<button onclick={() => { sendError = null; }} aria-label="Dismiss error" class="ml-auto text-error/60 hover:text-error transition-colors shrink-0">
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Input area (hidden after spec is completed or generating) -->
	{#if specStatus !== 'completed' && !specGenerating}
		<!-- Quick-start suggestions: shown when conversation is just beginning and not dismissed -->
		{#if userMessageCount <= 1 && messages.length > 0 && !suggestionsDismissed}
			<div class="px-5 pt-3 pb-0 flex flex-wrap gap-2">
				{#each SUGGESTIONS as suggestion}
					<button
						onclick={() => useSuggestion(suggestion)}
						class="text-xs px-3 py-1.5 rounded-full border border-border bg-bg-elevated text-text-muted
							hover:border-primary/40 hover:text-text-primary hover:bg-primary/5 transition-colors text-left"
					>
						{suggestion}
					</button>
				{/each}
			</div>
		{/if}

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
				class="self-end px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 min-w-[72px] justify-center"
			>
				{#if sending}
					<svg class="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span>Sending</span>
				{:else}
					<span>Send</span>
				{/if}
			</button>
		</div>
	{/if}

	<!-- Completed state footer -->
	{#if specStatus === 'completed'}
		<div class="px-5 py-4 border-t border-border flex items-center gap-3 text-sm text-text-muted">
			<svg class="w-4 h-4 text-success shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			Conversation complete. See the Specification Document below to review and publish.
		</div>
	{/if}
</div>
