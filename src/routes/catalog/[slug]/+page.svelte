<script lang="ts">
	import { Card, Button } from '$lib/components/ui';
	import { CATEGORY_LABELS, CATEGORY_COLORS, CATALOG_STATUS_LABELS, CATALOG_STATUS_COLORS } from '$lib/types';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const item = $derived(data.catalogItem);
	
	// Deployment state
	let isDeploying = $state(false);
	let isUndeploying = $state(false);
	let deploymentError = $state<string | null>(null);
	let showRedeployDialog = $state(false);
	let showUndeployDialog = $state(false);

	// Simple markdown-like rendering for howTo
	function renderHowTo(text: string): string {
		return text
			.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-6 mb-2">$1</h3>')
			.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-white mt-6 mb-3">$1</h2>')
			.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-3">$1</h1>')
			.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
			.replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 text-sm">$1</code>')
			.replace(/^- (.+)$/gm, '<li class="ml-4 text-zinc-300">• $1</li>')
			.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-zinc-300 list-decimal">$1</li>')
			.replace(/\n\n/g, '</p><p class="text-zinc-400 mb-3">')
			.replace(/\n/g, '<br/>');
	}

	async function deploy() {
		isDeploying = true;
		deploymentError = null;
		
		try {
			const response = await fetch(`/api/catalog/${item.id}/deploy`, {
				method: 'POST'
			});
			
			const result = await response.json();
			
			if (!response.ok) {
				if (result.error === 'existing_deployment') {
					// User already has a deployment - show redeploy dialog
					showRedeployDialog = true;
				} else {
					deploymentError = result.message || result.error || 'Deployment failed';
				}
			} else {
				// Success - refresh the page data
				await invalidateAll();
			}
		} catch (err) {
			deploymentError = err instanceof Error ? err.message : 'Deployment failed';
		} finally {
			isDeploying = false;
		}
	}

	async function redeploy() {
		// First undeploy, then deploy again
		showRedeployDialog = false;
		await undeploy();
		if (!deploymentError) {
			await deploy();
		}
	}

	async function undeploy() {
		isUndeploying = true;
		deploymentError = null;
		showUndeployDialog = false;
		
		try {
			const response = await fetch(`/api/catalog/${item.id}/deploy`, {
				method: 'DELETE'
			});
			
			if (!response.ok) {
				const result = await response.json();
				deploymentError = result.message || result.error || 'Undeployment failed';
			} else {
				// Success - refresh the page data
				await invalidateAll();
			}
		} catch (err) {
			deploymentError = err instanceof Error ? err.message : 'Undeployment failed';
		} finally {
			isUndeploying = false;
		}
	}
</script>

