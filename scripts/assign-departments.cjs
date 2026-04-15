// One-time script to assign departments to existing innovations
// Run with: bun scripts/assign-departments.cjs

const { Database } = require('bun:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'innovation-radar.db');
const db = new Database(dbPath);

// Title substring → department mappings (first match wins)
const mappings = [
	{ dept: 'production', titles: ['MicroVision MAVIN DR'] },
	{
		dept: 'it',
		titles: [
			'Autonomous AI',
			'Dify',
			'Ollama',
			'Infisical',
			'n8n',
			'Cloud VM',
			'Quack Package',
			'Skir',
			'VMware',
			'WSL Distro',
			'Zero-Knowledge'
		]
	},
	{
		dept: 'rd',
		titles: ['GPT-5.3', 'Beagle', 'Eyot', 'Rust', 'SWE-CI', 'Unsloth', 'uv (Python', 'uv Python']
	}
];

const allRows = db.prepare('SELECT id, title, department FROM innovations').all();
process.stdout.write('Found ' + allRows.length + ' innovations\n');

const update = db.prepare('UPDATE innovations SET department = ? WHERE id = ?');
let updated = 0;

for (const row of allRows) {
	for (const mapping of mappings) {
		const match = mapping.titles.some((t) =>
			row.title.toLowerCase().includes(t.toLowerCase())
		);
		if (match) {
			update.run(mapping.dept, row.id);
			process.stdout.write('  [' + mapping.dept + '] ' + row.title + '\n');
			updated++;
			break;
		}
	}
}

process.stdout.write('Updated ' + updated + ' / ' + allRows.length + ' innovations\n');

// Verify
const after = db.prepare('SELECT department, count(*) as c FROM innovations GROUP BY department').all();
process.stdout.write('Dept counts: ' + JSON.stringify(after) + '\n');

db.close();
