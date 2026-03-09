<svelte:head>
	<title>About - Innovation Portal</title>
	<meta name="description" content="How the Innovation Portal fits into the AI-driven innovation lifecycle — from raw ideas to deployed solutions." />
</svelte:head>

<style>
	/* ── Keyframe library ── */
	@keyframes fadeUp {
		from { opacity: 0; transform: translateY(28px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to   { opacity: 1; }
	}
	@keyframes slideRight {
		from { opacity: 0; transform: translateX(-20px); }
		to   { opacity: 1; transform: translateX(0); }
	}
	@keyframes pulse-ring {
		0%   { transform: scale(1);    opacity: 0.6; }
		50%  { transform: scale(1.18); opacity: 0.2; }
		100% { transform: scale(1);    opacity: 0.6; }
	}
	@keyframes flow {
		0%   { stroke-dashoffset: 400; opacity: 0.3; }
		50%  { opacity: 1; }
		100% { stroke-dashoffset: 0;   opacity: 0.3; }
	}
	@keyframes orbit {
		from { transform: rotate(0deg)   translateX(54px) rotate(0deg);   }
		to   { transform: rotate(360deg) translateX(54px) rotate(-360deg); }
	}
	@keyframes blink-dot {
		0%, 100% { opacity: 1; }
		50%       { opacity: 0.2; }
	}
	@keyframes glow-pulse {
		0%, 100% { box-shadow: 0 0 12px 2px var(--glow); }
		50%       { box-shadow: 0 0 28px 6px var(--glow); }
	}
	@keyframes connector-flow {
		0%   { stroke-dashoffset: 120; }
		100% { stroke-dashoffset: 0; }
	}
	@keyframes float {
		0%, 100% { transform: translateY(0); }
		50%       { transform: translateY(-6px); }
	}
	@keyframes spin-slow {
		from { transform: rotate(0deg); }
		to   { transform: rotate(360deg); }
	}
	@keyframes counter-spin {
		from { transform: rotate(0deg); }
		to   { transform: rotate(-360deg); }
	}
	@keyframes scale-in {
		from { transform: scale(0.8); opacity: 0; }
		to   { transform: scale(1);   opacity: 1; }
	}

	/* ── Hero ── */
	.hero-badge {
		animation: fadeIn 0.6s ease both;
	}
	.hero-title {
		animation: fadeUp 0.7s 0.1s ease both;
	}
	.hero-sub {
		animation: fadeUp 0.7s 0.25s ease both;
	}

	/* ── Pipeline diagram ── */
	.pipeline-wrap {
		animation: fadeUp 0.8s 0.35s ease both;
	}

	/* Step cards */
	.step-card {
		transition: transform 0.25s ease, box-shadow 0.25s ease;
	}
	.step-card:hover {
		transform: translateY(-4px);
	}

	/* Animated node icon ring */
	.node-ring {
		position: absolute;
		inset: -6px;
		border-radius: 50%;
		border: 2px solid currentColor;
		animation: pulse-ring 2.4s ease-in-out infinite;
	}

	/* Flowing SVG connector */
	.connector-path {
		stroke-dasharray: 120;
		animation: connector-flow 1.8s linear infinite;
	}

	/* Phase badge pulse dot */
	.pulse-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		animation: blink-dot 1.6s ease-in-out infinite;
	}

	/* Glow on active phase cards */
	.glow-card {
		animation: glow-pulse 3s ease-in-out infinite;
	}

	/* Floating icons */
	.float-icon {
		animation: float 3.5s ease-in-out infinite;
	}

	/* Detail section stagger */
	.detail-row { animation: fadeUp 0.6s ease both; }
	.detail-row:nth-child(1) { animation-delay: 0.05s; }
	.detail-row:nth-child(2) { animation-delay: 0.15s; }
	.detail-row:nth-child(3) { animation-delay: 0.25s; }
	.detail-row:nth-child(4) { animation-delay: 0.35s; }
	.detail-row:nth-child(5) { animation-delay: 0.45s; }

	/* Orbiting particle rig */
	.orbit-rig {
		position: relative;
		width: 140px;
		height: 140px;
	}
	.orbit-particle {
		position: absolute;
		top: 50%; left: 50%;
		width: 10px; height: 10px;
		border-radius: 50%;
		margin: -5px 0 0 -5px;
	}
	.orbit-particle.p1 { animation: orbit 3.2s linear infinite; }
	.orbit-particle.p2 { animation: orbit 3.2s linear infinite; animation-delay: -1.6s; }
	.orbit-particle.p3 { animation: orbit 5s linear infinite; animation-delay: -2.5s; }

	.orbit-ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 1px dashed rgba(255,255,255,0.12);
	}
	.orbit-ring.r2 {
		inset: 20px;
		animation: spin-slow 18s linear infinite;
	}

	/* Arrow animation between phases */
	.phase-arrow {
		animation: blink-dot 1.8s ease-in-out infinite;
	}
