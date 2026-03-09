import type { Handle } from '@sveltejs/kit';
import { validateSession, initializeAdminFromEnv, type SessionUser } from '$lib/server/services/auth';
import { initializeJobs } from '$lib/server/jobs/scheduler';
import { appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Intercept console output and tee it to a log file
const logFile = process.env.LOG_FILE || 'server.log';
const logPath = join(process.cwd(), logFile);
try {
	mkdirSync(dirname(logPath), { recursive: true });
} catch {
	// Directory already exists or cannot be created — proceed without file logging
}

function writeToLog(level: string, args: unknown[]) {
	try {
		const timestamp = new Date().toISOString();
		const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
		appendFileSync(logPath, `[${timestamp}] [${level}] ${message}\n`, 'utf-8');
	} catch {
		// Silently ignore file write errors to avoid infinite recursion
	}
}

const _consoleLog = console.log.bind(console);
const _consoleInfo = console.info.bind(console);
const _consoleWarn = console.warn.bind(console);
const _consoleError = console.error.bind(console);

console.log = (...args: unknown[]) => { _consoleLog(...args); writeToLog('INFO', args); };
console.info = (...args: unknown[]) => { _consoleInfo(...args); writeToLog('INFO', args); };
console.warn = (...args: unknown[]) => { _consoleWarn(...args); writeToLog('WARN', args); };
console.error = (...args: unknown[]) => { _consoleError(...args); writeToLog('ERROR', args); };

// Initialize admin from environment variables on startup (runs once)
const initPromise = initializeAdminFromEnv();
initializeJobs();

export const handle: Handle = async ({ event, resolve }) => {
	// Ensure initialization completes before handling requests
	await initPromise;

	const sessionId = event.cookies.get('session');
	
	if (sessionId) {
		const user = await validateSession(sessionId);
		if (user) {
			event.locals.user = user;
		} else {
			// Invalid or expired session, clear cookie
			event.cookies.delete('session', { path: '/' });
		}
	}
	
	return resolve(event);
};
