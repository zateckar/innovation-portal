import { db, users, sessions, type User, type NewUser } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const SESSION_DURATION_DAYS = 30;

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	avatarUrl: string | null;
	role: 'user' | 'admin';
	accessToken?: string | null;
}

export async function createUser(data: {
	email: string;
	password: string;
	name: string;
}): Promise<User> {
	const passwordHash = await bcrypt.hash(data.password, 12);
	const id = nanoid();
	
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
	
	const valid = await bcrypt.compare(password, user.passwordHash);
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
	const sessionId = nanoid(32);
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
		accessToken: session.accessToken
	};
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
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
	const passwordHash = await bcrypt.hash(password, 12);
	const id = nanoid();

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
		// User might already exist (race condition or retry)
		console.log(`[init] Admin user already exists or creation failed`);
	}
}
