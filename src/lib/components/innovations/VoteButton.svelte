<script lang="ts">
	interface Props {
		innovationId: string;
		voteCount: number;
		hasVoted: boolean;
		size?: 'sm' | 'md';
	}
	
	let { innovationId, voteCount, hasVoted, size = 'sm' }: Props = $props();
	let loading = $state(false);
	
	let localVoteDelta = $state(0);
	let localHasVotedOverride = $state<boolean | null>(null);

	let currentVoteCount = $derived(Math.max(0, (Number(voteCount) || 0) + localVoteDelta));
	let currentHasVoted = $derived(localHasVotedOverride !== null ? localHasVotedOverride : Boolean(hasVoted));
	
	async function toggleVote(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		
		loading = true;
		const wasVoted = currentHasVoted;
		
		try {
			const response = await fetch(`/api/innovations/${innovationId}/vote`, {
				method: wasVoted ? 'DELETE' : 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				if (wasVoted) {
					// Successfully removed vote
					localHasVotedOverride = false;
					localVoteDelta--;
				} else {
					// Successfully added vote
					localHasVotedOverride = true;
					localVoteDelta++;
				}
			} else if (response.status === 401) {
				// Redirect to login
				window.location.href = '/auth/login';
			} else if (response.status === 400) {
				// Already voted - sync state to reflect this
				localHasVotedOverride = true;
			} else if (response.status === 404) {
				// Vote not found - sync state to reflect this
				localHasVotedOverride = false;
			}
		} catch (error) {
			console.error('Vote failed:', error);
		} finally {
			loading = false;
		}
	}
	
	const sizes = {
		sm: 'px-3 py-1.5 text-sm',
		md: 'px-4 py-2'
	};
</script>

<button
	onclick={toggleVote}
	disabled={loading}
	aria-label={currentHasVoted ? 'Remove vote' : 'Vote for this innovation'}
	title={currentHasVoted ? 'Click to remove your vote' : 'Click to vote'}
	class="inline-flex items-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50
		{currentHasVoted 
			? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30' 
			: 'bg-bg-hover text-text-secondary border border-border hover:border-primary hover:text-primary'}
		{sizes[size]}"
>
	{#if loading}
		<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
	{:else}
		<svg class="w-4 h-4" fill={currentHasVoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
		</svg>
	{/if}
	<span>{currentVoteCount}</span>
</button>
