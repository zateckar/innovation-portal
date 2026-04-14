<script lang="ts">
	import { base } from '$app/paths';
	import { InnovationCard } from '$lib/components/innovations';
	import { Badge, Card } from '$lib/components/ui';
	import { CATEGORY_LABELS, DEPARTMENT_LABELS, DEPARTMENT_COLORS, type InnovationCategory, type DepartmentCategory } from '$lib/types';
	import RadarVisualization from '$lib/components/innovations/RadarVisualization.svelte';
	
	let { data } = $props();
	
	const categories = Object.entries(CATEGORY_LABELS) as [InnovationCategory, string][];
	const deptEntries = Object.entries(DEPARTMENT_LABELS) as [DepartmentCategory, string][];

	function getDepartmentGradient(department: string): string {
		const gradients: Record<string, string> = {
			'rd': 'from-purple-600/25 to-violet-900/25',
			'production': 'from-amber-600/25 to-orange-900/25',
			'hr': 'from-pink-600/25 to-rose-900/25',
			'legal': 'from-indigo-600/25 to-blue-900/25',
			'finance': 'from-emerald-600/25 to-green-900/25',
			'it': 'from-cyan-600/25 to-sky-900/25',
			'purchasing': 'from-red-600/25 to-rose-900/25',
			'quality': 'from-lime-600/25 to-green-900/25',
			'logistics': 'from-orange-600/25 to-amber-900/25',
			'general': 'from-slate-600/25 to-gray-900/25'
		};
		return gradients[department] || 'from-slate-600/25 to-gray-900/25';
	}

	function formatDate(date: Date | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function getScoreColor(score: number | null): string {
		if (score === null) return 'color:var(--color-text-muted)';
		if (score >= 7) return 'color:#18EAB0';
		if (score >= 4) return 'color:#FAB93A';
		return 'color:#FF5C6B';
	}

	function getScoreWidth(score: number | null): string {
		if (score === null) return '0%';
		return `${(score / 10) * 100}%`;
	}

	// Parse spec document for section progress — mirrors specSections.ts logic exactly
	function getSpecProgress(specDocument: string | null | undefined, specStatus?: string): { filled: number; total: number } {
		if (!specDocument) return { filled: 0, total: 0 };
		// Extract only ## headings (not # or ###)
		const matches = specDocument.match(/^##\s+(.+)$/gm);
		if (!matches || matches.length === 0) return { filled: 0, total: 0 };
		const sections = matches.map(m => m.replace(/^##\s+/, '').trim());
		// If spec is completed, all sections count as done
		if (specStatus === 'completed') return { filled: sections.length, total: sections.length };
		let filled = 0;
		for (const section of sections) {
			const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const regex = new RegExp(`##\\s+[^\\n]*${escaped}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
			const match = specDocument.match(regex);
			if (match && match[1].trim().length > 20) filled++;
		}
		return { filled, total: sections.length };
	}

	// Department breakdown for ideas donut
	function getIdeaDeptBreakdown(): Array<{ dept: string; label: string; color: string; count: number }> {
		const counts: Record<string, number> = {};
		for (const idea of data.ideas) {
			counts[idea.department] = (counts[idea.department] ?? 0) + 1;
		}
		return Object.entries(counts)
			.map(([dept, count]) => ({
				dept,
				label: DEPARTMENT_LABELS[dept as DepartmentCategory]?.split(' ')[0] ?? dept,
				color: DEPARTMENT_COLORS[dept as DepartmentCategory] ?? '#6B7280',
				count: count as number
			}))
			.sort((a, b) => b.count - a.count);
	}

	// SVG arc path for donut chart
	function polarToXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
		const rad = (angleDeg - 90) * (Math.PI / 180);
		return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
	}

	function donutSlice(cx: number, cy: number, r: number, innerR: number, startDeg: number, endDeg: number): string {
		const [sx, sy] = polarToXY(cx, cy, r, startDeg);
		const [ex, ey] = polarToXY(cx, cy, r, endDeg);
		const [six, siy] = polarToXY(cx, cy, innerR, startDeg);
		const [eix, eiy] = polarToXY(cx, cy, innerR, endDeg);
		const large = endDeg - startDeg > 180 ? 1 : 0;
		return [
			`M ${sx} ${sy}`,
			`A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`,
			`L ${eix} ${eiy}`,
			`A ${innerR} ${innerR} 0 ${large} 0 ${six} ${siy}`,
			'Z'
		].join(' ');
	}

	const ideaDepts = $derived(getIdeaDeptBreakdown());
	const totalIdeasForDonut = $derived(ideaDepts.reduce((a, b) => a + b.count, 0));

	// Dev pipeline counts
	const devInProgress = $derived((data.devIdeas ?? []).filter((d: any) => d.specStatus === 'in_progress').length);
	const devUnderReview = $derived((data.devIdeas ?? []).filter((d: any) => d.specStatus === 'completed' && !d.workspaceUuid).length);
	const devBuilding = $derived((data.devIdeas ?? []).filter((d: any) => d.workspaceUuid && d.specStatus === 'completed').length);

	// Category colors map (reused inline)
	const CAT_COLORS: Record<string, string> = {
		'ai-ml': '#A78BFA', 'devops': '#22D3EE', 'security': '#F87171',
		'data-analytics': '#FFC842', 'developer-tools': '#34D399',
		'automation': '#F472B6', 'collaboration': '#818CF8', 'infrastructure': '#A3E635'
	};
</script>

<svelte:head>
	<title>Dashboard — Innovation Portal</title>
</svelte:head>

<div class="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-10">

	<!-- Hero Header -->
	<section style="margin-bottom: 2rem;">
		<div style="display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:1.5rem;">
			<div>
				<div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
					<div style="width:28px; height:2px; background:linear-gradient(90deg,#00E5B8,transparent); border-radius:1px;"></div>
					<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#00E5B8;">Innovation Portal</span>
				</div>
				<h1 style="font-family:var(--font-display); font-size:clamp(2.25rem,3.5vw,3.25rem); font-weight:800; letter-spacing:-0.03em; color:var(--color-text-primary); line-height:1; margin-bottom:0.625rem;">
					Overview
				</h1>
				<p style="font-size:1.0625rem; color:var(--color-text-secondary); max-width:52rem; line-height:1.6;">
					At-a-glance view of your innovation pipeline — from discovery to deployment.
				</p>
			</div>

			<!-- Department filter selector -->
			<div style="flex-shrink:0;">
				<form method="POST" action="?/setDepartment" style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
					<span style="font-family:var(--font-display); font-size:0.6875rem; font-weight:700; letter-spacing:0.10em; text-transform:uppercase; color:var(--color-text-muted);">Filter by Department</span>
					<div style="display:flex; flex-wrap:wrap; gap:0.375rem; justify-content:flex-end; max-width:520px;">
						<!-- "All" pill -->
						<button type="submit" name="dept" value=""
							style="
								padding:0.3125rem 0.75rem;
								border-radius:9999px;
								font-family:var(--font-display);
								font-size:0.75rem;
								font-weight:700;
								letter-spacing:0.04em;
								cursor:pointer;
								transition:all 0.15s ease;
								border: 1px solid {data.activeDept === null ? 'rgba(0,229,184,0.6)' : 'rgba(255,255,255,0.12)'};
								background: {data.activeDept === null ? 'rgba(0,229,184,0.15)' : 'rgba(255,255,255,0.04)'};
								color: {data.activeDept === null ? '#00E5B8' : 'var(--color-text-secondary)'};
							">All</button>
						<!-- Per-department pills -->
						{#each deptEntries as [key, label]}
							{@const deptColor = DEPARTMENT_COLORS[key]}
							{@const isActive = data.activeDept === key}
							<button type="submit" name="dept" value={key}
								style="
									padding:0.3125rem 0.75rem;
									border-radius:9999px;
									font-family:var(--font-display);
									font-size:0.75rem;
									font-weight:700;
									letter-spacing:0.04em;
									cursor:pointer;
									transition:all 0.15s ease;
									border: 1px solid {isActive ? deptColor + 'AA' : 'rgba(255,255,255,0.10)'};
									background: {isActive ? deptColor + '22' : 'rgba(255,255,255,0.03)'};
									color: {isActive ? deptColor : 'var(--color-text-secondary)'};
									white-space:nowrap;
								"
								title={label}
							>{label.split(' ')[0]}</button>
						{/each}
					</div>
				</form>
			</div>
		</div>
		{#if data.activeDept !== null}
			<div style="margin-top:0.75rem; display:flex; align-items:center; gap:0.5rem;">
				<svg style="width:14px; height:14px; color:{DEPARTMENT_COLORS[data.activeDept]}; flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/>
				</svg>
				<span style="font-size:0.8125rem; color:var(--color-text-muted);">
					Showing content for <strong style="color:{DEPARTMENT_COLORS[data.activeDept]};">{DEPARTMENT_LABELS[data.activeDept]}</strong>
				</span>
			</div>
		{/if}
	</section>

	<!-- ═══════════════════════════════════════════════════════════════
	     PIPELINE STAT STRIP
	     ═══════════════════════════════════════════════════════════════ -->
	<div style="display:flex; align-items:stretch; gap:0; margin-bottom:1.75rem; overflow-x:auto; padding-bottom:0.5rem;">

		{#snippet statTile(href: string, label: string, count: number | string, color: string, borderColor: string, bgColor: string)}
			<a {href} style="text-decoration:none; flex-shrink:0;">
				<div style="
					display:flex; flex-direction:column; justify-content:center;
					padding:0.875rem 1.5rem;
					border-radius:12px;
					background:{bgColor};
					border:1px solid {borderColor};
					height:100%;
					min-width:130px;
					transition:background 0.15s ease, border-color 0.15s ease;
				"
				onmouseenter={(e)=>{ const el=e.currentTarget as HTMLElement; el.style.background=bgColor.replace('0.08','0.15'); el.style.borderColor=borderColor.replace('0.25','0.5'); }}
				onmouseleave={(e)=>{ const el=e.currentTarget as HTMLElement; el.style.background=bgColor; el.style.borderColor=borderColor; }}
				role="presentation">
					<!-- Label row -->
					<div style="font-family:var(--font-display); font-size:0.6875rem; font-weight:700; letter-spacing:0.10em; text-transform:uppercase; color:{color}; opacity:0.75; margin-bottom:0.5rem; white-space:nowrap;">{label}</div>
					<!-- Count badge -->
					<div style="
						display:inline-flex; align-items:center; justify-content:center;
						font-family:var(--font-display); font-size:1.5rem; font-weight:800;
						color:{color};
						line-height:1;
					">{count}</div>
				</div>
			</a>
		{/snippet}

		<!-- Innovations -->
		{@render statTile(`${base}/innovations`, 'Innovations', data.innovationsCount, '#00E5B8', 'rgba(0,229,184,0.25)', 'rgba(0,229,184,0.08)')}

		<!-- Arrow -->
		<div style="display:flex; align-items:center; padding:0 0.5rem; flex-shrink:0; color:var(--color-border);">
			<svg style="width:18px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 18 12">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M1 6h13m-4-4 4 4-4 4"/>
			</svg>
		</div>

		<!-- Catalog -->
		{@render statTile(`${base}/catalog`, 'Catalog', data.catalogItems.length, '#3EEAA8', 'rgba(62,234,168,0.25)', 'rgba(62,234,168,0.08)')}

		<!-- Separator -->
		<div style="display:flex; align-items:center; margin:0 1rem; flex-shrink:0;">
			<div style="width:1px; height:40px; background:var(--color-border);"></div>
		</div>

		<!-- Ideas -->
		{@render statTile(`${base}/ideas`, 'Ideas', data.ideas.length, '#FFC842', 'rgba(255,200,66,0.25)', 'rgba(255,200,66,0.08)')}

		<!-- Arrow -->
		<div style="display:flex; align-items:center; padding:0 0.5rem; flex-shrink:0; color:var(--color-border);">
			<svg style="width:18px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 18 12">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M1 6h13m-4-4 4 4-4 4"/>
			</svg>
		</div>

		<!-- Development -->
		{@render statTile(`${base}/development`, 'Development', (data.devIdeas ?? []).length, '#A78BFA', 'rgba(167,139,250,0.25)', 'rgba(167,139,250,0.08)')}

		<!-- Separator -->
		<div style="display:flex; align-items:center; margin:0 1rem; flex-shrink:0;">
			<div style="width:1px; height:40px; background:var(--color-border);"></div>
		</div>

		<!-- News -->
		{@render statTile(`${base}/news`, 'News', data.news.length, '#93D9FF', 'rgba(147,217,255,0.25)', 'rgba(147,217,255,0.08)')}

	</div>

	<!-- ═══════════════════════════════════════════════════════════════
	     TWO-ZONE LAYOUT: Discovery Pipeline | Idea Pipeline
	     ═══════════════════════════════════════════════════════════════ -->
	<div class="grid lg:grid-cols-2 gap-8" style="margin-bottom:2rem;">

		<!-- ╔══════════════════════════════════╗
		     ║  ZONE A: Innovations + Catalog   ║
		     ╚══════════════════════════════════╝ -->
		<div style="
			background: rgba(0,229,184,0.025);
			border: 1px solid rgba(0,229,184,0.15);
			border-radius: 22px;
			padding: 1.75rem;
			display: flex;
			flex-direction: column;
			gap: 1.5rem;
		">
			<!-- Zone A label -->
			<div style="display:flex; align-items:center; gap:0.75rem;">
				<div style="width:3px; height:22px; background:linear-gradient(180deg,#00E5B8,#3EEAA8); border-radius:2px;"></div>
				<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#00E5B8;">Discovery Pipeline</span>
			</div>

			<!-- Mini Radar + Category Bars — side by side -->
			<div class="grid sm:grid-cols-2 gap-5">
				<!-- Mini Radar -->
				<div style="
					background:rgba(23,32,48,0.88);
					border:1px solid rgba(184,160,255,0.22);
					border-radius:16px;
					padding:1.25rem;
					display:flex;
					flex-direction:column;
					gap:0.75rem;
				">
					<div style="display:flex; align-items:center; justify-content:space-between;">
						<div style="display:flex; align-items:center; gap:0.5rem;">
							<svg style="width:15px; height:15px; color:#B8A0FF;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#B8A0FF;">Innovation Radar</span>
						</div>
						<a href="{base}/innovations" style="font-family:var(--font-display); font-size:0.75rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#B8A0FF; text-decoration:none; opacity:0.7; display:flex; align-items:center; gap:0.25rem; transition:opacity 0.15s;"
							onmouseenter={(e)=>(e.currentTarget as HTMLElement).style.opacity='1'}
							onmouseleave={(e)=>(e.currentTarget as HTMLElement).style.opacity='0.7'}>
							Browse all →
						</a>
					</div>
					<p style="font-size:0.8125rem; color:var(--color-text-muted); line-height:1.5;">
						{Object.values(data.innovationDeptCounts).reduce((a: number, b) => a + (b as number), 0)} innovations tracked across {Object.keys(data.innovationDeptCounts).length} departments
					</p>
					<!-- Radar -->
					<div style="height:240px; position:relative; overflow:hidden; border-radius:12px;">
						<RadarVisualization innovations={data.innovations} compact={true} />
					</div>
				</div>

				<!-- Category Bars -->
				<div style="
					background:rgba(23,32,48,0.88);
					border:1px solid var(--color-border);
					border-radius:16px;
					padding:1.25rem;
					display:flex;
					flex-direction:column;
					gap:0.75rem;
				">
					<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--color-text-muted);">Innovations by Department</span>
					<div style="display:flex; flex-direction:column; gap:0.6rem;">
						{#each deptEntries.filter(([dept]) => (data.innovationDeptCounts[dept] ?? 0) > 0).sort(([a],[b]) => (data.innovationDeptCounts[b] ?? 0) - (data.innovationDeptCounts[a] ?? 0)) as [dept, label]}
							{@const count = data.innovationDeptCounts[dept] ?? 0}
							{@const maxCount = Math.max(...Object.values(data.innovationDeptCounts) as number[])}
							{@const color = DEPARTMENT_COLORS[dept as DepartmentCategory] ?? '#6B7280'}
							<a href="{base}/innovations?department={dept}" style="text-decoration:none; display:block;">
								<div style="display:flex; align-items:center; gap:0.625rem;">
									<span style="font-size:0.75rem; color:var(--color-text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:80px; flex-shrink:0;">{label.split(' ')[0]}</span>
									<div style="flex:1; height:6px; background:rgba(255,255,255,0.06); border-radius:99px; overflow:hidden;">
										<div style="height:100%; border-radius:99px; background:{color}; width:{(count/maxCount)*100}%; opacity:0.85; transition:width 0.4s ease;"></div>
									</div>
									<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; color:{color}; width:18px; text-align:right; flex-shrink:0;">{count}</span>
								</div>
							</a>
						{/each}
					</div>
					<a href="{base}/innovations" style="font-family:var(--font-display); font-size:0.8125rem; font-weight:600; color:#00E5B8; text-decoration:none; display:flex; align-items:center; gap:0.25rem; margin-top:0.25rem;"
						onmouseenter={(e)=>(e.currentTarget as HTMLElement).style.opacity='0.8'}
						onmouseleave={(e)=>(e.currentTarget as HTMLElement).style.opacity='1'}>
						View all {data.innovationsCount} innovations →
					</a>
				</div>
			</div>

			<!-- Top Innovations compact list -->
			{#if data.innovations.length > 0}
				<div style="display:flex; flex-direction:column; gap:0.625rem;">
					<div style="display:flex; align-items:center; justify-content:space-between;">
						<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--color-text-muted);">Top Innovations</span>
						<a href="{base}/innovations" style="font-family:var(--font-display); font-size:0.75rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#00E5B8; text-decoration:none; display:flex; align-items:center; gap:0.25rem; opacity:0.7; transition:opacity 0.15s;"
							onmouseenter={(e)=>(e.currentTarget as HTMLElement).style.opacity='1'}
							onmouseleave={(e)=>(e.currentTarget as HTMLElement).style.opacity='0.7'}>
							View all →
						</a>
					</div>
					{#each data.innovations.slice(0, 3) as innovation (innovation.id)}
						{@const color = CAT_COLORS[innovation.category] ?? '#6B7280'}
						<a href="{base}/innovations/{innovation.slug}" style="text-decoration:none; display:block;">
							<div style="
								background:rgba(23,32,48,0.88);
								border:1px solid var(--color-border);
								border-radius:12px;
								padding:0.875rem 1.125rem;
								display:flex;
								align-items:center;
								gap:0.875rem;
								transition:border-color 0.2s ease, transform 0.2s ease;
							"
							onmouseenter={(e)=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor=color+'55'; el.style.transform='translateX(3px)'; }}
							onmouseleave={(e)=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor='var(--color-border)'; el.style.transform='none'; }}
							role="presentation">
								<div style="width:10px; height:10px; border-radius:50%; background:{color}; flex-shrink:0; box-shadow:0 0 10px {color}66;"></div>
								<div style="flex:1; min-width:0;">
									<div style="font-family:var(--font-display); font-size:0.9375rem; font-weight:700; color:var(--color-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{innovation.title}</div>
									<div style="font-size:0.8125rem; color:var(--color-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:0.125rem;">{innovation.tagline}</div>
								</div>
								<div style="display:flex; align-items:center; gap:1rem; flex-shrink:0;">
									{#if innovation.relevanceScore !== null}
										<div style="text-align:center;">
											<div style="font-family:var(--font-display); font-size:0.875rem; font-weight:800; {getScoreColor(innovation.relevanceScore)}; line-height:1;">{innovation.relevanceScore.toFixed(0)}</div>
											<div style="font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-top:0.1rem;">rel</div>
										</div>
									{/if}
									<div style="display:flex; align-items:center; gap:0.3rem; color:var(--color-text-muted);">
										<svg style="width:13px; height:13px;" fill="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7H5z"/></svg>
										<span style="font-family:var(--font-display); font-size:0.875rem; font-weight:700; color:var(--color-text-secondary);">{innovation.voteCount}</span>
									</div>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}

			<!-- Flow connector: Innovations → Catalog -->
			<div style="display:flex; align-items:center; gap:0.75rem; padding:0.25rem 0;">
				<div style="flex:1; height:1px; background:linear-gradient(90deg, rgba(0,229,184,0.35), transparent);"></div>
				<div style="display:flex; align-items:center; gap:0.5rem; padding:0.4rem 1rem; border-radius:99px; background:rgba(62,234,168,0.08); border:1px solid rgba(62,234,168,0.22);">
					<svg style="width:13px; height:13px; color:#3EEAA8;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
					<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#3EEAA8;">Promoted to Catalog</span>
				</div>
				<div style="flex:1; height:1px; background:linear-gradient(90deg, transparent, rgba(62,234,168,0.35));"></div>
			</div>

			<!-- Catalog strip -->
			<div style="background:rgba(23,32,48,0.88); border:1px solid rgba(62,234,168,0.2); border-radius:16px; padding:1.25rem;">
				<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem;">
					<div style="display:flex; align-items:center; gap:0.625rem;">
						<svg style="width:15px; height:15px; color:#3EEAA8;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
						</svg>
						<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#3EEAA8;">Ready to Use — Catalog</span>
					</div>
					<a href="{base}/catalog" style="font-family:var(--font-display); font-size:0.75rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#3EEAA8; text-decoration:none; opacity:0.7; transition:opacity 0.15s;"
						onmouseenter={(e)=>(e.currentTarget as HTMLElement).style.opacity='1'}
						onmouseleave={(e)=>(e.currentTarget as HTMLElement).style.opacity='0.7'}>
						View all →
					</a>
				</div>
				{#if data.catalogItems && data.catalogItems.length > 0}
					<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:0.625rem;">
						{#each data.catalogItems.slice(0, 4) as item (item.id)}
							<a href="{base}/catalog/{item.slug}" style="text-decoration:none;">
								<div style="
									border:1px solid rgba(62,234,168,0.15);
									border-radius:12px;
									padding:0.75rem 0.875rem;
									display:flex;
									align-items:center;
									gap:0.625rem;
									transition:border-color 0.2s ease, background 0.2s ease;
								"
								onmouseenter={(e)=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor='rgba(62,234,168,0.4)'; el.style.background='rgba(62,234,168,0.06)'; }}
								onmouseleave={(e)=>{ const el=e.currentTarget as HTMLElement; el.style.borderColor='rgba(62,234,168,0.15)'; el.style.background='transparent'; }}
								role="presentation">
									{#if item.iconUrl}
										<img src={item.iconUrl} alt={item.name} style="width:32px; height:32px; border-radius:7px; object-fit:cover; flex-shrink:0;" />
									{:else}
										<div style="width:32px; height:32px; border-radius:7px; background:rgba(62,234,168,0.14); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
											<svg style="width:16px; height:16px; color:#3EEAA8;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
										</div>
									{/if}
									<div style="min-width:0;">
										<div style="font-family:var(--font-display); font-size:0.875rem; font-weight:700; color:var(--color-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{item.name}</div>
										<div style="display:flex; align-items:center; gap:0.3rem; margin-top:0.2rem;">
											<span style="width:6px; height:6px; border-radius:50%; background:#3EEAA8; display:block;"></span>
											<span style="font-size:0.75rem; color:#3EEAA8; font-weight:600;">Active</span>
										</div>
									</div>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<p style="font-size:0.9375rem; color:var(--color-text-muted); text-align:center; padding:1.25rem 0;">No items in catalog yet.</p>
				{/if}
			</div>
		</div>

		<!-- ╔══════════════════════════════════════╗
		     ║  ZONE B: Ideas + Development         ║
		     ╚══════════════════════════════════════╝ -->
		<div style="
			background: rgba(255,200,66,0.02);
			border: 1px solid rgba(255,200,66,0.13);
			border-radius: 22px;
			padding: 1.75rem;
			display: flex;
			flex-direction: column;
			gap: 1.5rem;
		">
			<!-- Zone B label -->
			<div style="display:flex; align-items:center; gap:0.75rem;">
				<div style="width:3px; height:22px; background:linear-gradient(180deg,#FFC842,#A78BFA); border-radius:2px;"></div>
				<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#FFC842;">Idea Pipeline</span>
			</div>

			<!-- Ideas ranked list + Department donut -->
			<div class="grid sm:grid-cols-2 gap-5">
				<!-- Top Ideas -->
				<div style="
					background:rgba(23,32,48,0.88);
					border:1px solid rgba(255,200,66,0.2);
					border-radius:16px;
					padding:1.25rem;
					display:flex;
					flex-direction:column;
					gap:0.75rem;
				">
					<div style="display:flex; align-items:center; justify-content:space-between;">
						<div style="display:flex; align-items:center; gap:0.5rem;">
							<svg style="width:15px; height:15px; color:#FFC842;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
							</svg>
							<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#FFC842;">Top Ideas</span>
						</div>
						<a href="{base}/ideas" style="font-family:var(--font-display); font-size:0.75rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#FFC842; text-decoration:none; opacity:0.7; transition:opacity 0.15s;"
							onmouseenter={(e)=>(e.currentTarget as HTMLElement).style.opacity='1'}
							onmouseleave={(e)=>(e.currentTarget as HTMLElement).style.opacity='0.7'}>
							All ideas →
						</a>
					</div>

					{#if data.ideas.length > 0}
						<div style="display:flex; flex-direction:column; gap:0.5rem;">
							{#each data.ideas.slice(0, 4) as idea, i (idea.id)}
								{@const deptColor = DEPARTMENT_COLORS[idea.department as DepartmentCategory] ?? '#6B7280'}
								<a href="{base}/ideas/{idea.slug}" style="text-decoration:none;">
									<div style="
										border-radius:10px;
										border:1px solid rgba(255,255,255,0.07);
										padding:0.625rem 0.75rem;
										display:flex;
										align-items:center;
										gap:0.625rem;
										transition:border-color 0.2s ease, background 0.2s ease;
									"
									onmouseenter={(e)=>{const el=e.currentTarget as HTMLElement; el.style.borderColor=deptColor+'55'; el.style.background='rgba(255,255,255,0.03)';}}
									onmouseleave={(e)=>{const el=e.currentTarget as HTMLElement; el.style.borderColor='rgba(255,255,255,0.07)'; el.style.background='transparent';}}
									role="presentation">
										<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:800; color:rgba(255,255,255,0.22); width:18px; text-align:center; flex-shrink:0;">#{i+1}</span>
										<div style="width:3px; height:32px; border-radius:2px; background:{deptColor}; flex-shrink:0;"></div>
										<div style="flex:1; min-width:0;">
											<div style="font-family:var(--font-display); font-size:0.875rem; font-weight:700; color:var(--color-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{idea.title}</div>
											<div style="font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.04em; margin-top:0.1rem;">{DEPARTMENT_LABELS[idea.department as DepartmentCategory]?.split('/')[0]?.split('&')[0]?.trim() ?? idea.department}</div>
										</div>
										{#if idea.evaluationScore !== null}
											<div style="text-align:right; flex-shrink:0;">
												<div style="font-family:var(--font-display); font-size:0.875rem; font-weight:800; color:#FFC842;">{idea.evaluationScore.toFixed(1)}</div>
												<div style="font-size:0.75rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.04em;">score</div>
											</div>
										{/if}
									</div>
								</a>
							{/each}
						</div>
					{:else}
						<p style="font-size:0.9375rem; color:var(--color-text-muted); text-align:center; padding:2rem 0;">No ideas yet.</p>
					{/if}
				</div>

				<!-- Department donut -->
				<div style="
					background:rgba(23,32,48,0.88);
					border:1px solid var(--color-border);
					border-radius:16px;
					padding:1.25rem;
					display:flex;
					flex-direction:column;
					gap:0.875rem;
				">
					<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--color-text-muted);">Ideas by Department</span>

					{#if ideaDepts.length > 0}
						<div style="display:flex; align-items:center; gap:1.25rem;">
							<!-- Donut SVG — larger -->
							<div style="flex-shrink:0;">
								<svg width="100" height="100" viewBox="0 0 100 100">
									{#each ideaDepts as dept, idx}
										{@const startAngle = ideaDepts.slice(0, idx).reduce((a, d) => a + (d.count / totalIdeasForDonut) * 360, 0)}
										{@const endAngle = startAngle + (dept.count / totalIdeasForDonut) * 360}
										<path d="{donutSlice(50, 50, 44, 30, startAngle, endAngle)}" fill="{dept.color}" opacity="0.85" />
									{/each}
									<text x="50" y="55" text-anchor="middle" font-family="var(--font-display)" font-size="16" font-weight="800" fill="white">{totalIdeasForDonut}</text>
								</svg>
							</div>
							<!-- Legend -->
							<div style="display:flex; flex-direction:column; gap:0.4rem; flex:1;">
								{#each ideaDepts.slice(0, 6) as dept}
									<div style="display:flex; align-items:center; gap:0.5rem;">
										<div style="width:8px; height:8px; border-radius:50%; background:{dept.color}; flex-shrink:0;"></div>
										<span style="font-size:0.8125rem; color:var(--color-text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">{dept.label}</span>
										<span style="font-family:var(--font-display); font-size:0.875rem; font-weight:700; color:{dept.color}; flex-shrink:0;">{dept.count}</span>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<p style="font-size:0.9375rem; color:var(--color-text-muted); text-align:center; padding:1.5rem 0;">No ideas yet.</p>
					{/if}

					<a href="{base}/propose" style="
						display:flex; align-items:center; justify-content:center; gap:0.5rem;
						margin-top:auto;
						padding:0.625rem;
						border-radius:10px;
						border:1px dashed rgba(255,200,66,0.35);
						font-family:var(--font-display); font-size:0.8125rem; font-weight:700;
						letter-spacing:0.04em; text-transform:uppercase;
						color:#FFC842; text-decoration:none;
						transition:opacity 0.15s ease, border-color 0.15s ease;
					"
					onmouseenter={(e)=>{const el=e.currentTarget as HTMLElement; el.style.borderColor='rgba(255,200,66,0.6)'; el.style.background='rgba(255,200,66,0.05)';}}
					onmouseleave={(e)=>{const el=e.currentTarget as HTMLElement; el.style.borderColor='rgba(255,200,66,0.35)'; el.style.background='transparent';}}>
						<svg style="width:14px; height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
						Propose an idea
					</a>
				</div>
			</div>

			<!-- Flow connector: Ideas → Development -->
			<div style="display:flex; align-items:center; gap:0.75rem; padding:0.25rem 0;">
				<div style="flex:1; height:1px; background:linear-gradient(90deg, rgba(255,200,66,0.35), transparent);"></div>
				<div style="display:flex; align-items:center; gap:0.5rem; padding:0.4rem 1rem; border-radius:99px; background:rgba(167,139,250,0.08); border:1px solid rgba(167,139,250,0.22);">
					<svg style="width:13px; height:13px; color:#A78BFA;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
					<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#A78BFA;">Graduated to Development</span>
				</div>
				<div style="flex:1; height:1px; background:linear-gradient(90deg, transparent, rgba(167,139,250,0.35));"></div>
			</div>

			<!-- Development panel -->
			<div style="background:rgba(23,32,48,0.88); border:1px solid rgba(167,139,250,0.22); border-radius:16px; padding:1.25rem;">
				<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
					<div style="display:flex; align-items:center; gap:0.625rem;">
						<svg style="width:15px; height:15px; color:#A78BFA;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
						</svg>
						<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#A78BFA;">In Development</span>
					</div>
					<div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
						<span style="display:flex; align-items:center; gap:0.375rem; padding:0.25rem 0.625rem; border-radius:99px; background:rgba(167,139,250,0.15); border:1px solid rgba(167,139,250,0.3); font-family:var(--font-display); font-size:0.6875rem; font-weight:700; color:#A78BFA;">
							{devInProgress} in progress
						</span>
						<span style="padding:0.25rem 0.625rem; border-radius:99px; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.28); font-family:var(--font-display); font-size:0.6875rem; font-weight:700; color:#8B5CF6;">
							{devUnderReview} review
						</span>
						{#if devBuilding > 0}
							<span style="padding:0.25rem 0.625rem; border-radius:99px; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.28); font-family:var(--font-display); font-size:0.6875rem; font-weight:700; color:#38BDF8;">
								{devBuilding} building
							</span>
						{/if}
					</div>
				</div>

				{#if (data.devIdeas ?? []).length > 0}
					<div style="display:flex; flex-direction:column; gap:0.625rem;">
						{#each (data.devIdeas ?? []).slice(0, 4) as idea (idea.id)}
							{@const deptColor = DEPARTMENT_COLORS[idea.department as DepartmentCategory] ?? '#6B7280'}
							{@const progress = getSpecProgress(idea.specDocument, idea.specStatus)}
							{@const isReview = idea.specStatus === 'completed'}
							{@const hasWorkspace = !!(idea as any).workspaceUuid}
							<a href="{base}/development/{idea.slug}" style="text-decoration:none;">
								<div style="
									border:1px solid rgba(167,139,250,0.16);
									border-radius:12px;
									padding:0.75rem 0.875rem;
									transition:border-color 0.2s ease, background 0.2s ease;
								"
								onmouseenter={(e)=>{const el=e.currentTarget as HTMLElement; el.style.borderColor='rgba(167,139,250,0.42)'; el.style.background='rgba(167,139,250,0.04)';}}
								onmouseleave={(e)=>{const el=e.currentTarget as HTMLElement; el.style.borderColor='rgba(167,139,250,0.16)'; el.style.background='transparent';}}
								role="presentation">
								<div style="display:flex; align-items:center; gap:0.625rem; margin-bottom:0.5rem;">
									{#if hasWorkspace}
										<span style="padding:0.15rem 0.5rem; border-radius:5px; background:rgba(52,211,153,0.15); border:1px solid rgba(52,211,153,0.3); font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#34D399; flex-shrink:0;">Building</span>
									{:else if isReview}
										<span style="padding:0.15rem 0.5rem; border-radius:5px; background:rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#8B5CF6; flex-shrink:0;">Review</span>
									{:else}
										<span style="padding:0.15rem 0.5rem; border-radius:5px; background:rgba(167,139,250,0.15); border:1px solid rgba(167,139,250,0.3); font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:#A78BFA; flex-shrink:0;">In Progress</span>
									{/if}
										<div style="width:6px; height:6px; border-radius:50%; background:{deptColor}; flex-shrink:0;"></div>
										<span style="font-family:var(--font-display); font-size:0.9375rem; font-weight:700; color:var(--color-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">{idea.title}</span>
									</div>
									{#if progress.total > 0}
										<div style="display:flex; align-items:center; gap:0.625rem;">
											<div style="flex:1; height:5px; background:rgba(255,255,255,0.08); border-radius:99px; overflow:hidden;">
												<div style="height:100%; border-radius:99px; width:{(progress.filled / progress.total) * 100}%; background:{isReview ? 'linear-gradient(90deg,#34D399,#10B981)' : 'linear-gradient(90deg,#A78BFA,#818CF8)'}; transition:width 0.4s ease;"></div>
											</div>
											<span style="font-family:var(--font-display); font-size:0.8125rem; font-weight:700; color:{isReview ? '#34D399' : '#A78BFA'}; flex-shrink:0; min-width:40px; text-align:right;">{progress.filled}/{progress.total} sections</span>
										</div>
									{:else}
										<div style="height:5px; background:rgba(255,255,255,0.06); border-radius:99px;"></div>
									{/if}
								</div>
							</a>
						{/each}
					</div>
					<a href="{base}/development" style="display:flex; align-items:center; justify-content:flex-end; gap:0.25rem; margin-top:0.875rem; font-family:var(--font-display); font-size:0.75rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#A78BFA; text-decoration:none; opacity:0.7; transition:opacity 0.15s;"
						onmouseenter={(e)=>(e.currentTarget as HTMLElement).style.opacity='1'}
						onmouseleave={(e)=>(e.currentTarget as HTMLElement).style.opacity='0.7'}>
						View all in development →
					</a>
				{:else}
					<div style="text-align:center; padding:1.75rem 0;">
						<svg style="width:36px; height:36px; color:rgba(167,139,250,0.3); margin:0 auto 0.625rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
						<p style="font-size:0.9375rem; color:var(--color-text-muted);">No ideas in development yet.</p>
						<p style="font-size:0.875rem; color:var(--color-text-muted); margin-top:0.375rem; opacity:0.6;">Ideas that reach the vote threshold will appear here.</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- ═══════════════════════════════════════════════════════════════
	     ZONE C: NEWS (full width, distinct)
	     ═══════════════════════════════════════════════════════════════ -->
	<section style="
		background: rgba(147,217,255,0.02);
		border: 1px solid rgba(147,217,255,0.13);
		border-radius: 22px;
		padding: 1.75rem;
		margin-bottom: 1rem;
	">
		<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem;">
			<div style="display:flex; align-items:center; gap:0.75rem;">
				<div style="width:3px; height:22px; background:#93D9FF; border-radius:2px;"></div>
				<svg style="width:15px; height:15px; color:#93D9FF;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
				</svg>
				<span style="font-family:var(--font-display); font-size:0.75rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#93D9FF;">Industry Intelligence — News</span>
			</div>
			<a href="{base}/news" style="font-family:var(--font-display); font-size:0.75rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#93D9FF; text-decoration:none; opacity:0.7; transition:opacity 0.15s;"
				onmouseenter={(e)=>(e.currentTarget as HTMLElement).style.opacity='1'}
				onmouseleave={(e)=>(e.currentTarget as HTMLElement).style.opacity='0.7'}>
				View all →
			</a>
		</div>

		{#if data.news.length > 0}
			<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
				{#each data.news as item (item.id)}
					{@const deptColor = DEPARTMENT_COLORS[item.category as DepartmentCategory] ?? '#6B7280'}
					<a href="{base}/news/{item.slug}" class="group block animate-fade-in" style="text-decoration:none;">
						<div
						role="presentation"
						style="
							background: rgba(23, 32, 48, 0.88);
							border: 1px solid var(--color-border);
							border-radius: 14px;
							overflow: hidden;
							height:100%;
							display:flex;
							flex-direction:column;
							transition: border-color 0.2s ease, transform 0.2s ease;
						"
						onmouseenter={(e) => {
							const el = e.currentTarget as HTMLElement;
							el.style.borderColor = deptColor + '55';
							el.style.transform = 'translateY(-3px)';
						}}
						onmouseleave={(e) => {
							const el = e.currentTarget as HTMLElement;
							el.style.borderColor = 'var(--color-border)';
							el.style.transform = 'translateY(0)';
						}}
						>
							<div style="height:3px; background:linear-gradient(90deg, {deptColor}AA, transparent); flex-shrink:0;"></div>
							<div style="padding:1rem 1.125rem; flex:1; display:flex; flex-direction:column;">
								<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:0.625rem; margin-bottom:0.625rem;">
									<span style="
										display:inline-flex; align-items:center;
										border-radius:5px; border:1px solid;
										font-family:var(--font-display); font-weight:600;
										font-size:0.75rem; letter-spacing:0.05em; text-transform:uppercase;
										padding:0.175rem 0.5rem; flex-shrink:0;
										background:{deptColor}28; color:{deptColor}; border-color:{deptColor}55;
									">
										{DEPARTMENT_LABELS[item.category as DepartmentCategory]?.split('/')[0]?.trim() ?? item.category}
									</span>
									{#if item.publishedAt}
										<span style="font-size:0.8125rem; color:var(--color-text-muted); flex-shrink:0; white-space:nowrap;">{formatDate(item.publishedAt)}</span>
									{/if}
								</div>
								<h3 style="
									font-family:var(--font-display); font-size:1rem; font-weight:700;
									color:var(--color-text-primary);
									display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
									margin-bottom:0.5rem; letter-spacing:-0.01em; line-height:1.4;
									transition:color 0.15s ease; flex:1;
								" class="group-hover:!text-sky-300">
									{item.title}
								</h3>
								{#if item.relevanceScore !== null}
									<div style="display:flex; align-items:center; gap:0.625rem; margin-top:auto; padding-top:0.625rem;">
										<div style="flex:1; height:4px; background:rgba(255,255,255,0.10); border-radius:99px; overflow:hidden;">
											<div style="height:100%; border-radius:99px; width:{getScoreWidth(item.relevanceScore)}; background:linear-gradient(90deg, #3B9EFF, #818CF8);"></div>
										</div>
										<span style="font-size:0.8125rem; font-family:var(--font-display); font-weight:700; {getScoreColor(item.relevanceScore)}; font-variant-numeric:tabular-nums; flex-shrink:0;">
											{item.relevanceScore}/10
										</span>
									</div>
								{/if}
							</div>
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<div style="text-align:center; padding:2.5rem; color:var(--color-text-muted);">
				<svg style="width:40px; height:40px; margin:0 auto 0.875rem; opacity:0.3;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>
				<p style="font-size:1rem;">No news published yet.</p>
			</div>
		{/if}
	</section>

</div>