<svelte:head>
	<title>{item.name} | Incubator Catalog</title>
	<meta name="description" content={item.description} />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8 space-y-8">
	<!-- Back link -->
	<a href="/catalog" class="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
		</svg>
		Back to Catalog
	</a>

	<!-- Header -->
	<div class="space-y-6">
		<!-- Status Banner if not active -->
		{#if item.status !== 'active'}
			<div 
				class="p-4 rounded-lg border flex items-center gap-3"
				style="background-color: {CATALOG_STATUS_COLORS[item.status]}10; border-color: {CATALOG_STATUS_COLORS[item.status]}40;"
			>
				<svg class="w-5 h-5" style="color: {CATALOG_STATUS_COLORS[item.status]};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{#if item.status === 'maintenance'}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
					{/if}
				</svg>
				<div>
					<p class="font-medium" style="color: {CATALOG_STATUS_COLORS[item.status]};">
						{CATALOG_STATUS_LABELS[item.status]}
					</p>
					<p class="text-sm text-zinc-400">
						{#if item.status === 'maintenance'}
							This implementation is temporarily unavailable for maintenance.
						{:else}
							This implementation has been archived and is no longer actively maintained.
						{/if}
					</p>
				</div>
			</div>
		{/if}

		<div class="flex flex-col md:flex-row gap-6">
			<!-- Icon -->
			<div class="shrink-0">
				{#if item.iconUrl}
					<img 
						src={item.iconUrl} 
						alt={item.name}
						class="w-24 h-24 object-contain rounded-xl bg-zinc-800 p-2"
					/>
				{:else}
					<div class="w-24 h-24 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center">
						<svg class="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
						</svg>
					</div>
				{/if}
			</div>

			<!-- Info -->
			<div class="flex-1 space-y-3">
				<div class="flex flex-wrap items-center gap-2">
					<span 
						class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs"
						style="background-color: {CATEGORY_COLORS[item.category]}20; color: {CATEGORY_COLORS[item.category]}; border-color: {CATEGORY_COLORS[item.category]}40;"
					>
						{CATEGORY_LABELS[item.category]}
					</span>
					{#if item.innovationId}
						<span class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs bg-violet-500/20 text-violet-400 border-violet-500/30">
							From Innovation Radar
						</span>
					{/if}
				</div>

				<h1 class="text-3xl font-bold text-white">{item.name}</h1>
				<p class="text-lg text-zinc-400">{item.description}</p>

				<!-- CTA Button -->
				<div class="flex flex-wrap gap-3 pt-2">
					{#if data.deploymentType === 'saas'}
						<!-- SaaS: Simple "Try it Now" button -->
						<a 
							href={item.url} 
							target="_blank" 
							rel="noopener noreferrer"
							class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors {item.status !== 'active' ? 'opacity-50 pointer-events-none' : ''}"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
							</svg>
							Try it Now
						</a>
					{:else}
						<!-- Self-Hosted: Deployment flow -->
						{#if !data.isLoggedIn}
							<!-- Not logged in -->
							<a 
								href="/auth/login"
								class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
								</svg>
								Login to Deploy
							</a>
						{:else if !data.hasAccessToken}
							<!-- Logged in but no OIDC token -->
							<div class="flex flex-col gap-2">
								<a 
									href="/auth/oidc"
									class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
									</svg>
									Login with Corporate SSO
								</a>
								<p class="text-xs text-zinc-500">Corporate SSO login required for deployment</p>
							</div>
						{:else if data.userDeployment}
							<!-- User has an existing deployment -->
							<a 
								href={data.userDeployment.instanceUrl} 
								target="_blank" 
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors {item.status !== 'active' ? 'opacity-50 pointer-events-none' : ''}"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
								</svg>
								Open My Instance
							</a>
							<button 
								type="button"
								onclick={() => showUndeployDialog = true}
								disabled={isUndeploying}
								class="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-zinc-700 hover:border-red-500/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 font-medium transition-colors disabled:opacity-50"
							>
								{#if isUndeploying}
									<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								{/if}
								Remove Instance
							</button>
						{:else}
							<!-- User can deploy -->
							<button 
								type="button"
								onclick={deploy}
								disabled={isDeploying || item.status !== 'active'}
								class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{#if isDeploying}
									<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Deploying...
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
									</svg>
									Deploy My Instance
								{/if}
							</button>
						{/if}
					{/if}
					
					{#if item.relatedInnovation}
						<a 
							href="/innovations/{item.relatedInnovation.slug}"
							class="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 font-medium transition-colors"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							View Research ({item.relatedInnovation.voteCount} votes)
						</a>
					{/if}
				</div>
				
				<!-- Deployment Error -->
				{#if deploymentError}
					<div class="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mt-3">
						{deploymentError}
					</div>
				{/if}
				
				<!-- Deployment Info -->
				{#if data.userDeployment}
					<div class="text-xs text-zinc-500 mt-2">
						Deployed on {new Date(data.userDeployment.deployedAt).toLocaleDateString()}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Screenshot -->
	{#if item.screenshotUrl}
		<Card class="overflow-hidden">
			<img 
				src={item.screenshotUrl} 
				alt="{item.name} screenshot"
				class="w-full h-auto"
			/>
		</Card>
	{/if}

	<!-- How to Use -->
	<Card>
		<div class="p-6 space-y-4">
			<h2 class="text-xl font-semibold text-white flex items-center gap-2">
				<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				How to Use
			</h2>
			<div class="prose prose-invert prose-zinc max-w-none">
				<p class="text-zinc-400 mb-3">
					{@html renderHowTo(item.howTo)}
				</p>
			</div>
		</div>
	</Card>

	<!-- Related Innovation Link -->
	{#if item.relatedInnovation}
		<Card class="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
			<div class="p-6">
				<div class="flex items-start gap-4">
					<div class="shrink-0 w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center">
						<svg class="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
					</div>
					<div class="flex-1">
						<h3 class="text-lg font-semibold text-white">Promoted from Innovation Radar</h3>
						<p class="text-zinc-400 mt-1">
							This implementation is based on <strong class="text-violet-400">{item.relatedInnovation.title}</strong> from our Innovation Radar, 
							which received {item.relatedInnovation.voteCount} votes from the community.
						</p>
						<a 
							href="/innovations/{item.relatedInnovation.slug}"
							class="inline-flex items-center gap-1 mt-3 text-sm text-violet-400 hover:text-violet-300 transition-colors"
						>
							Read full research
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
							</svg>
						</a>
					</div>
				</div>
			</div>
		</Card>
	{/if}

	<!-- Metadata -->
	<div class="text-sm text-zinc-500 flex flex-wrap gap-4">
		{#if item.createdAt}
			<span>Added: {new Date(item.createdAt).toLocaleDateString()}</span>
		{/if}
		{#if item.updatedAt}
			<span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
		{/if}
	</div>
</div>

<!-- Redeploy Confirmation Dialog -->
{#if showRedeployDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button 
			type="button"
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={() => showRedeployDialog = false}
			aria-label="Close dialog"
		></button>
		
		<div class="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-6">
			<h2 class="text-xl font-semibold text-white mb-2">
				Existing Deployment Found
			</h2>
			<p class="text-sm text-zinc-400 mb-6">
				You already have a deployment for this item. Would you like to use your existing instance or replace it with a new one?
			</p>
			
			{#if data.userDeployment}
				<div class="p-3 rounded-lg bg-zinc-800 border border-zinc-700 mb-4">
					<p class="text-xs text-zinc-500 mb-1">Your instance URL:</p>
					<a 
						href={data.userDeployment.instanceUrl} 
						target="_blank" 
						rel="noopener noreferrer"
						class="text-emerald-400 hover:underline text-sm break-all"
					>
						{data.userDeployment.instanceUrl}
					</a>
				</div>
			{/if}
			
			<div class="flex gap-3">
				<a 
					href={data.userDeployment?.instanceUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-colors text-center"
					onclick={() => showRedeployDialog = false}
				>
					Use Existing
				</a>
				<button 
					type="button"
					onclick={redeploy}
					disabled={isDeploying}
					class="flex-1 px-4 py-2 rounded-lg border border-zinc-700 hover:border-amber-500/50 hover:bg-amber-500/10 text-zinc-300 hover:text-amber-300 font-medium text-sm transition-colors disabled:opacity-50"
				>
					Replace
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Undeploy Confirmation Dialog -->
{#if showUndeployDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button 
			type="button"
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={() => showUndeployDialog = false}
			aria-label="Close dialog"
		></button>
		
		<div class="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-6">
			<h2 class="text-xl font-semibold text-white mb-2">
				Remove Instance
			</h2>
			<p class="text-sm text-zinc-400 mb-6">
				Are you sure you want to remove your deployed instance? This action cannot be undone.
			</p>
			
			<div class="flex gap-3">
				<button 
					type="button"
					onclick={() => showUndeployDialog = false}
					class="flex-1 px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-colors"
				>
					Cancel
				</button>
				<button 
					type="button"
					onclick={undeploy}
					disabled={isUndeploying}
					class="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors disabled:opacity-50"
				>
					{#if isUndeploying}
						Removing...
					{:else}
						Remove Instance
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
