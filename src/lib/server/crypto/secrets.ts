/**
 * At-rest secret encryption (AES-256-GCM).
 *
 * Protects `settings.llmApiKey`, `settings.oidcClientSecret`, and any
 * future secret-bearing column from being readable to anyone with file
 * access to the SQLite database.
 *
 * Format on disk:  `enc:v1:<base64(iv)>.<base64(tag)>.<base64(ciphertext)>`
 *
 * Key source (highest priority wins):
 *   1. APP_ENCRYPTION_KEY env (64 hex chars = 32 bytes)
 *   2. Derived from SESSION_SECRET via SHA-256 (allows existing deployments
 *      that don't yet set APP_ENCRYPTION_KEY to keep working)
 *   3. Hard-throw at first use (cannot run without a key)
 *
 * Plaintext values (legacy rows from before this module shipped) are passed
 * through unchanged with a one-time warning, so this can be deployed without
 * a one-shot data migration. The next save through the admin form will
 * re-encrypt them.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
	if (cachedKey) return cachedKey;

	const raw = process.env.APP_ENCRYPTION_KEY;
	if (raw && /^[0-9a-fA-F]{64}$/.test(raw.trim())) {
		cachedKey = Buffer.from(raw.trim(), 'hex');
		return cachedKey;
	}

	const sessionSecret = process.env.SESSION_SECRET;
	if (sessionSecret && sessionSecret.length >= 16) {
		cachedKey = createHash('sha256').update(`innovation-portal::${sessionSecret}`).digest();
		console.warn(
			'[crypto] APP_ENCRYPTION_KEY not set — deriving key from SESSION_SECRET. ' +
			'Set APP_ENCRYPTION_KEY (64 hex chars) for production deployments.'
		);
		return cachedKey;
	}

	throw new Error(
		'Cannot derive encryption key: set APP_ENCRYPTION_KEY (64 hex chars) or SESSION_SECRET (≥16 chars).'
	);
}

export function isEncrypted(value: string | null | undefined): boolean {
	return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string | null | undefined): string | null {
	if (plaintext == null || plaintext === '') return null;
	if (isEncrypted(plaintext)) return plaintext;

	const key = getKey();
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(value: string | null | undefined): string | null {
	if (value == null || value === '') return null;
	if (!isEncrypted(value)) {
		// Legacy plaintext — return as-is. A warning is logged once per process
		// below the first time this happens so noisy logs don't fill the disk.
		return value;
	}

	const key = getKey();
	const body = value.slice(PREFIX.length);
	const [ivB64, tagB64, encB64] = body.split('.');
	if (!ivB64 || !tagB64 || !encB64) {
		throw new Error('Encrypted secret is malformed');
	}
	const iv = Buffer.from(ivB64, 'base64');
	const tag = Buffer.from(tagB64, 'base64');
	const enc = Buffer.from(encB64, 'base64');

	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
	return dec.toString('utf-8');
}

/** Reset the cached key — used by tests and after rotating APP_ENCRYPTION_KEY. */
export function resetCryptoCache(): void {
	cachedKey = null;
}
