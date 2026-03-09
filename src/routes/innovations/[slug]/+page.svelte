<script lang="ts">
	import { Badge, Card, ScoreBar, Button } from '$lib/components/ui';
	import { VoteButton, CommentSection } from '$lib/components/innovations';
	import { CATEGORY_LABELS, CATALOG_STATUS_LABELS } from '$lib/types';
	import { enhance } from '$app/forms';
	
	let { data, form } = $props();
	const innovation = $derived(data.innovation);
	
	// Promotion dialog state
	let showPromotionDialog = $state(false);
	let selectedDeploymentType = $state<'saas' | 'self-hosted'>('saas');
	let isPromoting = $state(false);
	
	function getCategoryGradient(category: string): string {
		const gradients: Record<string, string> = {
			'ai-ml': 'from-purple-600 to-purple-900',
			'devops': 'from-cyan-600 to-cyan-900',
			'security': 'from-red-600 to-red-900',
			'data-analytics': 'from-amber-600 to-amber-900',
			'developer-tools': 'from-emerald-600 to-emerald-900',
			'automation': 'from-pink-600 to-pink-900',
			'collaboration': 'from-indigo-600 to-indigo-900',
			'infrastructure': 'from-lime-600 to-lime-900'
		};
		return gradients[category] || 'from-gray-600 to-gray-900';
	}
</script>

<svelte:head>
	<title>{innovation.title} - Innovation Radar</title>
	<meta name="description" content={innovation.tagline} />
</svelte:head>

