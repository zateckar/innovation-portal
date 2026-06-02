// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from '$lib/server/services/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: SessionUser;
			reqId?: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/**
	 * Build-time injected metadata. Populated by the `define` block in
	 * `vite.config.ts` (see readBuildInfo there). Consume via `$lib/build-info`
	 * rather than touching this global directly.
	 */
	const __BUILD_INFO__: {
		version: string;
		gitSha: string;
		gitBranch: string;
		dirty: boolean;
		buildTime: string;
	};

	/** Minimal Web Speech API typings for browser-provided transcription. */
	interface SpeechRecognitionAlternative {
		readonly transcript: string;
		readonly confidence: number;
	}
	interface SpeechRecognitionResult {
		readonly isFinal: boolean;
		readonly length: number;
		item(index: number): SpeechRecognitionAlternative;
		[index: number]: SpeechRecognitionAlternative;
	}
	interface SpeechRecognitionResultList {
		readonly length: number;
		item(index: number): SpeechRecognitionResult;
		[index: number]: SpeechRecognitionResult;
	}
	interface SpeechRecognitionEvent extends Event {
		readonly resultIndex: number;
		readonly results: SpeechRecognitionResultList;
	}
	interface SpeechRecognitionErrorEvent extends Event {
		readonly error: string;
		readonly message: string;
	}
	interface SpeechRecognition extends EventTarget {
		lang: string;
		continuous: boolean;
		interimResults: boolean;
		maxAlternatives: number;
		start(): void;
		stop(): void;
		abort(): void;
		onresult: ((event: SpeechRecognitionEvent) => void) | null;
		onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
		onend: ((event: Event) => void) | null;
		onstart: ((event: Event) => void) | null;
	}
	interface SpeechRecognitionConstructor {
		new (): SpeechRecognition;
	}
	interface Window {
		SpeechRecognition?: SpeechRecognitionConstructor;
		webkitSpeechRecognition?: SpeechRecognitionConstructor;
	}
}

export {};