</style>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-24">

	<!-- ════════════════════════ HERO ════════════════════════ -->
	<section class="text-center space-y-6 pt-4">
		<div class="hero-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium">
			<span class="pulse-dot bg-primary"></span>
			Innovation-to-Deployment Lifecycle
		</div>

		<h1 class="hero-title text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
			From Raw Ideas to
			<span class="gradient-text">Running Solutions</span>
		</h1>

		<p class="hero-sub max-w-2xl mx-auto text-text-secondary text-lg leading-relaxed">
			A two-phase, AI-augmented pipeline that takes an idea from its first spark —
			a news headline, a user suggestion, a model hallucination —
			all the way to a monitored, production-grade deployment on Kubernetes.
			Humans stay in control at every gate. AI does the heavy lifting in between.
		</p>
	</section>

	<!-- ════════════════════════ PIPELINE OVERVIEW ════════════════════════ -->
	<section class="pipeline-wrap">
		<h2 class="text-center text-sm font-semibold uppercase tracking-widest text-text-muted mb-10">The Full Pipeline at a Glance</h2>

		<!-- Two-phase strip -->
		<div class="grid lg:grid-cols-2 gap-6">

			<!-- Phase 1 — This App -->
			<div class="relative rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/8 to-transparent p-6 space-y-5 glow-card" style="--glow: rgba(65,148,104,0.25);">
				<!-- Phase label -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-bold uppercase tracking-widest text-primary">Phase 1</span>
					<span class="h-px flex-1 bg-primary/20"></span>
					<span class="text-xs text-primary/70 font-medium">This Application</span>
				</div>
				<h3 class="text-xl font-bold text-text-primary">Discover &amp; Evaluate</h3>
				<p class="text-text-secondary text-sm leading-relaxed">
					Continuously collects signals from news feeds, user submissions, and AI exploration.
					Filters noise, scores relevance, and surface-tests assumptions — so only validated,
					human-approved ideas move forward.
				</p>

				<!-- Mini steps 1-3 -->
				<div class="space-y-3">
					{#each [
						{ n: '1', icon: '📡', label: 'Ingest', desc: 'News, user ideas, AI suggestions' },
						{ n: '2', icon: '🤖', label: 'Analyse', desc: 'AI filters, scores &amp; researches' },
						{ n: '3', icon: '✅', label: 'Validate', desc: 'Human review gates worthy ideas' }
					] as s}
						<div class="step-card flex items-start gap-3 rounded-xl bg-bg-elevated/60 border border-border/60 px-4 py-3">
							<div class="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-base shrink-0 float-icon" style="animation-delay: {Number(s.n) * 0.4}s">
								{s.icon}
							</div>
							<div>
								<span class="text-sm font-semibold text-text-primary">{s.n}. {s.label}</span>
								<p class="text-xs text-text-muted">{@html s.desc}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Phase 2 — Sibling App -->
			<div class="relative rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/6 to-transparent p-6 space-y-5">
				<!-- Phase label -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-bold uppercase tracking-widest text-accent">Phase 2</span>
					<span class="h-px flex-1 bg-accent/20"></span>
					<span class="text-xs text-accent/70 font-medium">Companion Application</span>
				</div>
				<h3 class="text-xl font-bold text-text-primary">Build &amp; Operate</h3>
				<p class="text-text-secondary text-sm leading-relaxed">
					A dedicated software-engineering agent that plans, codes, deploys,
					and autonomously monitors the validated solution — while humans retain
					approval authority at architectural milestones.
				</p>

				<!-- Mini steps 4-8 -->
				<div class="space-y-3">
					{#each [
						{ n: '4', icon: '🗺️', label: 'Plan', desc: 'AI drafts implementation plan; humans approve' },
						{ n: '5', icon: '⚙️', label: 'Build', desc: 'AI develops the solution from the plan' },
						{ n: '6', icon: '🚀', label: 'Deploy &amp; Test', desc: 'AI ships to K8s; AI &amp; humans test' },
						{ n: '7', icon: '🔭', label: 'Observe', desc: 'AI monitors logs, UI, dependencies &amp; patches autonomously' },
						{ n: '8', icon: '🔄', label: 'Evolve', desc: 'Human change proposals restart steps 4–7' }
					] as s}
						<div class="step-card flex items-start gap-3 rounded-xl bg-bg-elevated/60 border border-border/60 px-4 py-3">
							<div class="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-base shrink-0 float-icon" style="animation-delay: {Number(s.n) * 0.3}s">
								{s.icon}
							</div>
							<div>
								<span class="text-sm font-semibold text-text-primary">{s.n}. {s.label}</span>
								<p class="text-xs text-text-muted">{@html s.desc}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Bridge arrow -->
		<div class="my-6 flex justify-center items-center gap-4 text-xs text-text-muted">
			<span class="text-primary font-medium">Validated idea</span>
			<svg width="80" height="16" viewBox="0 0 80 16" class="phase-arrow">
				<defs>
					<marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
						<path d="M0,0 L8,4 L0,8 Z" fill="#FF6B35" />
					</marker>
				</defs>
				<line x1="2" y1="8" x2="72" y2="8" stroke="#FF6B35" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arr)" />
			</svg>
			<span class="text-accent font-medium">Companion app takes over</span>
		</div>
	</section>

	<!-- ════════════════════════ DETAILED FLOW DIAGRAM ════════════════════════ -->
	<section>
		<h2 class="text-center text-sm font-semibold uppercase tracking-widest text-text-muted mb-10">Detailed Signal Flow</h2>

		<!-- SVG pipeline diagram
		     Layout (all x/y are SVG user units, viewBox="0 0 1400 860"):
		     ┌─────────────────────────────────────────────────────┐  ┌──────────────────────────────┐
		     │ PHASE 1  (x=12..860)                                │  │ PHASE 2  (x=880..1388)       │
		     │                                                     │  │                              │
		     │ Sources(36..196) ─► INGEST(220..390) ─► AI(420..620) ─► HUMAN(650..790) ─►(bridge)  │
		     │                                      ↑                                               │
		     │                         reject/refine loop                                           │
		     └─────────────────────────────────────────────────────┘  └──────────────────────────────┘
		-->
		<div class="rounded-2xl border border-border bg-bg-surface/60 p-4 sm:p-8 overflow-x-auto">
			<svg viewBox="0 0 1400 860" xmlns="http://www.w3.org/2000/svg" class="w-full" style="min-width:900px; font-family:'Inter',system-ui,sans-serif;">
				<defs>
					<marker id="arr-green"  markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,1 L9,5 L0,9 Z" fill="#419468"/></marker>
					<marker id="arr-orange" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,1 L9,5 L0,9 Z" fill="#FF6B35"/></marker>
					<marker id="arr-blue"   markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,1 L9,5 L0,9 Z" fill="#38BDF8"/></marker>
					<marker id="arr-red"    markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,1 L9,5 L0,9 Z" fill="#EF4444"/></marker>
					<marker id="arr-amber"  markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,1 L9,5 L0,9 Z" fill="#F59E0B"/></marker>

					<linearGradient id="gp2" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#419468" stop-opacity="0.28"/>
						<stop offset="100%" stop-color="#78FAAE" stop-opacity="0.06"/>
					</linearGradient>
					<linearGradient id="gai2" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.25"/>
						<stop offset="100%" stop-color="#38BDF8" stop-opacity="0.06"/>
					</linearGradient>
					<linearGradient id="gamb2" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#F59E0B" stop-opacity="0.25"/>
						<stop offset="100%" stop-color="#FCD34D" stop-opacity="0.06"/>
					</linearGradient>
					<style>
						.fg  { stroke-dasharray: 10 5; animation: flow 2.2s linear infinite; }
						.fo  { stroke-dasharray: 10 5; animation: flow 2.8s linear infinite; animation-delay: 0.4s; }
						.fai { stroke-dasharray: 10 5; animation: flow 2.0s linear infinite; animation-delay: 1.0s; }
						.fr  { stroke-dasharray:  7 4; animation: flow 3.5s linear infinite; animation-delay: 0.8s; }
					</style>
				</defs>

				<!--
				═══════════════════════════════════════════════════
				  COORDINATE MAP  (viewBox 1400 × 860)
				  Phase 1 region : x 12  → 862   (850 wide)
				  Phase 2 region : x 878 → 1388  (510 wide)

				  Col A  Sources  x 36, w 160  → right edge 196
				  Col B  Ingest   x 230, w 160 → right edge 390
				  Col C  AI Eng   x 420, w 200 → right edge 620
				  Col D  Human    x 650, w 190 → right edge 840
				             (diamond cx=745, cy=310, half=50 → top 260, bot 360)
				  Phase bridge  840→878

				  Col E  Ph2 nodes x 898, w 470 → right edge 1368
				    PLAN     y 58
				    BUILD    y 188
				    DEPLOY   y 318
				    OBSERVE  y 448
				    EVOLVE   y 578
				    each node: h 100
				  Evolve loop right side at x 1368+30=1398 (just inside viewBox)

				  Horizontal centre line (source fan-in):  y 310
				  Source nodes:  y1=72  y2=202  y3=332  y4=462  (each h 80)
				═══════════════════════════════════════════════════
				-->

				<!-- ── Phase regions ── -->
				<rect x="12"  y="12" width="850" height="836" rx="20"
					  fill="rgba(65,148,104,0.04)" stroke="#419468" stroke-width="1.5" stroke-dasharray="6,5"/>
				<text x="32" y="44" fill="#419468" font-size="14" font-weight="700" letter-spacing="2" opacity="0.75">PHASE 1 — THIS APPLICATION</text>

				<rect x="878" y="12" width="510" height="836" rx="20"
					  fill="rgba(255,107,53,0.04)" stroke="#FF6B35" stroke-width="1.5" stroke-dasharray="6,5"/>
				<text x="898" y="44" fill="#FF6B35" font-size="14" font-weight="700" letter-spacing="2" opacity="0.75">PHASE 2 — COMPANION APP</text>

				<!-- ── Col A: Source nodes ── -->
				<!-- NEWS FEEDS  y=72..152 -->
				<g transform="translate(36,72)">
					<rect width="160" height="80" rx="14" fill="#12121A" stroke="#38BDF8" stroke-width="2"/>
					<text x="80" y="30" text-anchor="middle" fill="#38BDF8"  font-size="13" font-weight="700">NEWS FEEDS</text>
					<text x="80" y="52" text-anchor="middle" fill="#A0A0B0" font-size="11">RSS · Web scrapers</text>
					<text x="80" y="68" text-anchor="middle" fill="#6B6B7B"  font-size="10">External signals</text>
				</g>

				<!-- USER IDEAS  y=202..282 -->
				<g transform="translate(36,202)">
					<rect width="160" height="80" rx="14" fill="#12121A" stroke="#78FAAE" stroke-width="2"/>
					<text x="80" y="30" text-anchor="middle" fill="#78FAAE"  font-size="13" font-weight="700">USER IDEAS</text>
					<text x="80" y="52" text-anchor="middle" fill="#A0A0B0" font-size="11">Proposals · Votes</text>
					<text x="80" y="68" text-anchor="middle" fill="#6B6B7B"  font-size="10">Community input</text>
				</g>

				<!-- INNOVATIONS  y=332..412 -->
				<g transform="translate(36,332)">
					<rect width="160" height="80" rx="14" fill="#12121A" stroke="#78FAAE" stroke-width="2"/>
					<text x="80" y="30" text-anchor="middle" fill="#78FAAE"  font-size="13" font-weight="700">INNOVATIONS</text>
					<text x="80" y="52" text-anchor="middle" fill="#A0A0B0" font-size="11">Community catalog</text>
					<text x="80" y="68" text-anchor="middle" fill="#6B6B7B"  font-size="10">Known solutions</text>
				</g>

				<!-- AI EXPLORATION  y=462..542 -->
				<g transform="translate(36,462)">
					<rect width="160" height="80" rx="14" fill="#12121A" stroke="#8B5CF6" stroke-width="2"/>
					<text x="80" y="30" text-anchor="middle" fill="#C4B5FD"  font-size="13" font-weight="700">AI EXPLORATION</text>
					<text x="80" y="52" text-anchor="middle" fill="#A0A0B0" font-size="11">Generative signals</text>
					<text x="80" y="68" text-anchor="middle" fill="#6B6B7B"  font-size="10">Novel idea discovery</text>
				</g>

				<!-- Fan-in arrows: right edge of source (x=196) → left of INGEST (x=230), fanning to centre y=310 -->
				<!-- Each source right-edge midpoint: 72+40=112, 202+40=242, 332+40=372, 462+40=502 -->
				<line x1="196" y1="112" x2="230" y2="295" stroke="#38BDF8" stroke-width="1.8" class="fg" marker-end="url(#arr-blue)"  opacity="0.75"/>
				<line x1="196" y1="242" x2="230" y2="302" stroke="#78FAAE" stroke-width="1.8" class="fg" marker-end="url(#arr-green)" opacity="0.75"/>
				<line x1="196" y1="372" x2="230" y2="318" stroke="#78FAAE" stroke-width="1.8" class="fg" marker-end="url(#arr-green)" opacity="0.75"/>
				<line x1="196" y1="502" x2="230" y2="325" stroke="#8B5CF6" stroke-width="1.8" class="fai" marker-end="url(#arr-blue)" opacity="0.75"/>

				<!-- ── Col B: INGEST  x=230..390, centre y=310 (height=100, top=260) ── -->
				<g transform="translate(230,260)">
					<rect width="160" height="100" rx="16" fill="url(#gp2)" stroke="#419468" stroke-width="2.5"/>
					<text x="80" y="36" text-anchor="middle" fill="#78FAAE" font-size="15" font-weight="800" letter-spacing="1">INGEST</text>
					<text x="80" y="60" text-anchor="middle" fill="#A0A0B0" font-size="12">Collect &amp; normalise</text>
					<text x="80" y="80" text-anchor="middle" fill="#6B6B7B"  font-size="11">Deduplicate · tag</text>
				</g>

				<!-- INGEST → AI ENGINE  (x=390 → x=420) -->
				<line x1="390" y1="310" x2="420" y2="310" stroke="#419468" stroke-width="2.2" class="fg" marker-end="url(#arr-green)"/>

				<!-- ── Col C: AI ENGINE  x=420..620, centre y=310 (height=120, top=250) ── -->
				<g transform="translate(420,250)">
					<rect width="200" height="120" rx="16" fill="url(#gai2)" stroke="#8B5CF6" stroke-width="2.5"/>
					<text x="100" y="34"  text-anchor="middle" fill="#C4B5FD" font-size="15" font-weight="800" letter-spacing="1">AI ENGINE</text>
					<text x="100" y="58"  text-anchor="middle" fill="#A0A0B0" font-size="12">Filter · Score · Rank</text>
					<text x="100" y="78"  text-anchor="middle" fill="#A0A0B0" font-size="12">Research · Enrich</text>
					<text x="100" y="100" text-anchor="middle" fill="#8B5CF6"  font-size="12" font-style="italic">Powered by Gemini</text>
					<text x="100" y="114" text-anchor="middle" fill="#6B6B7B"  font-size="10">Novelty · Feasibility · Fit</text>
				</g>

				<!-- AI ENGINE → HUMAN GATE  (x=620 → x=650) -->
				<line x1="620" y1="310" x2="648" y2="310" stroke="#8B5CF6" stroke-width="2.2" class="fai" marker-end="url(#arr-blue)"/>

				<!-- ── Col D: HUMAN GATE  x=650..840, centre y=310 ── -->
				<!-- Rectangle gate (not tiny diamond — readable) height=100, top=260 -->
				<g transform="translate(650,260)">
					<rect width="190" height="100" rx="16" fill="url(#gamb2)" stroke="#F59E0B" stroke-width="2.5"/>
					<text x="95" y="34"  text-anchor="middle" fill="#F59E0B" font-size="15" font-weight="800" letter-spacing="0.5">HUMAN REVIEW</text>
					<text x="95" y="58"  text-anchor="middle" fill="#A0A0B0" font-size="12">Evaluate shortlist</text>
					<text x="95" y="78"  text-anchor="middle" fill="#A0A0B0" font-size="12">Approve or reject</text>
					<!-- Gate icon: a small checkmark / stop-hand symbol via text -->
					<text x="95" y="98"  text-anchor="middle" fill="#F59E0B"  font-size="10" font-style="italic">Human decision point</text>
				</g>

				<!-- Reject/refine loop: bottom of human gate (y=360) curves down & left to AI ENGINE bottom (y=370) -->
				<path d="M 745,360  Q 745,560  520,560  Q 420,560  420,370"
					  fill="none" stroke="#EF4444" stroke-width="2" stroke-dasharray="8,5" class="fr" opacity="0.7"
					  marker-end="url(#arr-red)"/>
				<text x="582" y="585" text-anchor="middle" fill="#EF4444" font-size="13" font-weight="600" opacity="0.85">reject / refine</text>
				<text x="582" y="603" text-anchor="middle" fill="#6B6B7B"  font-size="11" opacity="0.75">returns for deeper AI analysis</text>

				<!-- ── Phase bridge: right of human gate (x=840) → PLAN left edge (x=898), at PLAN mid y=108 ── -->
				<!-- Route: go right to x=878 (Phase 2 boundary), then up to y=108 (PLAN centre), then right to x=898 (PLAN left) -->
				<path d="M 840,310  L 864,310  L 864,108  L 898,108"
					  fill="none" stroke="#F59E0B" stroke-width="2.5" class="fo" marker-end="url(#arr-orange)"/>
				<text x="851" y="222" text-anchor="middle" fill="#F59E0B" font-size="12" font-weight="700" opacity="0.9" transform="rotate(-90,851,222)">Approved</text>

				<!-- ── Col E: Phase 2 nodes  x=898..1368 (w=470) ── -->

				<!-- PLAN  y=58..158 -->
				<g transform="translate(898,58)">
					<rect width="470" height="100" rx="14" fill="#1A1A24" stroke="#FF6B35" stroke-width="2"/>
					<text x="235" y="34"  text-anchor="middle" fill="#FF6B35" font-size="14" font-weight="700" letter-spacing="0.8">PLAN</text>
					<text x="235" y="58"  text-anchor="middle" fill="#A0A0B0" font-size="12">AI generates implementation blueprint</text>
					<text x="235" y="80"  text-anchor="middle" fill="#6B6B7B"  font-size="11">Architecture · milestones · risks</text>
					<text x="235" y="96"  text-anchor="middle" fill="#F59E0B"  font-size="11" font-style="italic">→ Human architect approval required</text>
				</g>

				<!-- PLAN → BUILD  (bottom of PLAN y=158 → top of BUILD y=188, gap=30) -->
				<line x1="1133" y1="158" x2="1133" y2="188" stroke="#FF6B35" stroke-width="2.2" class="fo" marker-end="url(#arr-orange)"/>

				<!-- BUILD  y=188..288 -->
				<g transform="translate(898,188)">
					<rect width="470" height="100" rx="14" fill="#1A1A24" stroke="#FF6B35" stroke-width="2"/>
					<text x="235" y="34"  text-anchor="middle" fill="#FF6B35" font-size="14" font-weight="700" letter-spacing="0.8">BUILD</text>
					<text x="235" y="58"  text-anchor="middle" fill="#A0A0B0" font-size="12">AI develops the solution from the plan</text>
					<text x="235" y="80"  text-anchor="middle" fill="#6B6B7B"  font-size="11">Code · tests · pull requests · iteration</text>
					<text x="235" y="96"  text-anchor="middle" fill="#6B6B7B"  font-size="11">Automated test suites at every step</text>
				</g>

				<!-- BUILD → DEPLOY -->
				<line x1="1133" y1="288" x2="1133" y2="318" stroke="#FF6B35" stroke-width="2.2" class="fo" marker-end="url(#arr-orange)"/>

				<!-- DEPLOY  y=318..418 -->
				<g transform="translate(898,318)">
					<rect width="470" height="100" rx="14" fill="#1A1A24" stroke="#FF6B35" stroke-width="2"/>
					<text x="235" y="34"  text-anchor="middle" fill="#FF6B35" font-size="14" font-weight="700" letter-spacing="0.8">DEPLOY &amp; TEST</text>
					<text x="235" y="58"  text-anchor="middle" fill="#A0A0B0" font-size="12">AI ships container to Kubernetes</text>
					<text x="235" y="80"  text-anchor="middle" fill="#6B6B7B"  font-size="11">Rolling deploy · AI integration tests</text>
					<text x="235" y="96"  text-anchor="middle" fill="#F59E0B"  font-size="11" font-style="italic">→ Human acceptance sign-off</text>
				</g>

				<!-- DEPLOY → OBSERVE -->
				<line x1="1133" y1="418" x2="1133" y2="448" stroke="#FF6B35" stroke-width="2.2" class="fo" marker-end="url(#arr-orange)"/>

				<!-- OBSERVE  y=448..548 -->
				<g transform="translate(898,448)">
					<rect width="470" height="100" rx="14" fill="#1A1A24" stroke="#FF6B35" stroke-width="2"/>
					<text x="235" y="34"  text-anchor="middle" fill="#FF6B35" font-size="14" font-weight="700" letter-spacing="0.8">OBSERVE</text>
					<text x="235" y="58"  text-anchor="middle" fill="#A0A0B0" font-size="12">AI monitors logs · UI · dependencies</text>
					<text x="235" y="80"  text-anchor="middle" fill="#6B6B7B"  font-size="11">Anomaly detection · auto-patch · rollback</text>
					<text x="235" y="96"  text-anchor="middle" fill="#6B6B7B"  font-size="11">Autonomous operations — no on-call needed</text>
				</g>

				<!-- OBSERVE → EVOLVE -->
				<line x1="1133" y1="548" x2="1133" y2="578" stroke="#FF6B35" stroke-width="2.2" class="fo" marker-end="url(#arr-orange)"/>

				<!-- EVOLVE  y=578..678 -->
				<g transform="translate(898,578)">
					<rect width="470" height="100" rx="14" fill="#1A1A24" stroke="#F59E0B" stroke-width="2"/>
					<text x="235" y="34"  text-anchor="middle" fill="#F59E0B" font-size="14" font-weight="700" letter-spacing="0.8">EVOLVE</text>
					<text x="235" y="58"  text-anchor="middle" fill="#A0A0B0" font-size="12">Human proposes changes to running solution</text>
					<text x="235" y="80"  text-anchor="middle" fill="#6B6B7B"  font-size="11">Re-enters PLAN — steps 4–7 repeat</text>
					<text x="235" y="96"  text-anchor="middle" fill="#6B6B7B"  font-size="11">Full audit trail maintained</text>
				</g>

				<!-- EVOLVE loop-back: right side of Phase 2 box, from EVOLVE bottom-right corner up to PLAN top-right corner -->
				<!-- EVOLVE right edge: x=1368, mid-y=628. PLAN right edge: x=1368, mid-y=108 -->
				<!-- Route outside Phase 2: go to x=1352 (inside right margin), arc up, terminate at PLAN right (y=108) -->
				<path d="M 1368,628  L 1352,628  L 1352,108  L 1368,108"
					  fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="8,5" class="fr" opacity="0.65"
					  marker-end="url(#arr-amber)"/>
				<text x="1340" y="374" text-anchor="middle" fill="#F59E0B" font-size="12" font-weight="700" opacity="0.75" transform="rotate(-90,1340,374)">loops 4–7</text>

				<!-- ── Legend ── -->
				<g transform="translate(24,798)">
					<rect width="820" height="46" rx="10" fill="rgba(26,26,36,0.85)" stroke="#2A2A3A" stroke-width="1"/>
					<circle cx="20"  cy="23" r="7" fill="#419468"/>
					<text x="32"  y="27" fill="#A0A0B0" font-size="12">AI-driven step</text>
					<circle cx="178" cy="23" r="7" fill="#F59E0B"/>
					<text x="190" y="27" fill="#A0A0B0" font-size="12">Human approval gate</text>
					<circle cx="380" cy="23" r="7" fill="#EF4444"/>
					<text x="392" y="27" fill="#A0A0B0" font-size="12">Reject / refine loop</text>
					<circle cx="570" cy="23" r="7" fill="#8B5CF6"/>
					<text x="582" y="27" fill="#A0A0B0" font-size="12">Generative AI (Gemini)</text>
				</g>
			</svg>
		</div>
	</section>

	<!-- ════════════════════════ DETAIL ROWS ════════════════════════ -->
	<section class="space-y-6">
		<h2 class="text-center text-sm font-semibold uppercase tracking-widest text-text-muted mb-2">Step-by-Step Breakdown</h2>

		<!-- Phase 1 header -->
		<div class="flex items-center gap-3">
			<span class="px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider">Phase 1 · This App</span>
			<span class="h-px flex-1 bg-border"></span>
		</div>

		{#each [
			{
				n: 1,
				icon: '📡',
				color: 'primary',
				border: 'border-primary/30',
				bg: 'bg-primary/5',
				accent: 'text-primary',
				title: 'Collect — Diverse Signal Ingestion',
				body: 'The portal continuously monitors external news feeds, RSS sources, and web scrapers for emerging technology signals. Simultaneously it captures ideas and innovations submitted by users and proposals generated autonomously by the AI. Every signal is timestamped, attributed, and stored for downstream processing.',
				tags: ['News & RSS', 'User Proposals', 'AI Suggestions', 'Community Innovations']
			},
			{
				n: 2,
				icon: '🤖',
				color: 'purple',
				border: 'border-purple-500/30',
				bg: 'bg-purple-500/5',
				accent: 'text-purple-400',
				title: 'Analyse — AI-Powered Filtering & Research',
				body: 'A Gemini-powered pipeline scores each item across multiple dimensions: novelty, strategic relevance, technical feasibility, and competitive context. The model automatically researches related prior art, cross-references the existing solution catalog, and writes a concise evaluation brief — so human reviewers receive a curated, pre-researched shortlist rather than raw noise.',
				tags: ['Relevance Scoring', 'Novelty Detection', 'Prior Art Research', 'Competitive Analysis']
			},
			{
				n: 3,
				icon: '✅',
				color: 'amber',
				border: 'border-amber-500/30',
				bg: 'bg-amber-500/5',
				accent: 'text-amber-400',
				title: 'Validate — Human Approval Gate',
				body: 'Items that pass AI scoring surface in the admin review queue with full evaluation briefs. Human decision-makers vote, annotate, and either approve ideas for Phase 2, return them for AI refinement, or discard them. Only approved ideas generate an implementation hand-off ticket for the companion application.',
				tags: ['Admin Review Queue', 'Voting & Annotation', 'Approve / Refine / Discard', 'Phase 2 Hand-off']
			}
		] as step}
			<div class="detail-row step-card rounded-2xl border {step.border} {step.bg} p-6 flex gap-6">
				<div class="shrink-0 flex flex-col items-center gap-2 pt-1">
					<div class="relative w-12 h-12 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center text-2xl">
						<span>{step.icon}</span>
						<div class="node-ring {step.accent}"></div>
					</div>
					<span class="text-xs font-bold {step.accent}">Step {step.n}</span>
				</div>
				<div class="flex-1 space-y-3">
					<h3 class="text-base font-bold text-text-primary">{step.title}</h3>
					<p class="text-sm text-text-secondary leading-relaxed">{step.body}</p>
					<div class="flex flex-wrap gap-2">
						{#each step.tags as tag}
							<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-bg-elevated border border-border text-text-muted">{tag}</span>
						{/each}
					</div>
				</div>
			</div>
		{/each}

		<!-- Phase 2 header -->
		<div class="flex items-center gap-3 pt-4">
			<span class="px-3 py-1 rounded-full bg-accent/15 text-accent text-xs font-bold uppercase tracking-wider">Phase 2 · Companion App</span>
			<span class="h-px flex-1 bg-border"></span>
		</div>

		{#each [
			{
				n: 4,
				icon: '🗺️',
				border: 'border-accent/25',
				bg: 'bg-accent/4',
				accent: 'text-accent',
				title: 'Plan — Implementation Blueprint',
				body: 'The companion engineering agent receives the approved idea and generates a detailed implementation plan: architecture diagrams, tech-stack choices, milestone breakdown, risk assessment. A human architect reviews and approves the plan before a single line of code is written.'
			},
			{
				n: 5,
				icon: '⚙️',
				border: 'border-accent/25',
				bg: 'bg-accent/4',
				accent: 'text-accent',
				title: 'Build — AI-Driven Development',
				body: 'Following the approved plan, the AI agent writes, tests, and iterates on the codebase. It raises pull requests, runs automated test suites, and addresses review comments — functioning as a highly productive senior engineer working from a precise specification.'
			},
			{
				n: 6,
				icon: '🚀',
				border: 'border-accent/25',
				bg: 'bg-accent/4',
				accent: 'text-accent',
				title: 'Deploy & Test — K8s Rollout',
				body: 'The agent packages the solution as a container image, generates Kubernetes manifests, and performs a rolling deployment. Automated integration and end-to-end tests run against the live environment. Human QA testers confirm acceptance criteria before the deployment is declared stable.'
			},
			{
				n: 7,
				icon: '🔭',
				border: 'border-accent/25',
				bg: 'bg-accent/4',
				accent: 'text-accent',
				title: 'Observe — Autonomous Operations',
				body: 'In steady state the agent continuously inspects logs, traces, and UI snapshots. It monitors dependency vulnerability feeds, auto-patches outdated libraries, and opens incidents or rolls back deployments autonomously when anomalies are detected — no on-call human needed for routine operations.'
			},
			{
				n: 8,
				icon: '🔄',
				border: 'border-amber-500/25',
				bg: 'bg-amber-500/4',
				accent: 'text-amber-400',
				title: 'Evolve — Human-Driven Change Loop',
				body: 'When stakeholders want to extend or modify the running solution, they submit a change proposal. The companion app re-enters the Plan step (4) and repeats steps 4–7, maintaining a full audit trail of every change cycle.'
			}
		] as step}
			<div class="detail-row step-card rounded-2xl border {step.border} {step.bg} p-6 flex gap-6">
				<div class="shrink-0 flex flex-col items-center gap-2 pt-1">
					<div class="relative w-12 h-12 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center text-2xl">
						<span>{step.icon}</span>
					</div>
					<span class="text-xs font-bold {step.accent}">Step {step.n}</span>
				</div>
				<div class="flex-1 space-y-2">
					<h3 class="text-base font-bold text-text-primary">{step.title}</h3>
					<p class="text-sm text-text-secondary leading-relaxed">{step.body}</p>
				</div>
			</div>
		{/each}
	</section>

	<!-- ════════════════════════ PRINCIPLES ════════════════════════ -->
	<section class="pb-16">
		<h2 class="text-center text-sm font-semibold uppercase tracking-widest text-text-muted mb-8">Guiding Principles</h2>
		<div class="grid sm:grid-cols-3 gap-5">
			{#each [
				{
					icon: '🧠',
					title: 'AI as Amplifier',
					body: 'AI does the tedious labour — scraping, scoring, coding, monitoring. Humans focus exclusively on judgment, strategy, and approval.'
				},
				{
					icon: '🔐',
					title: 'Humans at the Gates',
					body: 'No idea advances without human sign-off. No deployment goes live without human acceptance. Control is always with people.'
				},
				{
					icon: '♻️',
					title: 'Continuous Improvement',
					body: 'Every deployed solution feeds signals back into Phase 1. The system learns from real-world outcomes and tightens its evaluation criteria over time.'
				}
			] as p}
				<div class="step-card rounded-2xl border border-border bg-bg-elevated/50 p-6 text-center space-y-3">
					<div class="text-4xl float-icon">{p.icon}</div>
					<h3 class="font-bold text-text-primary">{p.title}</h3>
					<p class="text-sm text-text-secondary leading-relaxed">{p.body}</p>
				</div>
			{/each}
		</div>
	</section>

</div>
