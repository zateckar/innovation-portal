<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import IdeaChatPanel from '$lib/components/ideas/IdeaChatPanel.svelte';
	import IdeaSpecPanel from '$lib/components/ideas/IdeaSpecPanel.svelte';
	import SpecProgressBar from '$lib/components/ideas/SpecProgressBar.svelte';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS, type DepartmentCategory } from '$lib/types';
	let { data } = $props();
	const idea = $derived(data.idea);
	let currentUserName = $derived($page.data.user?.name ?? 'You');

	function renderMarkdown(source: string): string {
		return Bun.markdown.html(source, { tables: true, strikethrough: true, tasklists: true });
	}

	let specStatusLabel = $derived(
		idea.specStatus === 'completed'
			? idea.specReviewStatus === 'published'
				? 'Published'
				: 'Ready for Review'
			: 'In Progress'
	);

	let specStatusColor = $derived(
		idea.specStatus === 'completed'
			? idea.specReviewStatus === 'published'
				? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
				: 'bg-violet-500/15 text-violet-300 border-violet-500/25'
			: 'bg-amber-500/15 text-amber-300 border-amber-500/25'
	);

	const deptColor = $derived(DEPARTMENT_COLORS[idea.department as DepartmentCategory] ?? '#94A3B8');
	const deptLabel = $derived(DEPARTMENT_LABELS[idea.department as DepartmentCategory] ?? idea.department);

	// ── Build progress tracking ──
	const wsMeta = $derived(data.workspaceMetadata as Record<string, unknown> | null);
	const wsStatus = $derived((wsMeta?.status as string) ?? '');
	const wsVersions = $derived((wsMeta?.versions as Array<{ version: number; status: string; createdAt: string }>) ?? []);

	const activeStatuses = ['creating', 'planning', 'reviewing', 'building', 'testing', 'deploying', 'rebuilding'];
	const isBuildActive = $derived(activeStatuses.includes(wsStatus));

	// Poll for status updates during active build
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		if (isBuildActive) {
			if (!pollInterval) {
				pollInterval = setInterval(() => invalidateAll(), 5000);
			}
		} else {
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
		}
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});

	// Parse STATE.md progress
	interface ProgressItem { label: string; done: boolean; }

	function parseProgress(stateContent: string): ProgressItem[] {
		if (!stateContent) return [];
		const items: ProgressItem[] = [];
		for (const line of stateContent.split('\n')) {
			const doneMatch = line.match(/^\s*-\s*\[x\]\s*(.+)/i);
			const pendingMatch = line.match(/^\s*-\s*\[\s*\]\s*(.+)/);
			if (doneMatch) items.push({ label: doneMatch[1].trim(), done: true });
			else if (pendingMatch) items.push({ label: pendingMatch[1].trim(), done: false });
		}
		return items;
	}

	let progressItems = $derived(parseProgress(data.stateContent));
	let completedCount = $derived(progressItems.filter(i => i.done).length);
	let totalCount = $derived(progressItems.length);
	let progressPercent = $derived(totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);

	// Build phase definitions — maps builder status values to UI labels
	const buildPhases = [
		{ key: 'planning', label: 'Planning & Architecture', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
		{ key: 'reviewing', label: 'Critical Review', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
		{ key: 'building', label: 'Building Application', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
		{ key: 'testing', label: 'Testing & Fixing', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
		{ key: 'deploying', label: 'Deploying', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
		{ key: 'deployed', label: 'Deployed', icon: 'M5 13l4 4L19 7' }
	];
	const phaseOrder = ['creating', 'planning', 'reviewing', 'building', 'testing', 'deploying', 'deployed', 'error'];
	const currentPhaseIdx = $derived(phaseOrder.indexOf(wsStatus));

	// Granular phase from builder (e.g. "Layer 3: API Routes", "UI Quality Audit")
	const currentPhaseLabel = $derived((wsMeta?.currentPhase as string) ?? '');

	// Build activity log
	interface LogEntry { timestamp: string; phase: string; message: string; status: string; }
	const buildLog = $derived(((wsMeta?.buildLog as LogEntry[]) ?? []).slice().reverse());

	// Elapsed time since build started
	const buildStartedAt = $derived(wsMeta?.createdAt as string | undefined);
	let elapsedLabel = $state('');
	let elapsedInterval: ReturnType<typeof setInterval> | null = null;

	function updateElapsed() {
		if (!buildStartedAt || !isBuildActive) { elapsedLabel = ''; return; }
		const ms = Date.now() - new Date(buildStartedAt).getTime();
		const mins = Math.floor(ms / 60000);
		const secs = Math.floor((ms % 60000) / 1000);
		elapsedLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
	}

	$effect(() => {
		if (isBuildActive) {
			updateElapsed();
			if (!elapsedInterval) elapsedInterval = setInterval(updateElapsed, 1000);
		} else {
			if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
			// Show total build time for completed builds
			if (wsStatus === 'deployed' && buildLog.length > 0) {
				const first = buildLog[buildLog.length - 1];
				const last = buildLog[0];
				if (first?.timestamp && last?.timestamp) {
					const ms = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
					const mins = Math.floor(ms / 60000);
					elapsedLabel = mins > 0 ? `${mins}m total` : '<1m total';
				}
			}
		}
	});

	onDestroy(() => { if (elapsedInterval) clearInterval(elapsedInterval); });

	// Activity log state
	let showFullLog = $state(false);
	const visibleLogEntries = $derived(showFullLog ? buildLog : buildLog.slice(0, 5));

	function formatLogTime(ts: string): string {
		try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
		catch { return ''; }
	}

	// Build controls
	let buildLoading = $state(false);
	let buildError = $state('');

	async function triggerBuild() {
		if (buildLoading) return;
		buildLoading = true;
		buildError = '';
		try {
			const res = await fetch(`/api/ideas/${idea.id}/build`, { method: 'POST' });
			const data = await res.json().catch(() => ({})) as { uuid?: string; message?: string };
			if (!res.ok) throw new Error(data.message ?? `Failed (${res.status})`);
			invalidateAll();
		} catch (err) {
			buildError = err instanceof Error ? err.message : 'Failed to start build';
		} finally {
			buildLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{idea.title} — Development — Innovation Incubator</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

	<!-- Back link -->
	<a
		href="{base}/development"
		class="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
	>
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
		</svg>
		Back to Development
	</a>

	<!-- Idea header card -->
	<div class="rounded-2xl border border-white/10 bg-bg-elevated overflow-hidden">
		<div class="h-1 w-full" style="background: linear-gradient(to right, {deptColor}40, {deptColor}10)"></div>

		<div class="px-6 py-5">
			<div class="flex flex-wrap items-center gap-2 mb-3">
				<span
					class="px-2.5 py-0.5 rounded-full text-xs font-medium border"
					style="background-color: {deptColor}20; color: {deptColor}; border-color: {deptColor}40"
				>
					{deptLabel}
				</span>
				<span class="px-2.5 py-0.5 rounded-full text-xs font-medium border {specStatusColor}">
					{specStatusLabel}
				</span>
				{#if idea.hasParticipated}
					<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
						You contributed
					</span>
				{/if}
				{#if wsStatus}
					<span class="px-2.5 py-0.5 rounded-full text-xs font-medium border
						{wsStatus === 'deployed' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' :
						 wsStatus === 'error' ? 'bg-red-500/15 text-red-300 border-red-500/25' :
						 isBuildActive ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' : ''}">
						{#if isBuildActive}
							<span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mr-1"></span>
						{/if}
						Build: {wsStatus}
					</span>
				{/if}
				<div class="ml-auto flex items-center gap-1.5 text-xs text-white/40">
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
					</svg>
					{idea.voteCount} vote{idea.voteCount !== 1 ? 's' : ''}
				</div>
			</div>

			<h1 class="text-2xl font-bold text-white mb-2 leading-snug">{idea.title}</h1>
			<p class="text-white/60 leading-relaxed mb-4">{idea.summary}</p>

			<a
				href="{base}/ideas/{idea.slug}"
				class="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
				</svg>
				View original idea
			</a>
		</div>
	</div>

	<!-- Problem & Solution (collapsible context) -->
	<details class="group rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
		<summary class="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none text-sm font-medium text-white/60 hover:text-white/80 transition-colors list-none">
			<span>Idea Background</span>
			<svg class="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</summary>
		<div class="px-5 pb-5 space-y-4 border-t border-white/[0.07]">
			<div class="pt-4">
				<h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Problem</h3>
				<p class="text-sm text-white/60 leading-relaxed">{idea.problem}</p>
			</div>
			<div>
				<h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Proposed Solution</h3>
				<div class="text-sm text-white/60 leading-relaxed prose prose-invert prose-sm max-w-none
					[&_p]:text-white/60 [&_p]:mb-2 [&_p:last-child]:mb-0
					[&_ul]:pl-4 [&_ul_li]:text-white/60 [&_strong]:text-white/80">
					{@html renderMarkdown(idea.solution)}
				</div>
			</div>
		</div>
	</details>

	<!-- Refinement Chat -->
	{#if idea.specStatus === 'in_progress'}
		<IdeaChatPanel
			ideaId={idea.id}
			initialMessages={idea.chatMessages}
			specStatus={idea.specStatus}
			{currentUserName}
		/>
	{:else if idea.specStatus === 'completed' && idea.chatMessages.length > 0}
		<!-- Collapse the chat once the spec is generated — it's no longer the primary focus -->
		<details class="group rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
			<summary class="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none text-sm font-medium text-white/60 hover:text-white/80 transition-colors list-none">
				<div class="flex items-center gap-2">
					<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>Refinement Chat</span>
					<span class="text-xs text-white/40">({idea.chatMessages.length} messages — completed)</span>
				</div>
				<svg class="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</summary>
			<div class="border-t border-white/[0.07]">
				<IdeaChatPanel
					ideaId={idea.id}
					initialMessages={idea.chatMessages}
					specStatus={idea.specStatus}
					{currentUserName}
				/>
			</div>
		</details>
	{/if}

	<!-- Specification Document (shown when completed) -->
	{#if idea.specStatus === 'completed' && idea.specDocument}
		<IdeaSpecPanel
			ideaId={idea.id}
			specDocument={idea.specDocument}
			specReviewStatus={idea.specReviewStatus}
			hasParticipated={idea.hasParticipated ?? false}
			adoPrUrl={idea.adoPrUrl}
			jiraEscalationKey={idea.jiraEscalationKey}
			jiraWebHostname={data.jiraWebHostname}
		/>
	{/if}

	<!-- Build trigger — when spec is done but no build started yet -->
	{#if idea.specStatus === 'completed' && !idea.workspaceUuid}
		<div class="rounded-2xl border border-white/10 bg-bg-elevated overflow-hidden px-5 py-4">
			<div class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
					</svg>
					<div>
						<p class="text-sm font-medium text-white">Ready to build</p>
						<p class="text-xs text-white/50">The specification is complete. Start the autonomous AI build process.</p>
					</div>
				</div>
				<button
					onclick={triggerBuild}
					disabled={buildLoading}
					class="shrink-0 px-5 py-2.5 text-sm font-semibold rounded-lg
						bg-gradient-to-r from-emerald-600 to-teal-600
						hover:from-emerald-500 hover:to-teal-500
						text-white disabled:opacity-50 transition-all whitespace-nowrap"
				>
					{buildLoading ? 'Starting...' : 'Build Application \u2192'}
				</button>
			</div>
			{#if buildError}
				<p class="mt-3 text-sm text-red-400">{buildError}</p>
			{/if}
		</div>
	{/if}

	<!-- Application Build Panel — below the spec, contains everything build-related -->
	{#if idea.workspaceUuid && wsMeta}
		<div class="rounded-2xl border border-white/10 bg-bg-elevated overflow-hidden">
			<div class="px-5 py-4 border-b border-white/10 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5 {wsStatus === 'deployed' ? 'text-emerald-400' : wsStatus === 'error' ? 'text-red-400' : 'text-sky-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
					</svg>
					<h2 class="font-semibold text-white">Application Build</h2>
					{#if isBuildActive}
						<span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
					{/if}
				</div>
				<div class="flex items-center gap-3">
					{#if wsStatus === 'error' && (wsMeta.error as string)}
						<span class="text-xs text-red-400 max-w-xs truncate" title={wsMeta.error as string}>Failed: {wsMeta.error}</span>
						<button
							onclick={triggerBuild}
							disabled={buildLoading}
							class="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg
								bg-gradient-to-r from-amber-600 to-orange-600
								hover:from-amber-500 hover:to-orange-500
								text-white disabled:opacity-50 transition-all whitespace-nowrap"
						>
							{buildLoading ? 'Retrying...' : 'Retry Build \u21BB'}
						</button>
					{/if}
					{#if wsStatus === 'deployed'}
						<a href="/apps/{idea.workspaceUuid}"
							class="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all">
							View Application &#8599;
						</a>
					{/if}
				</div>
			</div>

			<div class="px-5 py-4 space-y-4">
				<!-- Elapsed time + current sub-phase -->
				{#if elapsedLabel}
					<div class="flex items-center justify-between text-xs">
						<div class="flex items-center gap-2">
							{#if isBuildActive && currentPhaseLabel}
								<span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
								<span class="text-amber-300 font-medium">{currentPhaseLabel}</span>
							{:else if wsStatus === 'deployed'}
								<span class="text-emerald-400">✓ Build successful</span>
							{/if}
						</div>
						<span class="text-white/40 font-mono tabular-nums">
							{#if isBuildActive}⏱{/if} {elapsedLabel}
						</span>
					</div>
				{/if}

				<!-- Build phases (always show all phases) -->
				<div class="grid gap-1">
					{#each buildPhases as phase, i}
						{@const phaseIdx = phaseOrder.indexOf(phase.key)}
						{@const isDone = currentPhaseIdx > phaseIdx || wsStatus === 'deployed'}
						{@const isActive = wsStatus === phase.key}
						{@const isFailed = wsStatus === 'error' && currentPhaseIdx >= phaseIdx}
						<div class="flex items-center gap-3 py-1.5 text-sm
							{isDone ? 'text-emerald-400/70' : isActive ? 'text-amber-300' : isFailed ? 'text-red-400/70' : 'text-white/30'}">
							{#if isDone}
								<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							{:else if isActive}
								<svg class="w-4 h-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{:else}
								<div class="w-4 h-4 border border-white/20 rounded-full shrink-0"></div>
							{/if}
							<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={phase.icon} />
							</svg>
							<span class="{isActive ? 'font-medium' : ''}">{phase.label}</span>
							{#if isActive && currentPhaseLabel}
								<span class="text-xs text-amber-300/60 ml-1">— {currentPhaseLabel}</span>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Build Activity Log -->
				{#if buildLog.length > 0}
					<details class="group" open={isBuildActive}>
						<summary class="text-xs text-white/40 cursor-pointer hover:text-white/60 transition-colors list-none flex items-center gap-1.5">
							<svg class="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
							Build Activity ({buildLog.length} events)
						</summary>
						<div class="mt-2 space-y-0.5 max-h-64 overflow-y-auto scrollbar-thin">
							{#each visibleLogEntries as entry}
								<div class="flex items-start gap-2 py-1 text-xs">
									<span class="text-white/25 font-mono tabular-nums shrink-0 w-16">{formatLogTime(entry.timestamp)}</span>
									{#if entry.status === 'completed'}
										<svg class="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
										</svg>
									{:else if entry.status === 'started'}
										<svg class="w-3 h-3 text-sky-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
										</svg>
									{:else if entry.status === 'error'}
										<svg class="w-3 h-3 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
									{:else}
										<svg class="w-3 h-3 text-white/30 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
									{/if}
									<div>
										<span class="font-medium {entry.status === 'error' ? 'text-red-400' : entry.status === 'completed' ? 'text-emerald-400/80' : 'text-white/60'}">{entry.phase}</span>
										<span class="text-white/35 ml-1">{entry.message}</span>
									</div>
								</div>
							{/each}
							{#if buildLog.length > 5 && !showFullLog}
								<button
									onclick={() => showFullLog = true}
									class="text-xs text-sky-400/60 hover:text-sky-400 transition-colors mt-1 pl-[4.5rem]"
								>
									Show {buildLog.length - 5} more events...
								</button>
							{/if}
						</div>
					</details>
				{/if}

				<!-- STATE.md progress details (if available) -->
				{#if progressItems.length > 0}
					<details class="group">
						<summary class="text-xs text-white/40 cursor-pointer hover:text-white/60 transition-colors list-none flex items-center gap-1.5">
							<svg class="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
							Detailed progress ({completedCount}/{totalCount} steps)
						</summary>
						<div class="mt-2 pl-4 grid gap-1">
							{#each progressItems as item, i}
								<div class="flex items-center gap-2 text-xs {item.done ? 'text-gray-500' : 'text-gray-400'}">
									{#if item.done}
										<svg class="w-3 h-3 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
										</svg>
										<span class="line-through">{item.label}</span>
									{:else}
										<div class="w-3 h-3 border border-gray-600 rounded shrink-0"></div>
										<span>{item.label}</span>
									{/if}
								</div>
							{/each}
						</div>
					</details>
				{/if}

				<!-- Deployed versions -->
				{#if wsVersions.length > 0}
					<div class="border-t border-white/5 pt-4">
						<h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Versions</h3>
						<div class="flex gap-2 flex-wrap">
							{#each wsVersions as v}
								<a
									href="/apps/{idea.workspaceUuid}/v{v.version}/"
									class="px-3 py-2 rounded-lg border text-sm transition-colors
										{v.status === 'deployed'
											? 'border-emerald-500/30 bg-emerald-900/10 hover:bg-emerald-900/20 text-emerald-300'
											: v.status === 'error'
												? 'border-red-500/30 bg-red-900/10 text-red-300'
												: 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-400'}"
									target="_blank"
								>
									<span class="font-mono font-bold">v{v.version}</span>
									<span class="ml-1.5 text-xs opacity-70">({v.status})</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Git repo link -->
				{#if idea.appRepoUrl}
					<div class="border-t border-white/5 pt-4">
						<a href={idea.appRepoUrl} target="_blank" rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors">
							<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg>
							Git Repository
						</a>
					</div>
				{/if}
			</div>
		</div>
	{/if}

</div>
