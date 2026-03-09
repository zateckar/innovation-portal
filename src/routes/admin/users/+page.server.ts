import type { PageServerLoad, Actions } from './$types';
import { db, users } from '$lib/server/db';
import { eq, desc, or, like } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('search') || '';
	const filter = url.searchParams.get('filter') || 'all';
	
	let userList;
	
	if (search) {
		userList = await db.select()
			.from(users)
			.where(or(like(users.email, `%${search}%`), like(users.name, `%${search}%`)))
			.orderBy(desc(users.createdAt))
			.limit(100);
	} else if (filter === 'local') {
		userList = await db.select()
			.from(users)
			.where(eq(users.authProvider, 'local'))
			.orderBy(desc(users.createdAt))
			.limit(100);
	} else if (filter === 'oidc') {
		userList = await db.select()
			.from(users)
			.where(eq(users.authProvider, 'oidc'))
			.orderBy(desc(users.createdAt))
			.limit(100);
	} else if (filter === 'admins') {
		userList = await db.select()
			.from(users)
			.where(eq(users.role, 'admin'))
			.orderBy(desc(users.createdAt))
			.limit(100);
	} else if (filter === 'users') {
		userList = await db.select()
			.from(users)
			.where(eq(users.role, 'user'))
			.orderBy(desc(users.createdAt))
			.limit(100);
	} else {
		userList = await db.select()
			.from(users)
			.orderBy(desc(users.createdAt))
			.limit(100);
	}
	
	const stats = {
		total: await db.select().from(users).then(r => r.length),
		local: await db.select().from(users).where(eq(users.authProvider, 'local')).then(r => r.length),
		oidc: await db.select().from(users).where(eq(users.authProvider, 'oidc')).then(r => r.length),
		admins: await db.select().from(users).where(eq(users.role, 'admin')).then(r => r.length)
	};
	
	return {
		users: userList,
		stats,
		search,
		filter
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		
		const email = (formData.get('email') as string)?.trim().toLowerCase();
		const password = formData.get('password') as string;
		const name = (formData.get('name') as string)?.trim();
		const role = formData.get('role') as string || 'user';
		
		if (!email || !password || !name) {
			return fail(400, { error: 'Email, password, and name are required' });
		}
		
		if (password.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters' });
		}
		
		if (!['user', 'admin'].includes(role)) {
			return fail(400, { error: 'Invalid role' });
		}
		
		try {
			const existing = await db.select().from(users).where(eq(users.email, email));
			if (existing.length > 0) {
				return fail(400, { error: 'A user with this email already exists' });
			}
			
			const passwordHash = await bcrypt.hash(password, 12);
			const id = nanoid();
			
			await db.insert(users).values({
				id,
				email,
				name,
				passwordHash,
				role: role as 'user' | 'admin',
				authProvider: 'local'
			});
			
			return { success: true, message: `User "${name}" created successfully` };
		} catch (error) {
			console.error('Error creating user:', error);
			return fail(500, { error: 'Failed to create user' });
		}
	},
	
	updateRole: async ({ request }) => {
		const formData = await request.formData();
		
		const userId = formData.get('userId') as string;
		const role = formData.get('role') as string;
		
		if (!userId || !['user', 'admin'].includes(role)) {
			return fail(400, { error: 'Invalid request' });
		}
		
		try {
			await db.update(users)
				.set({ role: role as 'user' | 'admin' })
				.where(eq(users.id, userId));
			
			return { success: true, message: 'User role updated' };
		} catch (error) {
			return fail(500, { error: 'Failed to update role' });
		}
	},
	
	delete: async ({ request }) => {
		const formData = await request.formData();
		
		const userId = formData.get('userId') as string;
		
		if (!userId) {
			return fail(400, { error: 'Invalid request' });
		}
		
		try {
			await db.delete(users).where(eq(users.id, userId));
			return { success: true, message: 'User deleted' };
		} catch (error) {
			return fail(500, { error: 'Failed to delete user' });
		}
	},
	
	resetPassword: async ({ request }) => {
		const formData = await request.formData();
		
		const userId = formData.get('userId') as string;
		const newPassword = formData.get('newPassword') as string;
		
		if (!userId || !newPassword || newPassword.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters' });
		}
		
		try {
			const [user] = await db.select().from(users).where(eq(users.id, userId));
			if (!user || user.authProvider !== 'local') {
				return fail(400, { error: 'Can only reset password for local users' });
			}
			
			const passwordHash = await bcrypt.hash(newPassword, 12);
			await db.update(users)
				.set({ passwordHash })
				.where(eq(users.id, userId));
			
			return { success: true, message: 'Password reset successfully' };
		} catch (error) {
			return fail(500, { error: 'Failed to reset password' });
		}
	}
};
