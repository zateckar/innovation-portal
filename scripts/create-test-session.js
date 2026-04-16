import { Database } from 'bun:sqlite';

const db = new Database('./data/innovation-radar.db');
const user = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@company.com');
const sessionId = 'test-playwright-session-001';
const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 30;
const now = Math.floor(Date.now() / 1000);
db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at, last_active_at) VALUES (?, ?, ?, ?, ?)').run(sessionId, user.id, expiresAt, now, now);
console.log(sessionId);
db.close();