<div class="min-h-screen">
	<!-- Admin Status Banner -->
	{#if data.isAdmin && data.innovationStatus !== 'published' && data.innovationStatus !== 'promoted'}
		<div class="bg-warning/20 border-b border-warning/30 px-4 py-3">
			<div class="max-w-6xl mx-auto flex items-center justify-between">
				<div class="flex items-center gap-3">
					<svg class="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
					</svg>
					<span class="text-warning font-medium">
						Admin Preview - This innovation is <span class="uppercase">{data.innovationStatus}</span> (not publicly visible)
					</span>
				</div>
				<a 
					href="/admin/pending"
					class="px-4 py-1.5 rounded-lg bg-warning/20 hover:bg-warning/30 text-warning text-sm font-medium transition-colors"
				>
					Go to Pending Items →
				</a>
			</div>
		</div>
	{/if}
	
	<!-- Hero Banner -->
	<div class="relative h-64 md:h-80 bg-gradient-to-br {getCategoryGradient(innovation.category)}">
		{#if innovation.heroImageUrl}
			<img 
				src={innovation.heroImageUrl} 
				alt={innovation.title}
				class="absolute inset-0 w-full h-full object-cover opacity-40"
			/>
		{/if}
		<div class="absolute inset-0 bg-gradient-to-t from-bg-base via-transparent to-transparent"></div>
		
		<!-- Back link -->
		<div class="absolute top-4 left-4">
			<a 
				href="/innovations"
				class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg glass text-sm text-text-secondary hover:text-text-primary transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
				</svg>
				Back to Browse
			</a>
		</div>
	</div>
	
	<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10 pb-12">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Main Content -->
			<div class="lg:col-span-2 space-y-6">
				<!-- Title Card -->
				<Card padding="lg">
					<!-- Badges -->
					<div class="flex flex-wrap gap-2 mb-4">
						<Badge variant="category" category={innovation.category} size="md">
							{CATEGORY_LABELS[innovation.category as keyof typeof CATEGORY_LABELS]}
						</Badge>
						{#if innovation.hasAiComponent}
							<Badge variant="ai" size="md">AI-Powered</Badge>
						{/if}
						{#if innovation.isOpenSource}
							<Badge variant="oss" size="md">Open Source</Badge>
						{/if}
						{#if innovation.isSelfHosted}
							<Badge variant="selfhost" size="md">Self-Hosted</Badge>
						{/if}
						{#if innovation.maturityLevel}
							<Badge size="md">
								{innovation.maturityLevel.charAt(0).toUpperCase() + innovation.maturityLevel.slice(1)}
							</Badge>
						{/if}
					</div>
					
					<h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-3">
						{innovation.title}
					</h1>
					
					<p class="text-xl text-text-secondary">
						{innovation.tagline}
					</p>
					
					<!-- Tags -->
					{#if innovation.tags.length > 0}
						<div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
							{#each innovation.tags as tag}
								<span class="px-2 py-1 text-xs rounded bg-bg-hover text-text-muted">
									#{tag}
								</span>
							{/each}
						</div>
					{/if}
				</Card>
				
				<!-- Executive Summary -->
				<Card padding="lg">
					<h2 class="text-xl font-semibold text-text-primary mb-4">Executive Summary</h2>
					<div class="prose prose-invert max-w-none text-text-secondary">
						{@html innovation.researchData.executiveSummary.replace(/\n/g, '<br>')}
					</div>
				</Card>
				
				<!-- Key Benefits -->
				{#if innovation.researchData.keyBenefits.length > 0}
					<Card padding="lg">
						<h2 class="text-xl font-semibold text-text-primary mb-4">Key Benefits</h2>
						<ul class="space-y-3">
							{#each innovation.researchData.keyBenefits as benefit}
								<li class="flex items-start gap-3">
									<svg class="w-5 h-5 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
									</svg>
									<span class="text-text-secondary">{benefit}</span>
								</li>
							{/each}
						</ul>
					</Card>
				{/if}
				
				<!-- Use Cases -->
				{#if innovation.researchData.useCases.length > 0}
					<Card padding="lg">
						<h2 class="text-xl font-semibold text-text-primary mb-4">Use Cases</h2>
						<ul class="space-y-3">
							{#each innovation.researchData.useCases as useCase}
								<li class="flex items-start gap-3">
									<svg class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
									</svg>
									<span class="text-text-secondary">{useCase}</span>
								</li>
							{/each}
						</ul>
					</Card>
				{/if}
				
				<!-- Pros & Cons -->
				<Card padding="lg">
					<h2 class="text-xl font-semibold text-text-primary mb-4">Pros & Cons</h2>
					<div class="grid md:grid-cols-2 gap-6">
						<div>
							<h3 class="text-sm font-medium text-success mb-3">Pros</h3>
							<ul class="space-y-2">
								{#each innovation.researchData.prosAndCons.pros as pro}
									<li class="flex items-start gap-2 text-sm text-text-secondary">
										<svg class="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
										</svg>
										{pro}
									</li>
								{/each}
							</ul>
						</div>
						<div>
							<h3 class="text-sm font-medium text-error mb-3">Cons</h3>
							<ul class="space-y-2">
								{#each innovation.researchData.prosAndCons.cons as con}
									<li class="flex items-start gap-2 text-sm text-text-secondary">
										<svg class="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
										</svg>
										{con}
									</li>
								{/each}
							</ul>
						</div>
					</div>
				</Card>
				
				<!-- Competitors -->
				{#if innovation.researchData.competitors.length > 0}
					<Card padding="lg">
						<h2 class="text-xl font-semibold text-text-primary mb-4">Alternatives & Competitors</h2>
						<div class="space-y-4">
							{#each innovation.researchData.competitors as competitor}
								<div class="p-4 rounded-lg bg-bg-hover">
									<div class="flex items-center justify-between mb-2">
										<h3 class="font-medium text-text-primary">{competitor.name}</h3>
										{#if competitor.url}
											<a 
												href={competitor.url} 
												target="_blank" 
												rel="noopener noreferrer"
												class="text-xs text-primary hover:underline"
											>
												Visit →
											</a>
										{/if}
									</div>
									<p class="text-sm text-text-secondary">{competitor.comparison}</p>
								</div>
							{/each}
						</div>
					</Card>
				{/if}
				
				<!-- Sources -->
				{#if innovation.researchData.sources.length > 0}
					<Card padding="lg">
						<h2 class="text-xl font-semibold text-text-primary mb-4">Sources</h2>
						<ul class="space-y-2">
							{#each innovation.researchData.sources as source, i}
								<li class="flex items-start gap-2">
									<span class="text-text-muted text-sm">[{i + 1}]</span>
									<a 
										href={source.url} 
										target="_blank" 
										rel="noopener noreferrer"
										class="text-sm text-primary hover:underline"
									>
										{source.title || source.url}
									</a>
								</li>
							{/each}
						</ul>
					</Card>
				{/if}
				
				<!-- Comments Section -->
				<Card padding="lg">
				<CommentSection 
					targetId={innovation.id}
					targetType="innovations"
					isLoggedIn={data.user !== null}
					placeholder="Share your thoughts on this innovation..."
				/>
				</Card>
			</div>
			
			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- Vote Panel -->
				<Card padding="lg">
					<div class="text-center mb-6">
						<div class="text-4xl font-bold text-text-primary mb-1">{innovation.voteCount}</div>
						<div class="text-sm text-text-muted">votes</div>
					</div>
					
					<VoteButton 
						innovationId={innovation.id} 
						voteCount={innovation.voteCount} 
						hasVoted={innovation.hasVoted}
						size="md"
					/>
					
					<p class="text-xs text-text-muted text-center mt-3">
						Vote for this innovation to help prioritize implementation
					</p>
				</Card>
				
				<!-- Quick Stats -->
				<Card padding="lg">
					<h3 class="font-semibold text-text-primary mb-4">Quick Stats</h3>
					<div class="space-y-4">
						<div class="flex justify-between items-center">
							<span class="text-text-muted text-sm">Maturity</span>
							<span class="text-text-primary text-sm font-medium">
								{innovation.maturityLevel ? innovation.maturityLevel.charAt(0).toUpperCase() + innovation.maturityLevel.slice(1) : 'Unknown'}
							</span>
						</div>
						{#if innovation.license}
							<div class="flex justify-between items-center">
								<span class="text-text-muted text-sm">License</span>
								<span class="text-text-primary text-sm font-medium">{innovation.license}</span>
							</div>
						{/if}
						{#if innovation.researchData.estimatedTimeToMVP}
							<div class="flex justify-between items-center">
								<span class="text-text-muted text-sm">Time to MVP</span>
								<span class="text-text-primary text-sm font-medium">{innovation.researchData.estimatedTimeToMVP}</span>
							</div>
						{/if}
						{#if innovation.researchData.requiredSkills.length > 0}
							<div>
								<span class="text-text-muted text-sm block mb-2">Required Skills</span>
								<div class="flex flex-wrap gap-1">
									{#each innovation.researchData.requiredSkills as skill}
										<span class="px-2 py-0.5 text-xs rounded bg-bg-hover text-text-secondary">{skill}</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</Card>
				
				<!-- Scores -->
				<Card padding="lg">
					<h3 class="font-semibold text-text-primary mb-4">Scores</h3>
					<div class="space-y-4">
						{#if innovation.relevanceScore !== null}
							<ScoreBar label="Relevance" value={innovation.relevanceScore} size="md" />
						{/if}
						{#if innovation.innovationScore !== null}
							<ScoreBar label="Innovation" value={innovation.innovationScore} size="md" />
						{/if}
						{#if innovation.actionabilityScore !== null}
							<ScoreBar label="Actionability" value={innovation.actionabilityScore} size="md" />
						{/if}
					</div>
				</Card>
				
				<!-- Actions -->
				{#if innovation.githubUrl || innovation.documentationUrl}
					<Card padding="lg">
						<h3 class="font-semibold text-text-primary mb-4">Actions</h3>
						<div class="space-y-3">
							{#if innovation.githubUrl}
								<a 
									href={innovation.githubUrl} 
									target="_blank" 
									rel="noopener noreferrer"
									class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-border-hover hover:bg-bg-hover transition-colors text-sm"
								>
									<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
									</svg>
									View on GitHub
								</a>
							{/if}
							{#if innovation.documentationUrl}
								<a 
									href={innovation.documentationUrl} 
									target="_blank" 
									rel="noopener noreferrer"
									class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-border-hover hover:bg-bg-hover transition-colors text-sm"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
									</svg>
									Documentation
								</a>
							{/if}
						</div>
					</Card>
				{/if}

				<!-- Admin Actions -->
				{#if data.isAdmin}
					<Card padding="lg" class="bg-red-500/5 border-red-500/20 mb-6">
						<h3 class="font-semibold text-red-400 mb-4 flex items-center gap-2">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
							Archive Innovation
						</h3>
						<p class="text-sm text-zinc-400 mb-4">
							Archiving this innovation will remove it from the public list.
						</p>
						<form method="POST" action="?/archive" use:enhance>
							<button 
								type="submit"
								class="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
								onclick={(e) => {
									if (!confirm('Are you sure you want to archive this innovation?')) {
										e.preventDefault();
									}
								}}
							>
								Archive
							</button>
						</form>
					</Card>

					<Card padding="lg" class="bg-emerald-500/5 border-emerald-500/20">
						<h3 class="font-semibold text-emerald-400 mb-4 flex items-center gap-2">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
							</svg>
							Incubator Catalog
						</h3>

						{#if form?.error}
							<div class="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
								{form.error}
							</div>
						{/if}

						{#if data.catalogItem}
							<!-- Already promoted -->
							<div class="space-y-3">
								<div class="flex items-center gap-2 text-emerald-400 text-sm">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									Promoted to Catalog
								</div>
								<div class="text-xs text-zinc-400">
									Status: <span class="text-zinc-300">{CATALOG_STATUS_LABELS[data.catalogItem.status as keyof typeof CATALOG_STATUS_LABELS]}</span>
								</div>
								<div class="flex gap-2">
									<a 
										href="/catalog/{data.catalogItem.slug}"
										class="flex-1 text-center px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-sm transition-colors"
									>
										View
									</a>
									<a 
										href="/admin/catalog/{data.catalogItem.id}/edit"
										class="flex-1 text-center px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm transition-colors"
									>
										Edit
									</a>
								</div>
							</div>
						{:else}
							<!-- Can be promoted -->
							<div class="space-y-3">
								<p class="text-sm text-zinc-400">
									Promote this innovation to the Incubator Catalog to make it available for users to try.
								</p>
								<button 
									type="button"
									onclick={() => showPromotionDialog = true}
									class="w-full px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
									</svg>
									Promote to Catalog
								</button>
								<p class="text-xs text-zinc-500">
									You'll be redirected to add implementation details.
								</p>
							</div>
						{/if}
					</Card>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Promotion Dialog -->
{#if showPromotionDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<button 
			type="button"
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={() => showPromotionDialog = false}
			aria-label="Close dialog"
		></button>
		
		<!-- Dialog -->
		<div class="relative bg-bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6">
			<h2 class="text-xl font-semibold text-text-primary mb-2">
				Promote to Catalog
			</h2>
			<p class="text-sm text-text-secondary mb-6">
				Choose how this innovation will be deployed for users.
			</p>
			
			<form 
				method="POST" 
				action="?/promote" 
				use:enhance={() => {
					isPromoting = true;
					return async ({ update }) => {
						await update();
						isPromoting = false;
					};
				}}
			>
				<div class="space-y-3 mb-6">
					<!-- SaaS Option -->
					<label 
						class="block p-4 rounded-lg border-2 cursor-pointer transition-all {selectedDeploymentType === 'saas' ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:border-border-hover'}"
					>
						<input 
							type="radio" 
							name="deploymentType" 
							value="saas" 
							bind:group={selectedDeploymentType}
							class="sr-only"
						/>
						<div class="flex items-start gap-3">
							<div class="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 {selectedDeploymentType === 'saas' ? 'border-emerald-500' : 'border-text-muted'}">
								{#if selectedDeploymentType === 'saas'}
									<div class="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
								{/if}
							</div>
							<div class="flex-1">
								<div class="font-medium text-text-primary">SaaS / Shared URL</div>
								<p class="text-sm text-text-muted mt-1">
									Single URL for all users. Use this for existing external services or shared instances.
								</p>
							</div>
						</div>
					</label>
					
					<!-- Self-Hosted Option -->
					<label 
						class="block p-4 rounded-lg border-2 cursor-pointer transition-all {selectedDeploymentType === 'self-hosted' ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:border-border-hover'}"
					>
						<input 
							type="radio" 
							name="deploymentType" 
							value="self-hosted" 
							bind:group={selectedDeploymentType}
							class="sr-only"
						/>
						<div class="flex items-start gap-3">
							<div class="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 {selectedDeploymentType === 'self-hosted' ? 'border-emerald-500' : 'border-text-muted'}">
								{#if selectedDeploymentType === 'self-hosted'}
									<div class="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
								{/if}
							</div>
							<div class="flex-1">
								<div class="font-medium text-text-primary">Self-Hosted / Deployable</div>
								<p class="text-sm text-text-muted mt-1">
									Each user gets their own deployed instance. Requires K8s manifest configuration.
								</p>
							</div>
						</div>
					</label>
				</div>
				
				<div class="flex gap-3">
					<button 
						type="button"
						onclick={() => showPromotionDialog = false}
						class="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-bg-hover text-text-secondary font-medium text-sm transition-colors"
						disabled={isPromoting}
					>
						Cancel
					</button>
					<button 
						type="submit"
						class="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
						disabled={isPromoting}
					>
						{#if isPromoting}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Promoting...
						{:else}
							Continue
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
