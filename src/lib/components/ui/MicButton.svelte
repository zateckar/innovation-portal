<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Props {
		/** Text the dictation appends to. Bind this to the same value as the textarea. */
		value?: string;
		disabled?: boolean;
		/** Initial/default BCP-47 language tag for recognition. */
		lang?: string;
		/** Positioning classes for the wrapper (e.g. "absolute bottom-2 right-2"). */
		class?: string;
		/** Size classes for the mic button itself. */
		size?: string;
	}

	let {
		value = $bindable(''),
		disabled = false,
		lang = 'en-US',
		class: className = '',
		size = 'w-9 h-9'
	}: Props = $props();

	// Supported dictation languages.
	const LANGUAGES = [
		{ code: 'en-US', short: 'EN', label: 'English' },
		{ code: 'cs-CZ', short: 'CS', label: 'Čeština' }
	] as const;

	const STORAGE_KEY = 'dictation-lang';

	function initialLang(): string {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
		}
		return LANGUAGES.some((l) => l.code === lang) ? lang : LANGUAGES[0].code;
	}

	let selectedLang = $state(initialLang());
	const currentLanguage = $derived(LANGUAGES.find((l) => l.code === selectedLang) ?? LANGUAGES[0]);

	// Resolve the browser's speech recognition constructor (Chrome/Edge/Safari).
	const SpeechRecognitionImpl =
		typeof window !== 'undefined'
			? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
			: undefined;
	const supported = !!SpeechRecognitionImpl;

	let listening = $state(false);
	let errored = $state(false);
	let recognition: SpeechRecognition | null = null;

	// Text already present when dictation started; finalized phrases accumulate on top.
	let baseline = '';
	let sessionFinal = '';

	function compose(base: string, addition: string): string {
		const add = addition.replace(/^\s+/, '');
		if (!base) return add;
		const trimmedBase = base.replace(/\s+$/, '');
		return add ? `${trimmedBase} ${add}` : base;
	}

	function start() {
		if (!SpeechRecognitionImpl || disabled) return;
		errored = false;
		const r = new SpeechRecognitionImpl();
		r.lang = selectedLang;
		r.continuous = true;
		r.interimResults = true;

		baseline = value;
		sessionFinal = '';

		r.onresult = (event: SpeechRecognitionEvent) => {
			let interim = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const transcript = result[0].transcript;
				if (result.isFinal) sessionFinal += transcript;
				else interim += transcript;
			}
			value = compose(baseline, sessionFinal + interim);
		};
		r.onerror = () => {
			errored = true;
			listening = false;
		};
		r.onend = () => {
			listening = false;
		};

		try {
			r.start();
			recognition = r;
			listening = true;
		} catch {
			errored = true;
			listening = false;
		}
	}

	function stop() {
		recognition?.stop();
		listening = false;
	}

	function toggle() {
		if (listening) stop();
		else start();
	}

	function cycleLanguage() {
		// Stop any active session so the next one picks up the new language.
		if (listening) stop();
		const idx = LANGUAGES.findIndex((l) => l.code === selectedLang);
		selectedLang = LANGUAGES[(idx + 1) % LANGUAGES.length].code;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, selectedLang);
		}
	}

	onDestroy(() => {
		recognition?.abort();
	});

	const label = $derived(listening ? 'Stop dictation' : `Dictate with microphone (${currentLanguage.label})`);
</script>

{#if supported}
	<span class="inline-flex items-center gap-1 {className}">
		<button
			type="button"
			onclick={cycleLanguage}
			{disabled}
			aria-label={`Dictation language: ${currentLanguage.label} (click to switch)`}
			title={`Dictation language: ${currentLanguage.label} — click to switch`}
			class="inline-flex items-center justify-center rounded-md border border-border bg-bg-elevated
				px-1.5 py-1 text-[10px] font-semibold leading-none text-text-muted
				hover:text-text-primary hover:border-primary/40 transition-colors
				disabled:opacity-40 disabled:cursor-not-allowed"
		>
			{currentLanguage.short}
		</button>
		<button
			type="button"
			onclick={toggle}
			{disabled}
			aria-label={label}
			aria-pressed={listening}
			title={errored ? 'Microphone unavailable — check permissions' : label}
			class="relative inline-flex items-center justify-center rounded-lg border transition-colors
				disabled:opacity-40 disabled:cursor-not-allowed
				{listening
				? 'border-red-500/50 bg-red-500/15 text-red-400'
				: 'border-border bg-bg-elevated text-text-muted hover:text-text-primary hover:border-primary/40'}
				{size}"
		>
			{#if listening}
				<span class="absolute inset-0 rounded-lg bg-red-500/20 animate-ping"></span>
			{/if}
			<svg class="relative w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 11a7 7 0 01-14 0m7 7v3m0-3a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z"
				/>
			</svg>
		</button>
	</span>
{/if}
