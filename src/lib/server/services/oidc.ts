import { OAuth2Client, generateState, generateCodeVerifier, CodeChallengeMethod } from 'arctic';
import { env } from '$env/dynamic/private';
import { db, users, settings } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createSession } from './auth';

// OIDC Configuration
async function getOIDCConfig(requestOrigin?: string) {
	const [settingsRow] = await db.select().from(settings).where(eq(settings.id, 'default'));
	const issuer = settingsRow?.oidcIssuer || env.OIDC_ISSUER;
	const clientId = settingsRow?.oidcClientId || env.OIDC_CLIENT_ID;
	// clientSecret is optional — public clients (PKCE-only) omit it
	const clientSecret = settingsRow?.oidcClientSecret || env.OIDC_CLIENT_SECRET || null;
	// Prefer explicit env var, then PUBLIC_APP_URL, then the origin of the incoming request.
	// This prevents "undefined/auth/callback" when PUBLIC_APP_URL is not set in the deployment.
	const appBase = env.OIDC_REDIRECT_URI
		? null // OIDC_REDIRECT_URI is the full URI, used as-is below
		: (env.PUBLIC_APP_URL || requestOrigin || 'http://localhost:3000');
	const redirectUri = env.OIDC_REDIRECT_URI || `${appBase}/auth/callback`;

	return { issuer, clientId, clientSecret, redirectUri };
}

export async function isOIDCConfigured(): Promise<boolean> {
	// No requestOrigin needed here — we only check issuer/clientId, not redirectUri
	const config = await getOIDCConfig();
	// Client secret is optional for public clients (PKCE flows)
	return !!(config.issuer && config.clientId);
}

// Discovery document cache
interface OIDCDiscoveryDocument {
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint: string;
	end_session_endpoint?: string;
}

let discoveryDoc: OIDCDiscoveryDocument | null = null;
let oidcClient: OAuth2Client | null = null;

export async function getDiscoveryDocument(): Promise<OIDCDiscoveryDocument> {
	if (discoveryDoc) {
		return discoveryDoc;
	}

	const config = await getOIDCConfig();
	
	if (!config.issuer) {
		throw new Error('OIDC_ISSUER not configured');
	}

	// Fetch OIDC discovery document
	const discoveryUrl = config.issuer.endsWith('/')
		? `${config.issuer}.well-known/openid-configuration`
		: `${config.issuer}/.well-known/openid-configuration`;

	const response = await fetch(discoveryUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch OIDC discovery document: ${response.statusText}`);
	}

	discoveryDoc = await response.json();
	return discoveryDoc!;
}

async function getOIDCClient(requestOrigin?: string): Promise<OAuth2Client> {
	// The redirect URI is part of the client, so we cannot cache the client when
	// it may vary per request (e.g. when falling back to requestOrigin).
	// Only reuse the cached client when PUBLIC_APP_URL / OIDC_REDIRECT_URI is set,
	// ensuring the redirect URI is stable across requests.
	const hasStableRedirectUri = !!(env.OIDC_REDIRECT_URI || env.PUBLIC_APP_URL);
	if (oidcClient && hasStableRedirectUri) {
		return oidcClient;
	}

	const config = await getOIDCConfig(requestOrigin);
	
	if (!config.clientId) {
		throw new Error('OIDC not configured. Set OIDC_CLIENT_ID (and optionally OIDC_CLIENT_SECRET for confidential clients).');
	}

	// Pass null as secret for public clients — arctic will omit client_secret from token requests
	const client = new OAuth2Client(
		config.clientId,
		config.clientSecret,
		config.redirectUri
	);

	if (hasStableRedirectUri) {
		oidcClient = client;
	}

	return client;
}

export function clearOIDCCache(): void {
	discoveryDoc = null;
	oidcClient = null;
}

export interface OIDCAuthState {
	state: string;
	codeVerifier: string;
}

export async function createAuthorizationURL(requestOrigin?: string): Promise<{ url: URL; state: OIDCAuthState }> {
	const discovery = await getDiscoveryDocument();
	const client = await getOIDCClient(requestOrigin);
	
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const scopes = ['openid', 'profile', 'email'];
	
	const url = client.createAuthorizationURLWithPKCE(
		discovery.authorization_endpoint,
		state,
		CodeChallengeMethod.S256,
		codeVerifier,
		scopes
	);
	
	return {
		url,
		state: { state, codeVerifier }
	};
}

export interface OIDCTokens {
	accessToken: string;
	refreshToken?: string;
	idToken?: string;
}

export async function validateAuthorizationCode(
	code: string,
	codeVerifier: string
): Promise<OIDCTokens> {
	const discovery = await getDiscoveryDocument();
	const client = await getOIDCClient();
	
	const tokens = await client.validateAuthorizationCode(
		discovery.token_endpoint,
		code,
		codeVerifier
	);
	
	let idToken: string | undefined;
	try {
		idToken = tokens.idToken();
	} catch {
		// idToken not present
	}
	
	return {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : undefined,
		idToken
	};
}

export interface OIDCUserInfo {
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
	preferred_username?: string;
}

export async function getUserInfo(accessToken: string): Promise<OIDCUserInfo> {
	const discovery = await getDiscoveryDocument();
	
	const response = await fetch(discovery.userinfo_endpoint, {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch user info: ${response.statusText}`);
	}

	return response.json();
}

export async function findOrCreateOIDCUser(
	userInfo: OIDCUserInfo,
	tokens?: OIDCTokens
): Promise<{
	userId: string;
	sessionId: string;
	isNewUser: boolean;
}> {
	// First, try to find user by OIDC subject
	let [existingUser] = await db
		.select()
		.from(users)
		.where(eq(users.oidcSubject, userInfo.sub));

	if (existingUser) {
		// Update last login
		await db.update(users)
			.set({ lastLoginAt: new Date() })
			.where(eq(users.id, existingUser.id));
		
		const sessionId = await createSession(existingUser.id, tokens);
		return { userId: existingUser.id, sessionId, isNewUser: false };
	}

	// Try to find by email and link account
	if (userInfo.email) {
		[existingUser] = await db
			.select()
			.from(users)
			.where(eq(users.email, userInfo.email.toLowerCase()));

		if (existingUser) {
			// Link OIDC to existing account
			await db.update(users)
				.set({ 
					oidcSubject: userInfo.sub,
					lastLoginAt: new Date(),
					// Optionally update avatar if they don't have one
					...(userInfo.picture && !existingUser.avatarUrl ? { avatarUrl: userInfo.picture } : {})
				})
				.where(eq(users.id, existingUser.id));
			
			const sessionId = await createSession(existingUser.id, tokens);
			return { userId: existingUser.id, sessionId, isNewUser: false };
		}
	}

	// Create new user
	const userId = nanoid();
	const name = userInfo.name || userInfo.preferred_username || userInfo.email?.split('@')[0] || 'User';
	const email = userInfo.email?.toLowerCase() || `${userInfo.sub}@oidc.local`;

	await db.insert(users).values({
		id: userId,
		email,
		name,
		avatarUrl: userInfo.picture || null,
		authProvider: 'oidc',
		oidcSubject: userInfo.sub
	});

	const sessionId = await createSession(userId, tokens);
	return { userId, sessionId, isNewUser: true };
}
