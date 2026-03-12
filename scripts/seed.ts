import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/lib/server/db/schema';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const sqlite = new Database('./data/innovation-radar.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite, { schema });

async function seed() {
	console.log('Seeding database...');
	
	// Create admin user
	const adminPasswordHash = await bcrypt.hash('admin123', 12);
	const adminId = nanoid();
	
	try {
		await db.insert(schema.users).values({
			id: adminId,
			email: 'admin@company.com',
			name: 'Admin User',
			role: 'admin',
			authProvider: 'local',
			passwordHash: adminPasswordHash
		});
		console.log('Created admin user: admin@company.com / admin123');
	} catch (e) {
		console.log('Admin user already exists');
	}
	
	// Create demo user
	const demoPasswordHash = await bcrypt.hash('demo123', 12);
	const demoId = nanoid();
	
	try {
		await db.insert(schema.users).values({
			id: demoId,
			email: 'demo@company.com',
			name: 'Demo User',
			role: 'user',
			authProvider: 'local',
			passwordHash: demoPasswordHash
		});
		console.log('Created demo user: demo@company.com / demo123');
	} catch (e) {
		console.log('Demo user already exists');
	}
	
	// Create default sources
	const sources = [
		{
			id: nanoid(),
			name: 'Hacker News',
			type: 'api' as const,
			url: 'https://hacker-news.firebaseio.com',
			scanIntervalMinutes: 120,
			enabled: true
		},
		{
			id: nanoid(),
			name: 'Ars Technica',
			type: 'rss' as const,
			url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
			scanIntervalMinutes: 240,
			enabled: true
		},
		{
			id: nanoid(),
			name: 'TechCrunch',
			type: 'rss' as const,
			url: 'https://techcrunch.com/feed/',
			scanIntervalMinutes: 240,
			enabled: true
		},
		{
			id: nanoid(),
			name: "Tom's Hardware",
			type: 'rss' as const,
			url: 'https://www.tomshardware.com/feeds.xml',
			scanIntervalMinutes: 240,
			enabled: true
		},
		{
			id: nanoid(),
			name: 'ZDNet',
			type: 'rss' as const,
			url: 'https://zdnet.com/news/rss.xml',
			scanIntervalMinutes: 240,
			enabled: true
		}
	];
	
	for (const source of sources) {
		try {
			await db.insert(schema.sources).values(source);
			console.log(`Created source: ${source.name}`);
		} catch (e) {
			console.log(`Source ${source.name} already exists`);
		}
	}
	
	// Create sample innovations
	const sampleInnovations = [
		{
			id: nanoid(),
			slug: 'ollama-local-llm-runner',
			title: 'Ollama',
			tagline: 'Run large language models locally with a simple command-line interface',
			category: 'ai-ml' as const,
			researchData: JSON.stringify({
				executiveSummary: 'Ollama is an open-source tool that makes running large language models (LLMs) locally as simple as running a Docker container. It packages model weights, configuration, and everything needed to run models like Llama 2, Mistral, and CodeLlama into a single, easy-to-use interface.\n\nFor an automotive company modernizing IT, Ollama offers a way to experiment with AI capabilities without cloud dependencies, ensuring data privacy and reducing ongoing costs. It can power internal chatbots, code assistants, and documentation generators.',
				keyBenefits: [
					'Run LLMs completely offline - no data leaves your network',
					'Simple CLI interface - get started in minutes',
					'Supports multiple models including Llama 2, Mistral, CodeLlama',
					'Low resource requirements compared to other solutions',
					'Active community and regular updates'
				],
				useCases: [
					'Internal code review assistant for development teams',
					'Documentation generation for legacy systems',
					'Private chatbot for employee queries',
					'Automated test case generation'
				],
				competitors: [
					{ name: 'LM Studio', url: 'https://lmstudio.ai', comparison: 'GUI-focused, less suitable for automation' },
					{ name: 'LocalAI', url: 'https://localai.io', comparison: 'More complex setup, more features' }
				],
				prosAndCons: {
					pros: ['Extremely easy to set up', 'Fully open source', 'Active development', 'Great documentation'],
					cons: ['Limited to supported models', 'Requires decent hardware for larger models']
				},
				requiredSkills: ['Command line basics', 'Docker (optional)'],
				estimatedTimeToMVP: '1-2 days',
				sources: [{ url: 'https://ollama.ai', title: 'Ollama Official Site', type: 'original' }]
			}),
			relevanceScore: 9.2,
			innovationScore: 8.5,
			actionabilityScore: 9.0,
			isOpenSource: true,
			isSelfHosted: true,
			hasAiComponent: true,
			maturityLevel: 'stable' as const,
			license: 'MIT',
			githubUrl: 'https://github.com/ollama/ollama',
			documentationUrl: 'https://ollama.ai/docs',
			status: 'published' as const,
			publishedAt: new Date()
		},
		{
			id: nanoid(),
			slug: 'n8n-workflow-automation',
			title: 'n8n',
			tagline: 'Fair-code workflow automation platform with 400+ integrations',
			category: 'automation' as const,
			researchData: JSON.stringify({
				executiveSummary: 'n8n is a workflow automation tool that allows you to connect various apps and services through a visual interface. Unlike Zapier or Make, n8n can be self-hosted, giving you full control over your data and workflows.\n\nFor enterprise IT modernization, n8n can automate repetitive tasks across departments, from HR onboarding to IT ticketing, all while keeping sensitive data on-premises.',
				keyBenefits: [
					'Self-hosted - full data sovereignty',
					'400+ pre-built integrations',
					'Visual workflow builder - no coding required',
					'Can be extended with custom JavaScript nodes',
					'Active community and marketplace'
				],
				useCases: [
					'Automated employee onboarding workflows',
					'IT ticketing system integrations',
					'Data synchronization between legacy and modern systems',
					'Automated reporting and notifications'
				],
				competitors: [
					{ name: 'Zapier', url: 'https://zapier.com', comparison: 'Cloud-only, expensive at scale' },
					{ name: 'Make (Integromat)', url: 'https://make.com', comparison: 'Cloud-only, complex pricing' }
				],
				prosAndCons: {
					pros: ['Self-hosted option', 'Fair-code license', 'Extensive integrations', 'Active community'],
					cons: ['Steeper learning curve than Zapier', 'Self-hosting requires maintenance']
				},
				requiredSkills: ['Basic IT administration', 'Docker'],
				estimatedTimeToMVP: '1 week',
				sources: [{ url: 'https://n8n.io', title: 'n8n Official Site', type: 'original' }]
			}),
			relevanceScore: 8.8,
			innovationScore: 7.5,
			actionabilityScore: 8.5,
			isOpenSource: true,
			isSelfHosted: true,
			hasAiComponent: false,
			maturityLevel: 'mature' as const,
			license: 'Fair-code',
			githubUrl: 'https://github.com/n8n-io/n8n',
			documentationUrl: 'https://docs.n8n.io',
			status: 'published' as const,
			publishedAt: new Date()
		},
		{
			id: nanoid(),
			slug: 'dify-llm-app-platform',
			title: 'Dify',
			tagline: 'Open-source platform for building LLM-powered applications',
			category: 'ai-ml' as const,
			researchData: JSON.stringify({
				executiveSummary: 'Dify is an open-source LLM app development platform that combines Backend-as-a-Service with LLMOps. It provides a visual interface for creating AI applications, managing prompts, and deploying AI agents.\n\nFor enterprise use, Dify enables teams to build internal AI tools without deep ML expertise, accelerating the adoption of AI across departments.',
				keyBenefits: [
					'Visual prompt engineering and testing',
					'Support for multiple LLM providers',
					'Built-in RAG (Retrieval Augmented Generation)',
					'Agent workflows with tool integration',
					'Enterprise-grade security features'
				],
				useCases: [
					'Internal knowledge base chatbot',
					'Document Q&A system for compliance',
					'Customer service automation',
					'Code documentation assistant'
				],
				competitors: [
					{ name: 'Flowise', url: 'https://flowiseai.com', comparison: 'Simpler but fewer features' },
					{ name: 'LangFlow', url: 'https://langflow.org', comparison: 'More developer-focused' }
				],
				prosAndCons: {
					pros: ['Comprehensive feature set', 'Beautiful UI', 'Active development', 'Good documentation'],
					cons: ['Resource intensive', 'Complexity can be overwhelming']
				},
				requiredSkills: ['Docker', 'Basic understanding of LLMs'],
				estimatedTimeToMVP: '2 weeks',
				sources: [{ url: 'https://dify.ai', title: 'Dify Official Site', type: 'original' }]
			}),
			relevanceScore: 8.5,
			innovationScore: 9.0,
			actionabilityScore: 7.5,
			isOpenSource: true,
			isSelfHosted: true,
			hasAiComponent: true,
			maturityLevel: 'stable' as const,
			license: 'Apache 2.0',
			githubUrl: 'https://github.com/langgenius/dify',
			documentationUrl: 'https://docs.dify.ai',
			status: 'published' as const,
			publishedAt: new Date()
		},
		{
			id: nanoid(),
			slug: 'infisical-secrets-management',
			title: 'Infisical',
			tagline: 'Open-source secret management platform for teams',
			category: 'security' as const,
			researchData: JSON.stringify({
				executiveSummary: 'Infisical is an open-source secret management platform that helps teams centralize and manage secrets like API keys, database credentials, and configuration files across their infrastructure.\n\nFor automotive IT modernization, proper secrets management is critical for security compliance. Infisical provides a developer-friendly alternative to enterprise solutions like HashiCorp Vault.',
				keyBenefits: [
					'End-to-end encryption of secrets',
					'Native integrations with CI/CD pipelines',
					'Automatic secret rotation',
					'Audit logging for compliance',
					'Role-based access control'
				],
				useCases: [
					'Centralized API key management',
					'Secure configuration for microservices',
					'CI/CD pipeline secrets injection',
					'Compliance audit trails'
				],
				competitors: [
					{ name: 'HashiCorp Vault', url: 'https://vaultproject.io', comparison: 'More complex, enterprise-focused' },
					{ name: 'Doppler', url: 'https://doppler.com', comparison: 'Cloud-only, simpler' }
				],
				prosAndCons: {
					pros: ['Easy to set up', 'Great developer experience', 'Self-hosted option', 'Active development'],
					cons: ['Younger project than Vault', 'Smaller community']
				},
				requiredSkills: ['Basic DevOps', 'Docker'],
				estimatedTimeToMVP: '3-5 days',
				sources: [{ url: 'https://infisical.com', title: 'Infisical Official Site', type: 'original' }]
			}),
			relevanceScore: 8.7,
			innovationScore: 7.8,
			actionabilityScore: 8.8,
			isOpenSource: true,
			isSelfHosted: true,
			hasAiComponent: false,
			maturityLevel: 'stable' as const,
			license: 'MIT',
			githubUrl: 'https://github.com/Infisical/infisical',
			documentationUrl: 'https://infisical.com/docs',
			status: 'published' as const,
			publishedAt: new Date()
		}
	];
	
	for (const innovation of sampleInnovations) {
		try {
			await db.insert(schema.innovations).values(innovation);
			console.log(`Created innovation: ${innovation.title}`);
		} catch (e) {
			console.log(`Innovation ${innovation.title} already exists`);
		}
	}
	
	// Add some votes
	const existingInnovations = await db.select().from(schema.innovations);
	const existingUsers = await db.select().from(schema.users);
	
	if (existingInnovations.length > 0 && existingUsers.length > 0) {
		for (const user of existingUsers) {
			// Each user votes for 2 random innovations
			const randomInnovations = existingInnovations
				.sort(() => Math.random() - 0.5)
				.slice(0, 2);
			
			for (const innovation of randomInnovations) {
				try {
					await db.insert(schema.votes).values({
						id: nanoid(),
						userId: user.id,
						innovationId: innovation.id
					});
				} catch (e) {
					// Vote already exists
				}
			}
		}
		console.log('Added sample votes');
	}
	
	console.log('Seeding complete!');
	console.log('\nTest accounts:');
	console.log('  Admin: admin@company.com / admin123');
	console.log('  User:  demo@company.com / demo123');
}

seed().catch(console.error).finally(() => process.exit(0));
