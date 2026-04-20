/**
 * Workspace Identity — sign/verify the user identity headers forwarded
 * by the proxy to spawned workspace child apps.
 *
 * Without signing, anyone who can reach the child app's localhost port
 * (sibling containers, the AI's shell tools, an attacker who pivots
 * inside the host) can spoof `x-user-role: admin` and become anyone.
 *
 * The signature uses HMAC-SHA-256 with a per-portal-process secret
 * generated at boot. The proxy stamps `x-user-sig` with the HMAC and
 * `x-user-sig-ts` with a 5-minute timestamp; the child app (when AI
 * code respects the contract) verifies these.
 *
 * Even if AI-generated apps don't enforce verification, the signature
 * provides a tamper-evidence channel for code that opts in.
 *
 * The shared secret is also exposed via `getWorkspaceIdentitySecret()`
 * and passed to children as `WORKSPACE_IDENTITY_SECRET` so their code
 * can validate when desired.
 */
import { createHmac, randomBytes } from 'crypto';

let secret: Buffer | null = null;

function getSecret(): Buffer {
	if (secret) return secret;
	// Prefer an env-provided secret so it survives portal restarts
	// (otherwise inflight requests during a restart would get fresh
	// signatures the children don't recognise yet — minor issue today
	// because children don't enforce verification).
	const fromEnv = process.env.WORKSPACE_IDENTITY_SECRET;
	if (fromEnv && fromEnv.length >= 16) {
		secret = Buffer.from(fromEnv, 'utf-8');
	} else {
		secret = randomBytes(32);
		// Make the generated secret available to children spawned later in
		// this process so they can verify (when their code chooses to).
		process.env.WORKSPACE_IDENTITY_SECRET = secret.toString('hex');
	}
	return secret;
}

export interface ForwardedIdentity {
	id: string;
	email: string;
	name: string;
	role: string;
	department: string | null;
}

export function signIdentity(id: ForwardedIdentity, ts: number = Date.now()): string {
	const payload = `${ts}.${id.id}.${id.email}.${id.role}.${id.department ?? ''}`;
	return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function getWorkspaceIdentitySecret(): string {
	return getSecret().toString('hex');
}
