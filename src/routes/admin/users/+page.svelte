<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button, Badge } from '$lib/components/ui';
	
	let { data, form } = $props();
	
	let showCreateModal = $state(false);
	let showResetPasswordModal = $state<string | null>(null);
	let creating = $state(false);
	let updating = $state(false);
	let deleting = $state<string | null>(null);
	let resetting = $state(false);
	
	function formatDate(date: Date | null): string {
		if (!date) return 'Never';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
	
	function getInitials(name: string): string {
		return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
	}
</script>

<svelte:head>
	<title>User Management - Innovation Radar</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">Users</h1>
		<p class="text-text-secondary mt-1">Manage local users and view OIDC users</p>
	</div>
	
	{#if form?.success}
		<div class="p-4 rounded-lg bg-success/10 border border-success/30 text-success">
			{form.message}
		</div>
	{/if}
	
	{#if form?.error}
		<div class="p-4 rounded-lg bg-error/10 border border-error/30 text-error">
			{form.error}
		</div>
	{/if}
	
	<!-- Stats -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
		<Card padding="md">
			<div class="text-center">
				<div class="text-3xl font-bold text-text-primary">{data.stats.total}</div>
				<div class="text-sm text-text-secondary">Total Users</div>
			</div>
		</Card>
		<Card padding="md">
			<div class="text-center">
				<div class="text-3xl font-bold text-text-primary">{data.stats.local}</div>
				<div class="text-sm text-text-secondary">Local</div>
			</div>
		</Card>
		<Card padding="md">
			<div class="text-center">
				<div class="text-3xl font-bold text-text-primary">{data.stats.oidc}</div>
				<div class="text-sm text-text-secondary">OIDC</div>
			</div>
		</Card>
		<Card padding="md">
			<div class="text-center">
				<div class="text-3xl font-bold text-text-primary">{data.stats.admins}</div>
				<div class="text-sm text-text-secondary">Admins</div>
			</div>
		</Card>
	</div>
	
	<!-- Actions Bar -->
	<div class="flex flex-col md:flex-row gap-4">
		<form method="GET" class="flex-1 flex gap-2">
			<input
				type="text"
				name="search"
				value={data.search}
				placeholder="Search users..."
				class="flex-1 px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
			>
			<Button type="submit" variant="secondary">Search</Button>
		</form>
		
		<div class="flex gap-2">
			<a href="?filter=all" class="px-4 py-2 rounded-lg {data.filter === 'all' ? 'bg-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'}">
				All
			</a>
			<a href="?filter=local" class="px-4 py-2 rounded-lg {data.filter === 'local' ? 'bg-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'}">
				Local
			</a>
			<a href="?filter=oidc" class="px-4 py-2 rounded-lg {data.filter === 'oidc' ? 'bg-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'}">
				OIDC
			</a>
			<a href="?filter=admins" class="px-4 py-2 rounded-lg {data.filter === 'admins' ? 'bg-primary text-white' : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'}">
				Admins
			</a>
		</div>
		
		<Button onclick={() => showCreateModal = true}>
			+ Create User
		</Button>
	</div>
	
	<!-- Users Table -->
	<Card padding="none">
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead class="bg-bg-hover">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">User</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Provider</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Role</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Created</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Last Login</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.users as user}
						<tr class="hover:bg-bg-hover/50">
							<td class="px-6 py-4">
								<div class="flex items-center gap-3">
									{#if user.avatarUrl}
										<img src={user.avatarUrl} alt="" class="w-10 h-10 rounded-full">
									{:else}
										<div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
											<span class="text-primary font-medium">{getInitials(user.name)}</span>
										</div>
									{/if}
									<div>
										<div class="font-medium text-text-primary">{user.name}</div>
										<div class="text-sm text-text-secondary">{user.email}</div>
									</div>
								</div>
							</td>
							<td class="px-6 py-4">
								{#if user.authProvider === 'local'}
									<Badge variant="default">Local</Badge>
								{:else}
									<Badge variant="default">OIDC</Badge>
								{/if}
							</td>
							<td class="px-6 py-4">
								<form method="POST" action="?/updateRole" use:enhance={() => {
									updating = true;
									return async ({ update }) => {
										await update();
										updating = false;
									};
								}}>
									<input type="hidden" name="userId" value={user.id}>
									<select
										name="role"
										value={user.role}
										onchange={(e) => e.currentTarget.form?.requestSubmit()}
										class="px-3 py-1 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
										disabled={updating}
									>
										<option value="user">User</option>
										<option value="admin">Admin</option>
									</select>
								</form>
							</td>
							<td class="px-6 py-4 text-sm text-text-secondary">
								{formatDate(user.createdAt)}
							</td>
							<td class="px-6 py-4 text-sm text-text-secondary">
								{formatDate(user.lastLoginAt)}
							</td>
							<td class="px-6 py-4 text-right">
								<div class="flex justify-end gap-2">
									{#if user.authProvider === 'local'}
										<button
											onclick={() => showResetPasswordModal = user.id}
											class="text-sm text-primary hover:underline"
										>
											Reset Password
										</button>
									{/if}
									<form method="POST" action="?/delete" use:enhance={() => {
										deleting = user.id;
										return async ({ update }) => {
											await update();
											deleting = null;
										};
									}}>
										<input type="hidden" name="userId" value={user.id}>
										<button
											type="submit"
											class="text-sm text-error hover:underline"
											disabled={deleting === user.id}
										>
											{deleting === user.id ? 'Deleting...' : 'Delete'}
										</button>
									</form>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="px-6 py-8 text-center text-text-secondary">
								No users found
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>
</div>

<!-- Create User Modal -->
{#if showCreateModal}
	<div 
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
		onclick={() => showCreateModal = false}
		onkeydown={(e) => e.key === 'Escape' && (showCreateModal = false)}
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-user-title"
		tabindex="-1"
	>
		<div class="bg-bg-surface rounded-xl p-6 w-full max-w-md shadow-xl" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="presentation">
			<h2 id="create-user-title" class="text-xl font-semibold text-text-primary mb-4">Create New User</h2>
			
			<form method="POST" action="?/create" use:enhance={() => {
				creating = true;
				return async ({ update }) => {
					await update();
					creating = false;
					if (form?.success) showCreateModal = false;
				};
			}}>
				<div class="space-y-4">
					<div>
						<label for="name" class="block text-sm font-medium text-text-secondary mb-1">Name</label>
						<input
							type="text"
							id="name"
							name="name"
							required
							class="w-full px-4 py-2 bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
						>
					</div>
					
					<div>
						<label for="email" class="block text-sm font-medium text-text-secondary mb-1">Email</label>
						<input
							type="email"
							id="email"
							name="email"
							required
							class="w-full px-4 py-2 bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
						>
					</div>
					
					<div>
						<label for="password" class="block text-sm font-medium text-text-secondary mb-1">Password</label>
						<input
							type="password"
							id="password"
							name="password"
							required
							minlength="6"
							class="w-full px-4 py-2 bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
						>
					</div>
					
					<div>
						<label for="role" class="block text-sm font-medium text-text-secondary mb-1">Role</label>
						<select
							id="role"
							name="role"
							class="w-full px-4 py-2 bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
						>
							<option value="user">User</option>
							<option value="admin">Admin</option>
						</select>
					</div>
				</div>
				
				<div class="flex justify-end gap-3 mt-6">
					<Button type="button" variant="ghost" onclick={() => showCreateModal = false}>
						Cancel
					</Button>
					<Button type="submit" variant="primary" loading={creating}>
						Create User
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Reset Password Modal -->
{#if showResetPasswordModal}
	<div 
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
		onclick={() => showResetPasswordModal = null}
		onkeydown={(e) => e.key === 'Escape' && (showResetPasswordModal = null)}
		role="dialog"
		aria-modal="true"
		aria-labelledby="reset-password-title"
		tabindex="-1"
	>
		<div class="bg-bg-surface rounded-xl p-6 w-full max-w-md shadow-xl" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="presentation">
			<h2 id="reset-password-title" class="text-xl font-semibold text-text-primary mb-4">Reset Password</h2>
			
			<form method="POST" action="?/resetPassword" use:enhance={() => {
				resetting = true;
				return async ({ update }) => {
					await update();
					resetting = false;
					if (form?.success) showResetPasswordModal = null;
				};
			}}>
				<input type="hidden" name="userId" value={showResetPasswordModal}>
				
				<div>
					<label for="newPassword" class="block text-sm font-medium text-text-secondary mb-1">New Password</label>
					<input
						type="password"
						id="newPassword"
						name="newPassword"
						required
						minlength="6"
						class="w-full px-4 py-2 bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
					>
				</div>
				
				<div class="flex justify-end gap-3 mt-6">
					<Button type="button" variant="ghost" onclick={() => showResetPasswordModal = null}>
						Cancel
					</Button>
					<Button type="submit" variant="primary" loading={resetting}>
						Reset Password
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
