<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Input, Textarea, Select, Button } from '$lib/components/ui';
	import { CATEGORY_LABELS, type InnovationCategory } from '$lib/types';
	
	let { form } = $props();
	let loading = $state(false);
	
	const categories = Object.entries(CATEGORY_LABELS) as [InnovationCategory, string][];
</script>

<svelte:head>
	<title>Propose Innovation - Innovation Radar</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-text-primary mb-2">Propose an Innovation</h1>
		<p class="text-text-secondary">
			Found something exciting that could benefit our company? Submit it here and let the community vote!
		</p>
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
			
			<!-- Submit -->
			<div class="flex items-center justify-end gap-4 pt-4 border-t border-border">
				<a 
					href="/innovations"
					class="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
				>
					Cancel
				</a>
				<Button type="submit" {loading}>
					Submit Proposal
				</Button>
			</div>
		</form>
	</Card>
	
	<!-- Tips -->
	<div class="mt-8 p-6 rounded-xl bg-bg-elevated/50 border border-border">
		<h3 class="font-semibold text-text-primary mb-3">Tips for a great proposal</h3>
		<ul class="space-y-2 text-sm text-text-secondary">
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
		</ul>
	</div>
</div>
