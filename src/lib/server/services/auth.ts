import { db, getRawDb, users, sessions, type User, type NewUser } from '$lib/server/db';
import { eq, lt, and } from 'drizzle-orm';
const SESSION_DURATION_DAYS = 30;
// Sessions idle for longer than this are treated as expired on renewal
const SESSION_IDLE_TIMEOUT_DAYS = 7;

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	avatarUrl: string | null;
	role: 'user' | 'admin';
	department?: string | null;
	accessToken?: string | null;
}

export async function createUser(data: {
	email: string;
	password: string;
	name: string;
}): Promise<User> {
	const passwordHash = await Bun.password.hash(data.password, { algorithm: 'bcrypt', cost: 12 });
	const id = crypto.randomUUID();
	
	const [user] = await db.insert(users).values({
		id,
		email: data.email.toLowerCase(),
		name: data.name,
		passwordHash,
		authProvider: 'local'
	}).returning();
	
	return user;
}

export async function verifyCredentials(email: string, password: string): Promise<User | null> {
	const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
	
	if (!user || !user.passwordHash) {
		return null;
	}
	
	const valid = await Bun.password.verify(password, user.passwordHash);
	if (!valid) {
		return null;
	}
	
	// Update last login
	await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
	
	return user;
}

export async function createSession(
	userId: string,
	tokens?: { accessToken?: string; refreshToken?: string }
): Promise<string> {
	const sessionId = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
	
	await db.insert(sessions).values({
		id: sessionId,
		userId,
		expiresAt,
		accessToken: tokens?.accessToken ?? null,
		refreshToken: tokens?.refreshToken ?? null
	});
	
	return sessionId;
}

export async function validateSession(sessionId: string): Promise<SessionUser | null> {
	const result = await db
		.select({
			session: sessions,
			user: users
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId));
	
	if (result.length === 0) {
		return null;
	}
	
	const { session, user } = result[0];
	
	// Check if session expired
	if (session.expiresAt < new Date()) {
		await deleteSession(sessionId);
		return null;
	}
	
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		avatarUrl: user.avatarUrl,
		role: user.role as 'user' | 'admin',
		department: user.department,
		accessToken: session.accessToken
	};
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Sliding session renewal: extends the session expiry and updates lastActiveAt.
 * Also enforces an idle timeout: if the session has not been active within
 * SESSION_IDLE_TIMEOUT_DAYS, it is deleted rather than renewed.
 */
export async function renewSession(sessionId: string): Promise<void> {
	const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
	if (!session) return;

	// Enforce idle timeout
	const idleCutoff = new Date(Date.now() - SESSION_IDLE_TIMEOUT_DAYS * 24 * 60 * 60 * 1000);
	if (session.lastActiveAt && session.lastActiveAt < idleCutoff) {
		await deleteSession(sessionId);
		return;
	}

	// Extend absolute expiry and bump lastActiveAt
	const newExpiry = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
	await db.update(sessions)
		.set({ expiresAt: newExpiry, lastActiveAt: new Date() })
		.where(eq(sessions.id, sessionId));
}

/**
 * Delete all expired and idle sessions. Safe to call periodically.
 * Returns the number of sessions deleted.
 */
export async function cleanupExpiredSessions(): Promise<number> {
	const now = new Date();
	const idleCutoff = new Date(Date.now() - SESSION_IDLE_TIMEOUT_DAYS * 24 * 60 * 60 * 1000);

	// Delete sessions that are expired OR have been idle too long
	await db.delete(sessions).where(lt(sessions.expiresAt, now));
	const expiredCount = getRawDb().query<{ n: number }, []>('SELECT changes() as n').get()?.n ?? 0;

	// Also clean up idle sessions
	await db.delete(sessions).where(lt(sessions.lastActiveAt, idleCutoff));
	const idleCount = getRawDb().query<{ n: number }, []>('SELECT changes() as n').get()?.n ?? 0;

	const total = expiredCount + idleCount;
	if (total > 0) {
		console.log(`[auth] Cleaned up ${total} expired/idle sessions`);
	}
	return total;
}

export async function getUserById(userId: string): Promise<User | null> {
	const [user] = await db.select().from(users).where(eq(users.id, userId));
	return user || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
	const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
	return user || null;
}

/**
 * Initialize admin user from environment variables if no admin exists.
 * This runs once on application startup for production deployments.
 */
export async function initializeAdminFromEnv(): Promise<void> {
	const email = process.env.INIT_ADMIN_EMAIL;
	const password = process.env.INIT_ADMIN_PASSWORD;
	const name = process.env.INIT_ADMIN_NAME || 'Admin';

	// Skip if env vars not configured
	if (!email || !password) {
		return;
	}

	// Check if any admin already exists
	const existingAdmins = await db.select().from(users).where(eq(users.role, 'admin'));
	if (existingAdmins.length > 0) {
		return;
	}

	// Create initial admin user
	const passwordHash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 });
	const id = crypto.randomUUID();

	try {
		await db.insert(users).values({
			id,
			email: email.toLowerCase(),
			name,
			passwordHash,
			authProvider: 'local',
			role: 'admin'
		});
		console.log(`[init] Created initial admin user: ${email}`);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		// Distinguish a benign "already exists" constraint violation from real DB errors
		if (msg.includes('UNIQUE constraint') || msg.includes('unique constraint')) {
			console.log(`[init] Admin user already exists (${email}), skipping creation`);
		} else {
			// A genuine DB error (e.g., DB locked, schema mismatch) — log as critical
			console.error(`[init] Failed to create admin user (${email}):`, e);
		}
	}
}
