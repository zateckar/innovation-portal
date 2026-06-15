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
	let starting = $state(false);
	let errorMessage = $state('');
	let recognition: SpeechRecognition | null = null;

	// Text already present when dictation started; finalized phrases accumulate on top.
	let baseline = '';
	let sessionFinal = '';
	// True while the user intends to keep dictating. Lets us auto-restart through
	// Chrome's silence timeout (which fires `onend` even though the user never stopped).
	let wantListening = false;
	// Guards against tight restart loops if recognition keeps ending immediately.
	let restartGuard = 0;

	function compose(base: string, addition: string): string {
		const add = addition.replace(/^\s+/, '');
		if (!base) return add;
		const trimmedBase = base.replace(/\s+$/, '');
		return add ? `${trimmedBase} ${add}` : base;
	}

	/** Map a SpeechRecognition / getUserMedia error code to a human-readable hint. */
	function describeError(code: string): string {
		switch (code) {
			case 'not-allowed':
			case 'NotAllowedError':
			case 'service-not-allowed':
			case 'SecurityError':
				return 'Microphone blocked. Allow mic access for this site and reload.';
			case 'NotFoundError':
			case 'DevicesNotFoundError':
				return 'No microphone found. Connect one and try again.';
			case 'NotReadableError':
			case 'audio-capture':
				return 'Microphone is in use by another app or unavailable.';
			case 'network':
				return 'Speech service unreachable (needs internet). Try again.';
			case 'language-not-supported':
				return `Dictation language "${currentLanguage.label}" is not supported here.`;
			case 'no-speech':
				return 'No speech detected — try speaking again.';
			default:
				return 'Microphone unavailable. Check permissions and try again.';
		}
	}

	/** Create and wire up a recognition instance for the current language. */
	function makeRecognition(): SpeechRecognition {
		const r = new SpeechRecognitionImpl!();
		r.lang = selectedLang;
		r.continuous = true;
		r.interimResults = true;

		r.onresult = (event: SpeechRecognitionEvent) => {
			restartGuard = 0; // we got results, so the session is healthy
			let interim = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const transcript = result[0].transcript;
				if (result.isFinal) sessionFinal += transcript;
				else interim += transcript;
			}
			value = compose(baseline, sessionFinal + interim);
		};

		r.onerror = (event: SpeechRecognitionErrorEvent) => {
			// `no-speech` / `aborted` are benign — `onend` will handle restart/stop.
			if (event.error === 'no-speech' || event.error === 'aborted') return;
			errorMessage = describeError(event.error);
			wantListening = false;
			listening = false;
		};

		r.onend = () => {
			// Fold finalized text into the baseline so a restart doesn't duplicate it.
			baseline = compose(baseline, sessionFinal);
			sessionFinal = '';
			// Chrome ends the session after silence; restart if the user still wants to dictate.
			if (wantListening && restartGuard < 3) {
				restartGuard++;
				try {
					r.start();
					return;
				} catch {
					// fall through to stop
				}
			}
			wantListening = false;
			listening = false;
		};

		return r;
	}

	async function start() {
		if (!SpeechRecognitionImpl || disabled || listening || starting) return;
		errorMessage = '';
		starting = true;

		// Pre-flight the mic permission explicitly. This surfaces a clear, specific
		// error (blocked, no device, in use) instead of a silent failure, and makes
		// the permission prompt deterministic across browsers.
		try {
			if (navigator.mediaDevices?.getUserMedia) {
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				// We only needed the permission grant; release the tracks immediately.
				stream.getTracks().forEach((t) => t.stop());
			}
		} catch (err) {
			errorMessage = describeError((err as DOMException)?.name ?? '');
			starting = false;
			return;
		}

		baseline = value;
		sessionFinal = '';
		restartGuard = 0;
		wantListening = true;

		const r = makeRecognition();
		try {
			r.start();
			recognition = r;
			listening = true;
		} catch {
			// A stale instance can still be running; reset and report.
			wantListening = false;
			errorMessage = describeError('');
		} finally {
			starting = false;
		}
	}

	function stop() {
		wantListening = false;
		recognition?.stop();
		listening = false;
	}

	function toggle() {
		if (listening) stop();
		else void start();
	}

	function cycleLanguage() {
		// Stop any active session so the next one picks up the new language.
		if (listening) stop();
		errorMessage = '';
		const idx = LANGUAGES.findIndex((l) => l.code === selectedLang);
		selectedLang = LANGUAGES[(idx + 1) % LANGUAGES.length].code;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, selectedLang);
		}
	}

	onDestroy(() => {
		wantListening = false;
		recognition?.abort();
	});

	const label = $derived(
		listening ? 'Stop dictation' : `Dictate with microphone (${currentLanguage.label})`
	);
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
			disabled={disabled || starting}
			aria-label={label}
			aria-pressed={listening}
			title={errorMessage || label}
			class="relative inline-flex items-center justify-center rounded-lg border transition-colors
				disabled:opacity-40 disabled:cursor-not-allowed
				{listening
				? 'border-red-500/50 bg-red-500/15 text-red-400'
				: errorMessage
					? 'border-red-500/40 bg-bg-elevated text-red-400 hover:text-red-300'
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

		{#if errorMessage}
			<!-- Floating, dismissible-on-next-attempt hint so failures are never silent. -->
			<span
				role="alert"
				class="absolute top-full right-0 mt-1 z-50 w-56 rounded-md border border-red-500/40
					bg-bg-elevated px-2.5 py-1.5 text-xs leading-snug text-red-300 shadow-lg"
			>
				{errorMessage}
			</span>
		{/if}
	</span>
{/if}
