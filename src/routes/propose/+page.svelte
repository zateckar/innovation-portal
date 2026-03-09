<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Input, Textarea, Select, Button } from '$lib/components/ui';
	import { CATEGORY_LABELS, DEPARTMENT_LABELS, type InnovationCategory, type DepartmentCategory } from '$lib/types';

	let { form } = $props();
	let loading = $state(false);

	// Track the proposal type the user has selected.
	// On server error, `form.proposalType` is returned so the correct tab stays active.
	let proposalType = $state<'innovation' | 'idea'>('innovation');
	$effect(() => {
		const fromServer = form?.proposalType as 'innovation' | 'idea' | undefined;
		if (fromServer) proposalType = fromServer;
	});

	const categories = Object.entries(CATEGORY_LABELS) as [InnovationCategory, string][];
	const departments = Object.entries(DEPARTMENT_LABELS) as [DepartmentCategory, string][];
</script>

<svelte:head>
	<title>Propose - Innovation Radar</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-text-primary mb-2">Submit a Proposal</h1>
		<p class="text-text-secondary">
			Have something to share with the community? Propose an Innovation or an Idea.
		</p>
	</div>

	<!-- Type Selector -->
	<div class="mb-6 flex gap-3">
		<button
			type="button"
			onclick={() => (proposalType = 'innovation')}
			class="flex-1 py-3 px-4 rounded-lg border font-medium transition-all text-sm
				{proposalType === 'innovation'
					? 'bg-primary/20 text-primary border-primary/40'
					: 'bg-bg-elevated text-text-secondary border-border hover:border-primary/30 hover:text-text-primary'}"
		>
			Innovation
			<span class="block text-xs font-normal mt-0.5 opacity-70">A tool, framework, or product</span>
		</button>
		<button
			type="button"
			onclick={() => (proposalType = 'idea')}
			class="flex-1 py-3 px-4 rounded-lg border font-medium transition-all text-sm
				{proposalType === 'idea'
					? 'bg-primary/20 text-primary border-primary/40'
					: 'bg-bg-elevated text-text-secondary border-border hover:border-primary/30 hover:text-text-primary'}"
		>
			Idea
			<span class="block text-xs font-normal mt-0.5 opacity-70">A process improvement or new concept</span>
		</button>
	</div>

	<Card padding="lg">
		{#if form?.error}
			<div class="mb-6 p-4 rounded-lg bg-error/10 border border-error/30 text-error">
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
			class="space-y-6"
		>
			<!-- Hidden field for proposal type -->
			<input type="hidden" name="proposalType" value={proposalType} />

			<!-- ── INNOVATION FORM ── -->
			{#if proposalType === 'innovation'}
				<!-- Title -->
				<Input
					name="title"
					label="Innovation Name"
					placeholder="e.g., Ollama - Local LLM Runner"
					required
					value={form?.title ?? ''}
					hint="The name of the tool, framework, or innovation"
				/>

				<!-- URL -->
				<Input
					name="url"
					type="url"
					label="URL"
					placeholder="https://github.com/example/project"
					required
					value={form?.url ?? ''}
					hint="Link to the project page, GitHub repo, or article"
				/>

				<!-- Category -->
				<Select name="category" label="Category" required>
					<option value="">Select a category...</option>
					{#each categories as [value, label]}
						<option {value} selected={form?.category === value}>{label}</option>
					{/each}
				</Select>

				<!-- Reason -->
				<Textarea
					name="reason"
					label="Why is this relevant for us?"
					placeholder="Explain how this innovation could benefit our company, what problems it solves, and why we should consider it..."
					required
					rows={5}
					value={form?.reason ?? ''}
					hint="Be specific about use cases and benefits (minimum 20 characters)"
				/>

				<!-- Checkboxes -->
				<fieldset class="space-y-3">
					<legend class="text-sm font-medium text-text-secondary block mb-2">
						Properties
					</legend>

					<label class="flex items-center gap-3 cursor-pointer group">
						<input
							type="checkbox"
							name="isOpenSource"
							class="w-5 h-5 rounded border-border bg-bg-surface text-primary focus:ring-primary focus:ring-offset-0"
						/>
						<span class="text-text-secondary group-hover:text-text-primary transition-colors">
							Open Source
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer group">
						<input
							type="checkbox"
							name="isSelfHosted"
							class="w-5 h-5 rounded border-border bg-bg-surface text-primary focus:ring-primary focus:ring-offset-0"
						/>
						<span class="text-text-secondary group-hover:text-text-primary transition-colors">
							Can be self-hosted
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer group">
						<input
							type="checkbox"
							name="hasAiComponent"
							class="w-5 h-5 rounded border-border bg-bg-surface text-primary focus:ring-primary focus:ring-offset-0"
						/>
						<span class="text-text-secondary group-hover:text-text-primary transition-colors">
							Has AI/ML component
						</span>
					</label>
				</fieldset>

			<!-- ── IDEA FORM ── -->
			{:else}
				<!-- Title -->
				<Input
					name="ideaTitle"
					label="Idea Title"
					placeholder="e.g., Automated Quality Gate for CI/CD Pipelines"
					required
					value={form?.ideaTitle ?? ''}
					hint="A concise, descriptive title for your idea"
				/>

				<!-- Department -->
				<Select name="ideaDepartment" label="Department" required>
					<option value="">Select a department...</option>
					{#each departments as [value, label]}
						<option {value} selected={form?.ideaDepartment === value}>{label}</option>
					{/each}
				</Select>

				<!-- Summary -->
				<Textarea
					name="ideaSummary"
					label="Summary"
					placeholder="A brief one-paragraph overview of your idea..."
					required
					rows={3}
					value={form?.ideaSummary ?? ''}
					hint="Short overview of the idea (minimum 20 characters)"
				/>

				<!-- Problem -->
				<Textarea
					name="ideaProblem"
					label="Problem"
					placeholder="What problem does this idea solve? Who is affected and how?"
					required
					rows={4}
					value={form?.ideaProblem ?? ''}
					hint="Describe the pain point or challenge this idea addresses (minimum 20 characters)"
				/>

				<!-- Solution -->
				<Textarea
					name="ideaSolution"
					label="Proposed Solution"
					placeholder="How does your idea solve the problem? What would the implementation look like?"
					required
					rows={5}
					value={form?.ideaSolution ?? ''}
					hint="Describe your proposed solution in detail (minimum 20 characters)"
				/>
			{/if}

			<!-- Submit -->
			<div class="flex items-center justify-end gap-4 pt-4 border-t border-border">
				<a
					href={proposalType === 'idea' ? '/ideas' : '/innovations'}
					class="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
				>
					Cancel
				</a>
				<Button type="submit" {loading}>
					{proposalType === 'idea' ? 'Submit Idea' : 'Submit Proposal'}
				</Button>
			</div>
		</form>
	</Card>

	<!-- Tips -->
	<div class="mt-8 p-6 rounded-xl bg-bg-elevated/50 border border-border">
		<h3 class="font-semibold text-text-primary mb-3">
			{#if proposalType === 'idea'}
				Tips for a great idea
			{:else}
				Tips for a great proposal
			{/if}
		</h3>
		<ul class="space-y-2 text-sm text-text-secondary">
			{#if proposalType === 'idea'}
				<li class="flex items-start gap-2">
					<svg class="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
					Focus on a real problem your team or department faces
				</li>
				<li class="flex items-start gap-2">
					<svg class="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
					Be concrete about how the solution would work
				</li>
				<li class="flex items-start gap-2">
					<svg class="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
					Your idea will be evaluated and realized by AI — the richer your description, the better the result
				</li>
				<li class="flex items-start gap-2">
					<svg class="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
					Cross-department ideas that benefit multiple teams are especially valuable
				</li>
			{:else}
				<li class="flex items-start gap-2">
					<svg class="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
					Focus on innovations that solve real problems in our IT landscape
				</li>
				<li class="flex items-start gap-2">
					<svg class="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
					Open source and self-hosted solutions are preferred
				</li>
				<li class="flex items-start gap-2">
					<svg class="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
					Include specific use cases for our automotive context
				</li>
				<li class="flex items-start gap-2">
					<svg class="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
					</svg>
					Mention if you've tested or used the tool yourself
				</li>
			{/if}
		</ul>
	</div>
</div>
