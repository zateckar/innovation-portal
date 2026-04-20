// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from '$lib/server/services/auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: SessionUser;
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
}

export {};
