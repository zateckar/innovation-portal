<script lang="ts">
	import { base } from '$app/paths';
	import { Card, ScoreBar } from '$lib/components/ui';
	import CommentSection from '$lib/components/innovations/CommentSection.svelte';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS, type DepartmentCategory, type IdeaStatus } from '$lib/types';
	import { marked } from 'marked';
	import { onMount } from 'svelte';

	let { data } = $props();

	const idea = $derived(data.idea);

	let loading = $state(false);
	let localVoteDelta = $state(0);
	let localHasVotedOverride = $state<boolean | null>(null);
	// Auto-height for mockup iframe; starts at 600px as a sensible minimum
	let iframeHeight = $state(600);

	let currentVoteCount = $derived(Math.max(0, (Number(idea.voteCount) || 0) + localVoteDelta));
	let currentHasVoted = $derived(localHasVotedOverride !== null ? localHasVotedOverride : Boolean(idea.hasVoted));

	// Inject a postMessage script into the mockup HTML so the iframe can report
	// its full scrollHeight back to the parent for auto-sizing.
	const POST_MESSAGE_SCRIPT = `<script>
window.addEventListener('load', function() {
  var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  parent.postMessage({ type: 'mockup-height', height: h }, '*');
});
<\/script>`;

	let mockupSrcdoc = $derived(
		idea.realizationHtml
			? idea.realizationHtml.includes('</body>')
				? idea.realizationHtml.replace('</body>', POST_MESSAGE_SCRIPT + '</body>')
				: idea.realizationHtml + POST_MESSAGE_SCRIPT
			: ''
	);

	function renderMarkdown(source: string): string {
		return marked.parse(source, { async: false }) as string;
	}

	function getStatusLabel(status: IdeaStatus): string {
		const labels: Record<IdeaStatus, string> = {
			'draft': 'Draft',
			'evaluated': 'Evaluated',
			'realized': 'Realized',
			'published': 'Published',
			'archived': 'Archived'
		};
		return labels[status] || status;
	}

	function getStatusColor(status: IdeaStatus): string {
		const colors: Record<IdeaStatus, string> = {
			'draft': 'bg-bg-hover text-text-muted border-border',
			'evaluated': 'bg-warning/20 text-warning border-warning/30',
			'realized': 'bg-primary/20 text-primary border-primary/30',
			'published': 'bg-success/20 text-success border-success/30',
			'archived': 'bg-bg-hover text-text-muted border-border'
		};
		return colors[status] || 'bg-bg-hover text-text-muted border-border';
	}

	async function toggleVote(e: Event) {
		e.preventDefault();
		loading = true;
		const wasVoted = currentHasVoted;

		try {
			const response = await fetch(`${base}/api/ideas/${idea.id}/vote`, {
				method: wasVoted ? 'DELETE' : 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (response.ok) {
				if (wasVoted) {
					localHasVotedOverride = false;
					localVoteDelta--;
				} else {
					localHasVotedOverride = true;
					localVoteDelta++;
				}
			} else if (response.status === 401) {
				window.location.href = `${base}/auth/login`;
			} else if (response.status === 400) {
				localHasVotedOverride = true;
			} else if (response.status === 404) {
				localHasVotedOverride = false;
			}
		} catch (error) {
			console.error('Vote failed:', error);
		} finally {
			loading = false;
		}
	}

	function openMockupInNewTab() {
		if (!idea.realizationHtml) return;
		const blob = new Blob([idea.realizationHtml], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const win = window.open(url, '_blank');
		// Revoke the object URL once the new tab has loaded to free memory
		if (win) {
			win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
		}
	}

	// Listen for height reports from the sandboxed mockup iframe
	onMount(() => {
		function onMessage(event: MessageEvent) {
			// srcdoc iframes have an opaque origin reported as 'null'
			if (event.origin !== 'null' && event.origin !== window.location.origin) return;
			if (event.data?.type === 'mockup-height' && typeof event.data.height === 'number') {
				const reported = event.data.height;
				if (reported > 0) iframeHeight = Math.max(reported, 300);
			}
		}
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	});

	// Mermaid: dynamic local import, no CDN
	$effect(() => {
		if (!idea.realizationDiagram) return;

		let cancelled = false;

		import('mermaid').then(({ default: mermaid }) => {
			if (cancelled) return;
			try {
				mermaid.initialize({
					startOnLoad: false,
					theme: 'base',
					themeVariables: {
						// Backgrounds
						background: '#12121A',
						mainBkg: '#1A1A24',
						secondBkg: '#22222E',
						tertiaryBkg: '#12121A',

						// Node fill / stroke
						nodeBorder: '#2A2A3A',
						clusterBkg: '#1A1A24',
						clusterBorder: '#2A2A3A',
						defaultLinkColor: '#6B6B7B',
						titleColor: '#FFFFFF',

						// Primary nodes (boxes, states)
						primaryColor: '#1A1A24',
						primaryBorderColor: '#419468',
						primaryTextColor: '#FFFFFF',

						// Secondary nodes
						secondaryColor: '#22222E',
						secondaryBorderColor: '#2A2A3A',
						secondaryTextColor: '#A0A0B0',

						// Tertiary nodes
						tertiaryColor: '#12121A',
						tertiaryBorderColor: '#2A2A3A',
						tertiaryTextColor: '#A0A0B0',

						// Lines / edges
						lineColor: '#419468',
						edgeLabelBackground: '#12121A',

						// Text
						textColor: '#FFFFFF',
						nodeTextColor: '#FFFFFF',
						labelColor: '#FFFFFF',
						labelTextColor: '#FFFFFF',

						// Special elements
						fillType0: '#1A1A24',
						fillType1: '#22222E',
						fillType2: '#12121A',
						fillType3: '#1A1A24',
						fillType4: '#22222E',
						fillType5: '#12121A',
						fillType6: '#1A1A24',
						fillType7: '#22222E',

						// Sequence diagram
						actorBkg: '#1A1A24',
						actorBorder: '#419468',
						actorTextColor: '#FFFFFF',
						actorLineColor: '#2A2A3A',
						signalColor: '#A0A0B0',
						signalTextColor: '#FFFFFF',
						labelBoxBkgColor: '#12121A',
						labelBoxBorderColor: '#2A2A3A',
						loopTextColor: '#A0A0B0',
						noteBorderColor: '#419468',
						noteBkgColor: '#1A1A24',
						noteTextColor: '#FFFFFF',
						activationBorderColor: '#419468',
						activationBkgColor: '#22222E',

						// Flowchart
						nodeSpacing: 50,
						rankSpacing: 60,

						// Git graph
						git0: '#419468',
						git1: '#78FAAE',
						git2: '#10B981',
						git3: '#F59E0B',
						git4: '#EF4444',
						git5: '#6366F1',
						git6: '#EC4899',
						git7: '#06B6D4',
						gitBranchLabel0: '#FFFFFF',
						gitBranchLabel1: '#0A0A0F',
						gitBranchLabel2: '#0A0A0F',
						gitBranchLabel3: '#0A0A0F',
						gitBranchLabel4: '#FFFFFF',
						gitBranchLabel5: '#FFFFFF',
						gitBranchLabel6: '#FFFFFF',
						gitBranchLabel7: '#FFFFFF',

						// Gantt
						sectionBkgColor: '#1A1A24',
						altSectionBkgColor: '#12121A',
						sectionBkgColor2: '#22222E',
						gridColor: '#2A2A3A',
						doneTaskBkgColor: '#22222E',
						doneTaskBorderColor: '#2A2A3A',
						critBorderColor: '#EF4444',
						critBkgColor: '#EF444420',
						taskBkgColor: '#419468',
						taskBorderColor: '#419468',
						taskTextColor: '#FFFFFF',
						taskTextOutsideColor: '#A0A0B0',
						taskTextClickableColor: '#78FAAE',
						activeTaskBorderColor: '#78FAAE',
						activeTaskBkgColor: '#22222E',
						todayLineColor: '#78FAAE',

						// Pie chart
						pie1: '#419468',
						pie2: '#78FAAE',
						pie3: '#10B981',
						pie4: '#F59E0B',
						pie5: '#EF4444',
						pie6: '#6366F1',
						pie7: '#EC4899',
						pie8: '#06B6D4',
						pie9: '#8B5CF6',
						pie10: '#84CC16',
						pie11: '#FF6B35',
						pie12: '#A0A0B0',
						pieTitleTextSize: '18px',
						pieTitleTextColor: '#FFFFFF',
						pieSectionTextSize: '14px',
						pieSectionTextColor: '#FFFFFF',
						pieLegendTextColor: '#A0A0B0',
						pieLegendTextSize: '13px',

						// Fonts
						fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
						fontSize: '14px',
					},
					flowchart: {
						curve: 'basis',
						padding: 20,
						useMaxWidth: true,
					},
					sequence: {
						useMaxWidth: true,
						boxMargin: 10,
						mirrorActors: false,
					},
				});
				mermaid.run();
			} catch (err) {
				console.error('Mermaid rendering failed:', err);
			}
		});

		return () => { cancelled = true; };
	});
</script>

<svelte:head>
	<title>{idea.title} - Innovation Ideas - Innovation Radar</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Back link -->
	<a 
		href="{base}/ideas" 
		class="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-6"
	>
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
		</svg>
		Back to Ideas
	</a>
	
	<!-- Header -->
	<Card padding="lg" class="mb-8">
		<!-- Badges row -->
		<div class="flex flex-wrap items-center gap-3 mb-4">
			<!-- Department badge -->
			<span 
				class="inline-flex items-center rounded-full border font-medium px-3 py-1 text-sm"
				style="background-color: {DEPARTMENT_COLORS[idea.department]}20; color: {DEPARTMENT_COLORS[idea.department]}; border-color: {DEPARTMENT_COLORS[idea.department]}40"
			>
				{DEPARTMENT_LABELS[idea.department] || idea.department}
			</span>
			
			<!-- Status badge -->
			<span class="inline-flex items-center rounded-full border font-medium px-3 py-1 text-sm {getStatusColor(idea.status)}">
				{getStatusLabel(idea.status)}
			</span>
			
			<!-- Rank badge -->
			{#if idea.rank !== null}
				<span class="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-bold border border-primary/40">
					Rank #{idea.rank}
				</span>
			{/if}

		<!-- View in Jira link (visible to all logged-in users when jiraIssueUrl is set) -->
		{#if data.user && idea.jiraIssueUrl}
			<a
				href={idea.jiraIssueUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1.5 rounded-full border font-medium px-3 py-1 text-sm bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20 transition-colors"
				title="View original Jira issue"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
				</svg>
				{#if idea.jiraIssueKey}
					{idea.jiraIssueKey}
				{:else}
					View in Jira
				{/if}
			</a>
		{/if}

		<!-- Proposed by user badge -->
		{#if idea.source === 'user'}
			<span class="inline-flex items-center gap-1.5 rounded-full border font-medium px-3 py-1 text-sm bg-primary/10 text-primary border-primary/30">
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
				</svg>
				User Proposed
			</span>
		{/if}
	</div>
	
	<!-- Proposed by email (only for user-proposed ideas) -->
	{#if idea.source === 'user' && idea.proposedByEmail}
		<p class="text-sm text-text-muted mb-4">
			Proposed by
			<a href="mailto:{idea.proposedByEmail}" class="text-primary hover:underline">{idea.proposedByEmail}</a>
		</p>
	{/if}
		
		<!-- Title -->
		<h1 class="text-3xl font-bold text-text-primary mb-4">
			{idea.title}
		</h1>
		
		<!-- Summary -->
		<p class="text-text-secondary text-lg leading-relaxed border-l-4 border-primary/40 pl-4 mb-6">
			{idea.summary}
		</p>
		
		<!-- Evaluation Score -->
		{#if idea.evaluationScore !== null}
			<div class="flex items-center gap-4 text-sm text-text-muted">
				<span class="font-medium text-text-primary">Overall Score: {idea.evaluationScore}/10</span>
			</div>
		{/if}
	</Card>
	
	<!-- Evaluation Details -->
	{#if idea.evaluationDetails}
		<Card padding="lg" class="mb-8">
			<h2 class="text-xl font-semibold text-text-primary mb-6 flex items-center gap-2">
				<svg class="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
				</svg>
				Evaluation Scores
			</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<ScoreBar label="Impact" value={idea.evaluationDetails.impact} size="md" />
				<ScoreBar label="Feasibility" value={idea.evaluationDetails.feasibility} size="md" />
				<ScoreBar label="Cost-Effectiveness" value={idea.evaluationDetails.costEffectiveness} size="md" />
				<ScoreBar label="Innovation" value={idea.evaluationDetails.innovation} size="md" />
				<ScoreBar label="Urgency" value={idea.evaluationDetails.urgency} size="md" />
			</div>
		</Card>
	{/if}
	
	<!-- Problem -->
	<Card padding="lg" class="mb-8">
		<h2 class="text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
			<svg class="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
			</svg>
			Problem
		</h2>
		<p class="text-text-secondary leading-relaxed">
			{idea.problem}
		</p>
	</Card>
	
	<!-- Solution -->
	<Card padding="lg" class="mb-8">
		<h2 class="text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
			<svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			Solution
		</h2>
		<div class="prose prose-invert prose-sm max-w-none text-text-secondary [&_a]:text-primary [&_code]:text-primary [&_code]:bg-bg-hover [&_code]:px-1 [&_code]:rounded">
			{@html renderMarkdown(idea.solution)}
		</div>
	</Card>
	
	<!-- Research Data -->
	{#if idea.researchData}
		<Card padding="lg" class="mb-8">
			<h2 class="text-xl font-semibold text-text-primary mb-6 flex items-center gap-2">
				<svg class="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
				</svg>
				Research Data
			</h2>
			
			<div class="space-y-6">
				<!-- Benefits -->
				{#if idea.researchData.benefits && idea.researchData.benefits.length > 0}
					<div>
						<h3 class="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
							<svg class="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
							</svg>
							Benefits
						</h3>
						<ul class="space-y-2">
							{#each idea.researchData.benefits as benefit}
								<li class="flex items-start gap-2 text-text-secondary text-sm">
									<span class="text-success mt-0.5">+</span>
									<span>{benefit}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
				
				<!-- Risks -->
				{#if idea.researchData.risks && idea.researchData.risks.length > 0}
					<div>
						<h3 class="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
							<svg class="w-4 h-4 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
							</svg>
							Risks
						</h3>
						<ul class="space-y-2">
							{#each idea.researchData.risks as risk}
								<li class="flex items-start gap-2 text-text-secondary text-sm">
									<span class="text-error mt-0.5">!</span>
									<span>{risk}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
				
				<!-- Timeline & Cost -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{#if idea.researchData.timeline}
						<div class="p-4 rounded-lg bg-bg-surface border border-border">
							<h4 class="text-sm font-medium text-text-muted mb-1">Timeline</h4>
							<p class="text-text-primary">{idea.researchData.timeline}</p>
						</div>
					{/if}
					{#if idea.researchData.costEstimate}
						<div class="p-4 rounded-lg bg-bg-surface border border-border">
							<h4 class="text-sm font-medium text-text-muted mb-1">Cost Estimate</h4>
							<p class="text-text-primary">{idea.researchData.costEstimate}</p>
						</div>
					{/if}
				</div>
				
				<!-- Required Resources -->
				{#if idea.researchData.requiredResources && idea.researchData.requiredResources.length > 0}
					<div>
						<h3 class="text-base font-semibold text-text-primary mb-3">Required Resources</h3>
						<div class="flex flex-wrap gap-2">
							{#each idea.researchData.requiredResources as resource}
								<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-bg-hover text-text-secondary border border-border">
									{resource}
								</span>
							{/each}
						</div>
					</div>
				{/if}
				
				<!-- Similar Implementations -->
				{#if idea.researchData.similarImplementations && idea.researchData.similarImplementations.length > 0}
					<div>
						<h3 class="text-base font-semibold text-text-primary mb-3">Similar Implementations</h3>
						<div class="space-y-3">
							{#each idea.researchData.similarImplementations as impl}
								<div class="p-3 rounded-lg bg-bg-surface border border-border">
									<div class="flex items-center gap-2 mb-1">
										<span class="font-medium text-text-primary text-sm">{impl.name}</span>
										{#if impl.url}
											<a 
												href={impl.url} 
												target="_blank" 
												rel="noopener noreferrer"
												aria-label="Open implementation link"
												class="text-primary hover:text-primary/80 transition-colors"
											>
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
												</svg>
											</a>
										{/if}
									</div>
									<p class="text-text-secondary text-sm">{impl.description}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</Card>
	{/if}
	
	<!-- Realization Section -->
	{#if idea.realizationHtml || idea.realizationDiagram || idea.realizationNotes}
		<div class="space-y-8 mb-8">
			<h2 class="text-2xl font-bold text-text-primary flex items-center gap-3">
				<svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
				</svg>
				Realization
			</h2>
	
			<!-- Mockup Preview -->
			{#if idea.realizationHtml}
				<Card padding="lg">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-semibold text-text-primary flex items-center gap-2">
							<svg class="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
							</svg>
							Mockup Preview
						</h3>
						<button
							onclick={openMockupInNewTab}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-text-muted hover:text-text-primary border border-border hover:border-primary/50 transition-colors"
							title="Open mockup in new tab"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
							</svg>
							Open full screen
						</button>
					</div>
					<iframe
						srcdoc={mockupSrcdoc}
						sandbox="allow-scripts"
						class="w-full rounded-lg border border-border bg-[#0f172a] transition-[height] duration-300"
						style="height: {iframeHeight}px"
						title="Mockup Preview"
					></iframe>
				</Card>
			{/if}

			<!-- Implementation Diagram -->
			{#if idea.realizationDiagram}
				<Card padding="lg">
					<h3 class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
						<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path>
						</svg>
						Implementation Diagram
					</h3>
					<div class="overflow-x-auto rounded-xl bg-bg-surface border border-border p-6 [&_.mermaid]:flex [&_.mermaid]:justify-center [&_svg]:max-w-full">
						<pre class="mermaid">{idea.realizationDiagram}</pre>
					</div>
				</Card>
			{/if}

			<!-- Implementation Notes -->
			{#if idea.realizationNotes}
				<Card padding="lg">
					<h3 class="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
						<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
						</svg>
						Implementation Notes
					</h3>
					<div class="realization-notes max-w-none
						[&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-border [&_h2:first-child]:mt-0
						[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-5 [&_h3]:mb-2
						[&_p]:text-sm [&_p]:text-text-secondary [&_p]:leading-relaxed [&_p]:mb-3
						[&_ul]:my-2 [&_ul]:space-y-1 [&_li]:text-sm [&_li]:text-text-secondary [&_li]:pl-4 [&_li]:relative [&_li]:before:content-['–'] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-text-muted
						[&_strong]:text-white [&_strong]:font-medium
						[&_a]:text-primary [&_a]:underline
						[&_code]:text-primary [&_code]:bg-bg-hover [&_code]:px-1 [&_code]:rounded [&_code]:text-xs
						[&_table]:w-full [&_table]:text-sm [&_table]:my-4 [&_table]:border-collapse
						[&_thead]:bg-bg-hover
						[&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-text-muted [&_th]:uppercase [&_th]:tracking-wider [&_th]:px-3 [&_th]:py-2 [&_th]:border [&_th]:border-border
						[&_td]:px-3 [&_td]:py-2 [&_td]:text-text-secondary [&_td]:border [&_td]:border-border [&_td]:align-top
						[&_tr:nth-child(even)_td]:bg-bg-hover/40">
						{@html renderMarkdown(idea.realizationNotes)}
					</div>
				</Card>
			{/if}
		</div>
	{/if}
	
	<!-- Vote section -->
	<Card padding="lg" class="text-center mb-8">
		<p class="text-text-secondary mb-4">Do you find this idea valuable?</p>
		<button
			onclick={toggleVote}
			disabled={loading}
			aria-label={currentHasVoted ? 'Remove vote' : 'Vote for this idea'}
			class="inline-flex items-center gap-3 rounded-lg font-medium transition-all disabled:opacity-50 px-6 py-3 text-lg
				{currentHasVoted 
					? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30' 
					: 'bg-bg-hover text-text-secondary border border-border hover:border-primary hover:text-primary'}"
		>
			{#if loading}
				<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			{:else}
				<svg class="w-5 h-5" fill={currentHasVoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
				</svg>
			{/if}
			<span>{currentHasVoted ? 'Voted' : 'Vote'} ({currentVoteCount})</span>
		</button>
	</Card>

	<!-- Comments -->
	<Card padding="lg">
		<CommentSection
			targetId={idea.id}
			targetType="ideas"
			isLoggedIn={!!data.user}
			placeholder="Share your thoughts on this idea..."
		/>
	</Card>
</div>
