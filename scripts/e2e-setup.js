// E2E Test Setup: Create a weather idea, add votes to trigger development
import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';

const db = new Database('./data/innovation-radar.db');
const now = Date.now();

// Helper to generate short IDs
function shortId() {
  return randomUUID().replace(/-/g, '').slice(0, 21);
}

// 1. Create the weather idea (published status so it's voteable)
const slug = 'weatherwise-company-weather-dashboard';
let ideaId;

const existing = db.prepare('SELECT id FROM ideas WHERE slug = ?').get(slug);
if (existing) {
  ideaId = existing.id;
  console.log('Idea already exists:', ideaId);
} else {
  ideaId = shortId();
  db.prepare(`INSERT INTO ideas (
    id, slug, title, summary, problem, solution, department,
    status, spec_status, spec_review_status, source, proposed_by, proposed_by_email,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    ideaId,
    slug,
    'WeatherWise - Company Weather Dashboard',
    'A beautiful internal weather dashboard that helps employees plan their commute. Allows picking any city and shows current weather with stunning visuals and a 5-day forecast.',
    'Employees across multiple locations struggle to plan commute. Various weather apps with ads and inconsistent data. Need a clean company-branded weather tool accessible from intranet.',
    'Build an internal weather app with stunning modern UI featuring glassmorphism effects and animated weather icons. Users search for cities, see current weather (temp, conditions, humidity, wind), view 5-day forecast, save favorites. Background changes based on weather.',
    'it',
    'published',
    'not_started',
    'not_ready',
    'user',
    'by2VF8-2lhHSV7kyPRZkl',
    'admin@company.com',
    now,
    now
  );
  console.log('Created idea:', ideaId);
}

// 2. Add votes to cross threshold (default threshold = 5)
// Check current vote count
const voteCount = db.prepare('SELECT COUNT(*) as count FROM idea_votes WHERE idea_id = ?').get(ideaId);
console.log('Current votes:', voteCount.count);

if (voteCount.count < 5) {
  // Get all users
  const users = db.prepare('SELECT id FROM users').all();
  console.log('Available users:', users.length);
  
  // Add the admin's vote
  const adminId = 'by2VF8-2lhHSV7kyPRZkl';
  try {
    db.prepare('INSERT INTO idea_votes (id, user_id, idea_id) VALUES (?, ?, ?)').run(shortId(), adminId, ideaId);
    console.log('Added admin vote');
  } catch (e) {
    console.log('Admin vote exists');
  }

  // Create temporary test users and their votes to cross threshold
  for (let i = 0; i < 5; i++) {
    const userId = shortId();
    const email = `voter${i}@company.com`;
    
    try {
      db.prepare('INSERT INTO users (id, email, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        userId, email, `Voter ${i}`, 'user', now, now
      );
    } catch (e) {
      // User might already exist
    }
    
    try {
      db.prepare('INSERT INTO idea_votes (id, user_id, idea_id) VALUES (?, ?, ?)').run(shortId(), userId, ideaId);
      console.log(`Added vote from voter${i}`);
    } catch (e) {
      console.log(`Vote from voter${i} exists`);
    }
  }
}

const finalVotes = db.prepare('SELECT COUNT(*) as count FROM idea_votes WHERE idea_id = ?').get(ideaId);
console.log('Final vote count:', finalVotes.count);

// 3. Check spec status
const idea = db.prepare('SELECT spec_status, spec_review_status FROM ideas WHERE id = ?').get(ideaId);
console.log('Spec status:', idea.spec_status);
console.log('Review status:', idea.spec_review_status);

// 4. Manually trigger development (set spec_status to in_progress and add opening AI message)
if (idea.spec_status === 'not_started') {
  db.prepare('UPDATE ideas SET spec_status = ? WHERE id = ?').run('in_progress', ideaId);
  
  // Add the AI facilitator's opening message
  db.prepare(`INSERT INTO idea_chats (id, idea_id, user_id, role, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    shortId(),
    ideaId,
    'by2VF8-2lhHSV7kyPRZkl',
    'ai',
    "Welcome to the development phase! I'm the AI Specification Facilitator. I'll help turn this weather dashboard idea into a detailed specification. Let's start with some questions:\n\n**Who are the primary users?** Will this be for all employees, specific departments, or certain roles? Understanding our audience will help design the right experience.",
    now
  );
  
  console.log('Triggered development phase');
}

console.log('\n=== E2E Setup Complete ===');
console.log('Idea slug:', slug);
console.log('Visit: http://localhost:5173/development/' + slug);
console.log('Or: http://localhost:5173/ideas/' + slug);

db.close();
