import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { createUser, createSession, getUserByEmail } from '$lib/server/services/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString();
		const password = formData.get('password')?.toString();
		const confirmPassword = formData.get('confirmPassword')?.toString();
		const name = formData.get('name')?.toString();
		
		if (!email || !password || !name) {
			return fail(400, { error: 'All fields are required', email, name });
		}
		
		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters', email, name });
		}
		
		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match', email, name });
		}
		
		// Check if user already exists
		const existingUser = await getUserByEmail(email);
		if (existingUser) {
			return fail(400, { error: 'An account with this email already exists', email, name });
		}
		
		try {
			const user = await createUser({ email, password, name });
			const sessionId = await createSession(user.id);
			
			cookies.set('session', sessionId, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 60 * 60 * 24 * 30 // 30 days
			});
			
			throw redirect(302, '/');
		} catch (error) {
			if (error instanceof Response) throw error; // Re-throw redirects
			console.error('Registration error:', error);
			return fail(500, { error: 'Failed to create account', email, name });
		}
	}
};
