<script lang="ts">
	import { Button, Textarea } from '$lib/components/ui';
	
	interface Comment {
		id: string;
		content: string;
		createdAt: Date | null;
		updatedAt: Date | null;
		parentId: string | null;
		userId: string;
		userName: string;
		userAvatar: string | null;
		replies?: Comment[];
	}
	
	interface Props {
		innovationId: string;
		isLoggedIn: boolean;
	}
	
	let { innovationId, isLoggedIn }: Props = $props();
	
	let comments = $state<Comment[]>([]);
	let newComment = $state('');
	let replyingTo = $state<string | null>(null);
	let replyContent = $state('');
	let editingId = $state<string | null>(null);
	let editContent = $state('');
	let isLoading = $state(true);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	
	// Load comments on mount
	$effect(() => {
		loadComments();
	});
	
	async function loadComments() {
		isLoading = true;
		error = null;
		try {
			const response = await fetch(`/api/innovations/${innovationId}/comments`);
			if (response.ok) {
				const data = await response.json();
				comments = data.comments;
			}
		} catch (e) {
			error = 'Failed to load comments';
		} finally {
			isLoading = false;
		}
	}
	
	async function submitComment() {
		if (!newComment.trim()) return;
		
		isSubmitting = true;
		error = null;
		
		try {
			const response = await fetch(`/api/innovations/${innovationId}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: newComment })
			});
			
			if (response.ok) {
				newComment = '';
				await loadComments();
			} else {
				const data = await response.json();
				error = data.error || 'Failed to post comment';
			}
		} catch {
			error = 'Failed to post comment';
		} finally {
			isSubmitting = false;
		}
	}
	
	async function submitReply(parentId: string) {
		if (!replyContent.trim()) return;
		
		isSubmitting = true;
		error = null;
		
		try {
			const response = await fetch(`/api/innovations/${innovationId}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: replyContent, parentId })
			});
			
			if (response.ok) {
				replyContent = '';
				replyingTo = null;
				await loadComments();
			} else {
				const data = await response.json();
				error = data.error || 'Failed to post reply';
			}
		} catch {
			error = 'Failed to post reply';
		} finally {
			isSubmitting = false;
		}
	}
	
	async function deleteComment(commentId: string) {
		if (!confirm('Are you sure you want to delete this comment?')) return;
		
		try {
			const response = await fetch(`/api/comments/${commentId}`, {
				method: 'DELETE'
			});
			
			if (response.ok) {
				await loadComments();
			} else {
				const data = await response.json();
				error = data.error || 'Failed to delete comment';
			}
		} catch {
			error = 'Failed to delete comment';
		}
	}
	
	async function updateComment(commentId: string) {
		if (!editContent.trim()) return;
		
		try {
			const response = await fetch(`/api/comments/${commentId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: editContent })
			});
			
			if (response.ok) {
				editingId = null;
				editContent = '';
				await loadComments();
			} else {
				const data = await response.json();
				error = data.error || 'Failed to update comment';
			}
		} catch {
			error = 'Failed to update comment';
		}
	}
	
	function startEdit(comment: Comment) {
		editingId = comment.id;
		editContent = comment.content;
	}
	
	function cancelEdit() {
		editingId = null;
		editContent = '';
	}
	
	function formatDate(date: Date | null): string {
		if (!date) return '';
		const d = new Date(date);
		return d.toLocaleDateString('en-US', { 
			month: 'short', 
			day: 'numeric',
			year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
			hour: '2-digit',
			minute: '2-digit'
		});
	}
	
	function getInitials(name: string): string {
		return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
	}
</script>

<div class="space-y-6">
	<h2 class="text-xl font-semibold text-text-primary flex items-center gap-2">
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
		</svg>
		Discussion
		{#if comments.length > 0}
			<span class="text-sm font-normal text-text-muted">({comments.length})</span>
		{/if}
	</h2>
	
	{#if error}
		<div class="p-3 rounded-lg bg-error/20 text-error text-sm">
			{error}
		</div>
	{/if}
	
	<!-- New comment form -->
	{#if isLoggedIn}
		<div class="space-y-3">
			<Textarea
				bind:value={newComment}
				placeholder="Share your thoughts on this innovation..."
				rows={3}
			/>
			<div class="flex justify-end">
				<Button 
					onclick={submitComment} 
					disabled={isSubmitting || !newComment.trim()}
					size="sm"
				>
					{isSubmitting ? 'Posting...' : 'Post Comment'}
				</Button>
			</div>
		</div>
	{:else}
		<div class="p-4 rounded-lg glass text-center">
			<p class="text-text-secondary mb-2">Join the discussion</p>
			<a href="/auth/login" class="text-primary hover:underline">
				Sign in to comment
			</a>
		</div>
	{/if}
	
	<!-- Comments list -->
	{#if isLoading}
		<div class="flex justify-center py-8">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else if comments.length === 0}
		<div class="text-center py-8 text-text-muted">
			<p>No comments yet. Be the first to share your thoughts!</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each comments as comment (comment.id)}
				<div class="p-4 rounded-lg bg-bg-card border border-border">
					<!-- Comment header -->
					<div class="flex items-center gap-3 mb-3">
						{#if comment.userAvatar}
							<img 
								src={comment.userAvatar} 
								alt={comment.userName}
								class="w-8 h-8 rounded-full object-cover"
							/>
						{:else}
							<div class="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-medium text-primary">
								{getInitials(comment.userName)}
							</div>
						{/if}
						<div>
							<span class="font-medium text-text-primary">{comment.userName}</span>
							<span class="text-text-muted text-sm ml-2">{formatDate(comment.createdAt)}</span>
							{#if comment.updatedAt && comment.updatedAt !== comment.createdAt}
								<span class="text-text-muted text-xs ml-1">(edited)</span>
							{/if}
						</div>
					</div>
					
					<!-- Comment content -->
					{#if editingId === comment.id}
						<div class="space-y-2">
							<Textarea
								bind:value={editContent}
								rows={3}
							/>
							<div class="flex gap-2">
								<Button size="sm" onclick={() => updateComment(comment.id)}>Save</Button>
								<Button size="sm" variant="ghost" onclick={cancelEdit}>Cancel</Button>
							</div>
						</div>
					{:else}
						<p class="text-text-secondary whitespace-pre-wrap">{comment.content}</p>
						
						<!-- Comment actions -->
						{#if isLoggedIn}
							<div class="flex gap-3 mt-3">
								<button 
									class="text-xs text-text-muted hover:text-primary transition-colors"
									onclick={() => { replyingTo = replyingTo === comment.id ? null : comment.id; replyContent = ''; }}
								>
									Reply
								</button>
								{#if comment.userId === 'current-user-check'}
									<button 
										class="text-xs text-text-muted hover:text-primary transition-colors"
										onclick={() => startEdit(comment)}
									>
										Edit
									</button>
									<button 
										class="text-xs text-text-muted hover:text-error transition-colors"
										onclick={() => deleteComment(comment.id)}
									>
										Delete
									</button>
								{/if}
							</div>
						{/if}
					{/if}
					
					<!-- Reply form -->
					{#if replyingTo === comment.id}
						<div class="mt-4 pl-4 border-l-2 border-border space-y-2">
							<Textarea
								bind:value={replyContent}
								placeholder="Write a reply..."
								rows={2}
							/>
							<div class="flex gap-2">
								<Button size="sm" onclick={() => submitReply(comment.id)} disabled={isSubmitting || !replyContent.trim()}>
									{isSubmitting ? 'Posting...' : 'Reply'}
								</Button>
								<Button size="sm" variant="ghost" onclick={() => { replyingTo = null; replyContent = ''; }}>
									Cancel
								</Button>
							</div>
						</div>
					{/if}
					
					<!-- Replies -->
					{#if comment.replies && comment.replies.length > 0}
						<div class="mt-4 pl-4 border-l-2 border-border space-y-4">
							{#each comment.replies as reply (reply.id)}
								<div class="p-3 rounded-lg bg-bg-hover">
									<div class="flex items-center gap-2 mb-2">
										{#if reply.userAvatar}
											<img 
												src={reply.userAvatar} 
												alt={reply.userName}
												class="w-6 h-6 rounded-full object-cover"
											/>
										{:else}
											<div class="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center text-xs font-medium text-primary">
												{getInitials(reply.userName)}
											</div>
										{/if}
										<span class="text-sm font-medium text-text-primary">{reply.userName}</span>
										<span class="text-text-muted text-xs">{formatDate(reply.createdAt)}</span>
									</div>
									<p class="text-text-secondary text-sm whitespace-pre-wrap">{reply.content}</p>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
