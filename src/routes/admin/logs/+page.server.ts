import type { PageServerLoad } from './$types';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const load: PageServerLoad = async ({ url }) => {
	const logFile = process.env.LOG_FILE || 'server.log';
	const logPath = join(process.cwd(), logFile);
	
	let logs: string[] = [];
	let logExists = false;
	
	if (existsSync(logPath)) {
		logExists = true;
		try {
			const content = readFileSync(logPath, 'utf-8');
			logs = content.split('\n').filter(line => line.trim());
		} catch (e) {
			console.error('Error reading log file:', e);
		}
	}
	
	// Get the last N lines (default 500)
	const limit = parseInt(url.searchParams.get('limit') || '500');
	const filteredLogs = logs.slice(-limit).reverse();
	
	return {
		logs: filteredLogs,
		logExists,
		logFile,
		totalLines: logs.length
	};
};
