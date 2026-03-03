# Innovation Radar - Design Document

## Executive Summary

The **Innovation Radar** is an AI-powered internal platform for a legacy automotive company (7,000 office workers, 25,000 assembly workers) to discover, evaluate, and implement IT innovations. The platform automates the scanning of tech news sources, uses AI to research and present innovations, and enables democratic voting to prioritize implementations.

---

## 1. System Overview

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INNOVATION RADAR                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   SCANNER    │───▶│  RESEARCHER  │───▶│  PRESENTER   │                   │
│  │   (Scraper)  │    │  (AI Agent)  │    │  (UI/API)    │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SQLite Database                              │    │
│  │  [Sources] [RawFeeds] [Innovations] [Research] [Votes] [Users]      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | SvelteKit + TailwindCSS | Fast, modern, excellent DX |
| Backend | SvelteKit API Routes | Unified codebase, SSR support |
| Database | SQLite (via Drizzle ORM) | Simple, embedded, sufficient for dozens of users |
| Auth | Local accounts + OIDC | Corporate SSO + fallback |
| AI/LLM | Google Gemini API | Cost-effective, good for research tasks |
| Scheduling | node-cron | Background jobs for scanning |
| Deployment | Docker / PM2 | Self-hosted, single server |

---

## 2. Feature Specifications

### 2.1 Innovation Scanner (Automated Ingestion)

#### Supported Sources

| Source | Type | URL/Feed | Frequency |
|--------|------|----------|-----------|
| Hacker News | API | `news.ycombinator.com/api` | Every 2 hours |
| Ars Technica | RSS | `/feeds/arstechnica/` | Every 4 hours |
| TechCrunch | RSS | `/feed/` | Every 4 hours |
| GitHub Trending | Web Scrape | `/trending` | Every 6 hours |
| Product Hunt | API | GraphQL API | Daily |
| ArXiv CS | RSS | `/rss/cs.AI`, `/rss/cs.SE` | Daily |
| Dev.to | RSS | `/feed` | Every 4 hours |

#### Scanner Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Fetch Feed  │────▶│ Parse Items │────▶│ Deduplicate │────▶│ AI Filter   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                          ┌─────────────────┐
                                                          │ Store Candidates│
                                                          └─────────────────┘
```

#### AI Filtering Criteria (Gemini Prompt)

The scanner uses AI to filter raw feeds for relevance:

```
Evaluate if this article describes an actionable IT innovation suitable for 
an automotive company modernizing their IT infrastructure.

PREFER:
- Open source / self-hosted solutions
- AI/ML-powered tools
- Developer productivity improvements
- Enterprise automation
- Data analytics / BI tools
- DevOps / Platform engineering
- Security improvements

REJECT:
- Consumer products
- Gaming/Entertainment
- Crypto/Web3 (unless enterprise blockchain)
- Pure research without practical application
- Vendor-locked cloud-only solutions
```

---

### 2.2 Innovation Researcher (AI Agent)

Once an item passes filtering, the AI Researcher performs deep analysis:

#### Research Pipeline

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         RESEARCH AGENT WORKFLOW                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: CONTEXT GATHERING                                                  │
│  ├── Fetch original article                                                 │
│  ├── Search for related articles (3-5 sources)                             │
│  ├── Find official project page / GitHub repo                              │
│  └── Locate documentation                                                   │
│                                                                             │
│  Step 2: ANALYSIS                                                           │
│  ├── Extract core innovation description                                    │
│  ├── Identify key benefits                                                  │
│  ├── Find alternatives / competitors                                        │
│  ├── Assess maturity (alpha/beta/stable)                                   │
│  ├── Check license (OSS preferred)                                         │
│  └── Estimate implementation effort                                         │
│                                                                             │
│  Step 3: SYNTHESIS                                                          │
│  ├── Generate executive summary                                             │
│  ├── Create comparison table                                                │
│  ├── Produce pros/cons list                                                │
│  ├── Generate relevance score (1-10)                                       │
│  └── Create visual mockup description (for placeholder)                    │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Structured Output Schema

```typescript
interface InnovationResearch {
  // Core Info
  title: string;
  slug: string;
  tagline: string;              // One-liner description
  category: InnovationCategory;
  tags: string[];
  
  // Summary
  executiveSummary: string;     // 2-3 paragraphs
  keyBenefits: string[];        // Bullet points
  useCases: string[];           // Relevant to automotive/enterprise
  
  // Technical Assessment
  maturityLevel: 'experimental' | 'beta' | 'stable' | 'mature';
  license: string;
  githubUrl?: string;
  documentationUrl?: string;
  isOpenSource: boolean;
  isSelfHosted: boolean;
  hasAIComponent: boolean;
  
  // Comparison
  competitors: Competitor[];
  comparisonTable: ComparisonRow[];
  prosAndCons: { pros: string[]; cons: string[] };
  
  // Implementation
  implementationEffort: 'low' | 'medium' | 'high';
  requiredSkills: string[];
  estimatedTimeToMVP: string;
  
  // Scoring
  relevanceScore: number;       // 1-10
  innovationScore: number;      // 1-10
  actionabilityScore: number;   // 1-10
  
  // Sources
  sources: Source[];
  
  // Visual
  heroImageUrl?: string;
  mockupDescription?: string;
  
  // Metadata
  discoveredAt: Date;
  researchedAt: Date;
  status: 'pending' | 'researched' | 'approved' | 'promoted' | 'rejected';
}

type InnovationCategory = 
  | 'ai-ml'
  | 'devops'
  | 'security'
  | 'data-analytics'
  | 'developer-tools'
  | 'automation'
  | 'collaboration'
  | 'infrastructure';
```

---

### 2.3 User Interface Design

#### Design System

| Element | Specification |
|---------|---------------|
| Primary Color | `#0066FF` (Electric Blue) |
| Secondary Color | `#00D9FF` (Cyan) |
| Accent Color | `#FF6B35` (Innovation Orange) |
| Background | `#0A0A0F` (Near Black) |
| Surface | `#12121A` (Dark Surface) |
| Card | `#1A1A24` (Elevated Surface) |
| Text Primary | `#FFFFFF` |
| Text Secondary | `#A0A0B0` |
| Font | Inter (UI), JetBrains Mono (code) |

#### Visual Style

- **Glassmorphism** cards with subtle blur and border glow
- **Gradient accents** for interactive elements
- **Smooth animations** (Framer Motion style via Svelte transitions)
- **Dark mode first** (with optional light mode)
- **Responsive grid** layouts
- **Micro-interactions** on hover/click

#### Page Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                      │
│  [Logo] Innovation Radar          [Search] [Notifications] [Avatar▼]        │
├─────────────────────────────────────────────────────────────────────────────┤
│  NAVIGATION                                                                  │
│  [Radar] [Trending] [Categories] [My Votes] [Propose] │ [Admin]             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MAIN CONTENT                                                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  HERO SECTION (Radar View)                                           │    │
│  │  ╭──────────────────────────────────────────────────────────────╮   │    │
│  │  │                                                               │   │    │
│  │  │              Interactive Radar Visualization                  │   │    │
│  │  │                  (Concentric circles with                     │   │    │
│  │  │                   innovation dots by category)                │   │    │
│  │  │                                                               │   │    │
│  │  ╰──────────────────────────────────────────────────────────────╯   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ FEATURED   │ │ TRENDING   │ │ NEW TODAY  │ │ TOP VOTED  │               │
│  │ Innovation │ │ Innovation │ │ Innovation │ │ Innovation │               │
│  │ Card       │ │ Card       │ │ Card       │ │ Card       │               │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘               │
│                                                                              │
│  INNOVATION GRID                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │            │ │            │ │            │ │            │               │
│  │   Card     │ │   Card     │ │   Card     │ │   Card     │               │
│  │            │ │            │ │            │ │            │               │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘               │
│  ... (infinite scroll)                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Innovation Card Design

```
┌────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    HERO IMAGE                             │  │
│  │              (or gradient placeholder)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────┐ ┌─────┐ ┌──────────┐                                  │
│  │ AI  │ │ OSS │ │ Self-Host│  ← Badges                        │
│  └─────┘ └─────┘ └──────────┘                                  │
│                                                                 │
│  ══════════════════════════════════════                        │
│  Innovation Title Here                                          │
│  ══════════════════════════════════════                        │
│                                                                 │
│  Short tagline describing the innovation in                    │
│  one or two lines maximum...                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Relevance ████████░░ 8/10  │  Effort ████░░░░░░ 4/10   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────┐  ┌─────────────────────────────────┐    │
│  │  ▲ 42 votes      │  │  View Details →                  │    │
│  └──────────────────┘  └─────────────────────────────────┘    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### Innovation Detail Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Radar                                                             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │                        HERO IMAGE / BANNER                          │    │
│  │                      (Full width, with overlay)                     │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────┬───────────────────────────┐    │
│  │                                         │                           │    │
│  │  # Innovation Title                     │    VOTE PANEL             │    │
│  │                                         │    ┌─────────────────┐    │    │
│  │  One-liner tagline here                 │    │   ▲             │    │    │
│  │                                         │    │   142           │    │    │
│  │  ┌─────┐ ┌─────┐ ┌──────┐ ┌─────────┐  │    │   votes         │    │    │
│  │  │ AI  │ │ OSS │ │ Stable│ │ DevOps  │  │    │   [Vote Now]    │    │    │
│  │  └─────┘ └─────┘ └──────┘ └─────────┘  │    └─────────────────┘    │    │
│  │                                         │                           │    │
│  │  ─────────────────────────────────────  │    QUICK STATS            │    │
│  │                                         │    ├ Maturity: Stable     │    │
│  │  ## Executive Summary                   │    ├ License: Apache 2.0  │    │
│  │                                         │    ├ Effort: Medium       │    │
│  │  Lorem ipsum dolor sit amet...          │    ├ Time to MVP: 2 weeks │    │
│  │  Multiple paragraphs of rich            │    └ GitHub: ★ 12.4k      │    │
│  │  formatted content...                   │                           │    │
│  │                                         │    ACTIONS                 │    │
│  │  ## Key Benefits                        │    [View GitHub]          │    │
│  │  • Benefit one                          │    [View Docs]            │    │
│  │  • Benefit two                          │    [Propose for Impl.]    │    │
│  │  • Benefit three                        │                           │    │
│  │                                         │                           │    │
│  │  ## Comparison                          │                           │    │
│  │  ┌───────────────────────────────────┐ │                           │    │
│  │  │ Feature    │ This │ Alt A │ Alt B │ │                           │    │
│  │  ├───────────────────────────────────┤ │                           │    │
│  │  │ Open Source│  ✓   │   ✗   │   ✓   │ │                           │    │
│  │  │ Self-Host  │  ✓   │   ✓   │   ✗   │ │                           │    │
│  │  │ AI-Powered │  ✓   │   ✓   │   ✗   │ │                           │    │
│  │  └───────────────────────────────────┘ │                           │    │
│  │                                         │                           │    │
│  │  ## Pros & Cons                        │                           │    │
│  │  ✓ Pro one                             │                           │    │
│  │  ✓ Pro two                             │                           │    │
│  │  ✗ Con one                             │                           │    │
│  │                                         │                           │    │
│  │  ## Sources                            │                           │    │
│  │  [1] Article Name - source.com         │                           │    │
│  │  [2] Another Article - source2.com     │                           │    │
│  │                                         │                           │    │
│  └─────────────────────────────────────────┴───────────────────────────┘    │
│                                                                              │
│  ## Discussion (Coming Soon)                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.4 User Voting System

#### Voting Rules

- Each user gets **1 vote per innovation** (upvote only, no downvote)
- Users can **change their vote** (remove and vote elsewhere)
- Votes are **public** (visible who voted for what)
- Weekly **"Innovation Champion"** = most votes in 7 days

#### Promotion Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Innovation     │     │  Reaches Vote   │     │  Admin Review   │
│  Published      │────▶│  Threshold (20) │────▶│  & Approval     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Promoted to    │
                                                │  Implementation │
                                                │  Pipeline       │
                                                └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Added to       │
                                                │  Innovation     │
                                                │  Catalog        │
                                                └─────────────────┘
```

---

### 2.5 User-Submitted Innovations

Users can propose innovations that aren't auto-discovered:

#### Submission Form

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROPOSE AN INNOVATION                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Innovation Name *                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  URL (Project page, GitHub, or article) *                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Why is this relevant for us? *                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │                                                                      │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Category                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ [Select category...]                                            ▼   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ☐ I have tested this myself                                                │
│  ☐ This is open source                                                      │
│  ☐ This can be self-hosted                                                  │
│                                                                              │
│                                              [Cancel]  [Submit for Review]  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

After submission, the AI Researcher processes it the same way as auto-discovered innovations.

---

## 3. Database Schema

```sql
-- Users (local + OIDC)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user', -- 'user' | 'admin'
  auth_provider TEXT NOT NULL, -- 'local' | 'oidc'
  password_hash TEXT, -- NULL for OIDC users
  oidc_subject TEXT, -- NULL for local users
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

-- News Sources Configuration
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'rss' | 'api' | 'scrape'
  url TEXT NOT NULL,
  config TEXT, -- JSON: selectors, API keys, etc.
  enabled INTEGER DEFAULT 1,
  scan_interval_minutes INTEGER DEFAULT 120,
  last_scanned_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Raw feed items (before AI filtering)
CREATE TABLE raw_items (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES sources(id),
  external_id TEXT, -- ID from source (HN id, etc.)
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content TEXT,
  published_at DATETIME,
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'
  ai_filter_reason TEXT,
  UNIQUE(source_id, external_id)
);

-- Innovations (curated, researched)
CREATE TABLE innovations (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL,
  category TEXT NOT NULL,
  
  -- Research content (JSON)
  research_data TEXT NOT NULL,
  
  -- Scores
  relevance_score REAL,
  innovation_score REAL,
  actionability_score REAL,
  
  -- Metadata
  hero_image_url TEXT,
  is_open_source INTEGER DEFAULT 0,
  is_self_hosted INTEGER DEFAULT 0,
  has_ai_component INTEGER DEFAULT 0,
  maturity_level TEXT,
  license TEXT,
  github_url TEXT,
  documentation_url TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending' | 'published' | 'promoted' | 'archived'
  submitted_by TEXT REFERENCES users(id), -- NULL if auto-discovered
  
  -- Timestamps
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  researched_at DATETIME,
  published_at DATETIME,
  promoted_at DATETIME
);

-- Full-text search for innovations
CREATE VIRTUAL TABLE innovations_fts USING fts5(
  title, tagline, research_data,
  content='innovations',
  content_rowid='rowid'
);

-- Votes
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  innovation_id TEXT REFERENCES innovations(id) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, innovation_id)
);

-- Innovation sources/references
CREATE TABLE innovation_sources (
  id TEXT PRIMARY KEY,
  innovation_id TEXT REFERENCES innovations(id),
  raw_item_id TEXT REFERENCES raw_items(id),
  url TEXT NOT NULL,
  title TEXT,
  source_type TEXT, -- 'original' | 'related' | 'documentation'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT -- hex color for UI
);

CREATE TABLE innovation_tags (
  innovation_id TEXT REFERENCES innovations(id),
  tag_id TEXT REFERENCES tags(id),
  PRIMARY KEY (innovation_id, tag_id)
);

-- Activity log
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL, -- 'vote' | 'submit' | 'view' | 'promote'
  target_type TEXT, -- 'innovation' | 'user'
  target_id TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API Design

### 4.1 REST Endpoints

```
Authentication
POST   /api/auth/login          # Local login
POST   /api/auth/logout         # Logout
GET    /api/auth/oidc/callback  # OIDC callback
GET    /api/auth/me             # Current user

Innovations
GET    /api/innovations                    # List (paginated, filterable)
GET    /api/innovations/:slug              # Get single innovation
POST   /api/innovations                    # Submit user proposal
PATCH  /api/innovations/:id                # Admin: update status
DELETE /api/innovations/:id                # Admin: archive

GET    /api/innovations/trending           # Top voted this week
GET    /api/innovations/categories         # List categories with counts

Voting
POST   /api/innovations/:id/vote           # Cast vote
DELETE /api/innovations/:id/vote           # Remove vote
GET    /api/innovations/:id/voters         # List voters

Search
GET    /api/search?q=...                   # Full-text search

Admin
GET    /api/admin/sources                  # List sources
POST   /api/admin/sources                  # Add source
PATCH  /api/admin/sources/:id              # Update source
POST   /api/admin/scan                     # Trigger manual scan
GET    /api/admin/raw-items                # View pending items
PATCH  /api/admin/raw-items/:id            # Approve/reject item
GET    /api/admin/stats                    # Dashboard stats
```

### 4.2 Response Examples

```json
// GET /api/innovations?category=ai-ml&limit=10
{
  "data": [
    {
      "id": "clx1234...",
      "slug": "ollama-local-llm-runner",
      "title": "Ollama",
      "tagline": "Run large language models locally with ease",
      "category": "ai-ml",
      "tags": ["llm", "self-hosted", "docker"],
      "heroImageUrl": "/images/innovations/ollama.png",
      "isOpenSource": true,
      "isSelfHosted": true,
      "hasAiComponent": true,
      "maturityLevel": "stable",
      "relevanceScore": 9.2,
      "voteCount": 47,
      "hasVoted": false,
      "publishedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 156,
    "totalPages": 16
  }
}
```

---

## 5. AI Integration (Gemini)

### 5.1 Service Architecture

```typescript
// src/lib/services/ai.ts

interface AIService {
  // Filtering
  filterForRelevance(item: RawItem): Promise<FilterResult>;
  
  // Research
  researchInnovation(item: RawItem): Promise<InnovationResearch>;
  
  // Web fetching for research
  fetchAndSummarize(url: string): Promise<string>;
  
  // Search for related content
  searchRelatedSources(topic: string): Promise<Source[]>;
}

// Rate limiting: 15 requests/minute (Gemini free tier)
// Queue system for background processing
```

### 5.2 Prompt Templates

#### Filter Prompt

```
You are an innovation scout for an automotive company modernizing their IT.
Evaluate this article and respond with JSON only.

Article:
Title: {{title}}
URL: {{url}}
Content: {{content}}

Response format:
{
  "isRelevant": boolean,
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "suggestedCategory": "category-slug or null"
}

Criteria:
- ACCEPT: Open source tools, AI/ML innovations, DevOps, security, 
  developer productivity, enterprise automation
- REJECT: Consumer products, gaming, crypto, pure research, 
  cloud-only vendor lock-in
```

#### Research Prompt

```
You are a technology analyst. Research this innovation thoroughly 
and produce a structured report.

Innovation: {{title}}
URL: {{url}}
Initial content: {{content}}

You have access to these additional sources:
{{#each sources}}
- {{this.title}}: {{this.url}}
{{/each}}

Produce a JSON report with this exact structure:
{
  "title": "string",
  "tagline": "one-liner description",
  "executiveSummary": "2-3 paragraphs for executives",
  "keyBenefits": ["benefit1", "benefit2", ...],
  "useCases": ["use case relevant to automotive/enterprise IT"],
  "maturityLevel": "experimental|beta|stable|mature",
  "license": "license name",
  "isOpenSource": boolean,
  "isSelfHosted": boolean,
  "hasAiComponent": boolean,
  "competitors": [
    {"name": "string", "url": "string", "comparison": "string"}
  ],
  "prosAndCons": {
    "pros": ["pro1", "pro2"],
    "cons": ["con1", "con2"]
  },
  "implementationEffort": "low|medium|high",
  "requiredSkills": ["skill1", "skill2"],
  "estimatedTimeToMVP": "e.g., 1-2 weeks",
  "relevanceScore": 1-10,
  "innovationScore": 1-10,
  "actionabilityScore": 1-10
}
```

---

## 6. Background Jobs

### 6.1 Job Schedule

| Job | Frequency | Description |
|-----|-----------|-------------|
| `scan:feeds` | Every 2 hours | Fetch RSS/API feeds |
| `filter:items` | Every 30 min | AI filter pending items |
| `research:items` | Every hour | Deep research accepted items |
| `cleanup:old` | Daily 3 AM | Archive old raw items |
| `stats:compute` | Daily 4 AM | Compute trending scores |

### 6.2 Implementation

```typescript
// src/lib/jobs/scheduler.ts
import cron from 'node-cron';

export function initializeJobs() {
  // Scan feeds every 2 hours
  cron.schedule('0 */2 * * *', scanFeeds);
  
  // Filter pending items every 30 minutes
  cron.schedule('*/30 * * * *', filterPendingItems);
  
  // Research accepted items every hour
  cron.schedule('0 * * * *', researchAcceptedItems);
  
  // Daily cleanup at 3 AM
  cron.schedule('0 3 * * *', cleanupOldItems);
  
  // Compute stats at 4 AM
  cron.schedule('0 4 * * *', computeStats);
}
```

---

## 7. Project Structure

```
innovation-radar/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte            # Main layout
│   │   ├── +page.svelte              # Home/Radar view
│   │   ├── innovations/
│   │   │   ├── +page.svelte          # List view
│   │   │   └── [slug]/
│   │   │       └── +page.svelte      # Detail view
│   │   ├── propose/
│   │   │   └── +page.svelte          # Submit innovation
│   │   ├── categories/
│   │   │   └── [category]/
│   │   │       └── +page.svelte
│   │   ├── auth/
│   │   │   ├── login/+page.svelte
│   │   │   └── callback/+page.svelte
│   │   ├── admin/
│   │   │   ├── +layout.svelte        # Admin guard
│   │   │   ├── +page.svelte          # Dashboard
│   │   │   ├── sources/+page.svelte
│   │   │   ├── pending/+page.svelte
│   │   │   └── users/+page.svelte
│   │   └── api/
│   │       ├── auth/
│   │       ├── innovations/
│   │       ├── search/
│   │       └── admin/
│   │
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/                   # Base UI components
│   │   │   │   ├── Button.svelte
│   │   │   │   ├── Card.svelte
│   │   │   │   ├── Badge.svelte
│   │   │   │   ├── Input.svelte
│   │   │   │   └── ...
│   │   │   ├── innovations/
│   │   │   │   ├── InnovationCard.svelte
│   │   │   │   ├── InnovationDetail.svelte
│   │   │   │   ├── VoteButton.svelte
│   │   │   │   ├── ComparisonTable.svelte
│   │   │   │   └── RadarVisualization.svelte
│   │   │   └── layout/
│   │   │       ├── Header.svelte
│   │   │       ├── Sidebar.svelte
│   │   │       └── Footer.svelte
│   │   │
│   │   ├── server/
│   │   │   ├── db/
│   │   │   │   ├── index.ts          # Drizzle client
│   │   │   │   ├── schema.ts         # Drizzle schema
│   │   │   │   └── migrations/
│   │   │   ├── services/
│   │   │   │   ├── ai.ts             # Gemini integration
│   │   │   │   ├── scanner.ts        # Feed scanner
│   │   │   │   ├── researcher.ts     # AI researcher
│   │   │   │   └── auth.ts           # Auth helpers
│   │   │   └── jobs/
│   │   │       ├── scheduler.ts
│   │   │       └── tasks/
│   │   │
│   │   ├── stores/
│   │   │   ├── auth.ts
│   │   │   └── innovations.ts
│   │   │
│   │   └── utils/
│   │       ├── format.ts
│   │       └── validation.ts
│   │
│   ├── app.html
│   ├── app.css                       # Tailwind imports
│   └── hooks.server.ts               # Auth middleware
│
├── static/
│   └── images/
│
├── drizzle/
│   └── migrations/
│
├── package.json
├── svelte.config.js
├── tailwind.config.js
├── drizzle.config.ts
├── vite.config.ts
└── .env.example
```

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|------------|
| XSS | Svelte auto-escapes, CSP headers |
| CSRF | SvelteKit built-in protection |
| SQL Injection | Drizzle ORM parameterized queries |
| Auth bypass | Server-side session validation |
| Rate limiting | API rate limits per user |
| Secrets | Environment variables, never in code |
| OIDC | Validate tokens server-side |

---

## 9. Performance Considerations

| Aspect | Strategy |
|--------|----------|
| Initial load | SSR with SvelteKit |
| Pagination | Cursor-based for large lists |
| Caching | Redis-like caching (or in-memory for MVP) |
| Images | Lazy loading, WebP format |
| Search | SQLite FTS5 (sufficient for dozens of users) |
| AI calls | Queue with rate limiting |

---

## 10. Deployment

### Docker Setup

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "build"]
```

### Environment Variables

```env
# Database
DATABASE_URL=./data/innovation-radar.db

# Auth
SESSION_SECRET=your-secret-key
OIDC_ISSUER=https://your-idp.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=http://localhost:3000/auth/callback

# AI
GEMINI_API_KEY=your-gemini-key

# App
PUBLIC_APP_URL=http://localhost:3000
```

---

## 11. MVP Scope (Phase 1)

### In Scope
- [x] Basic authentication (local only, OIDC later)
- [x] Manual source configuration
- [x] RSS feed scanning (HN, Ars, TechCrunch)
- [x] AI filtering with Gemini
- [x] AI research and report generation
- [x] Innovation list and detail views
- [x] Voting system
- [x] User innovation submission
- [x] Admin dashboard (basic)
- [x] Responsive UI with dark theme

### Out of Scope (Phase 2+)
- [ ] OIDC integration
- [ ] Innovation Catalog (deployment)
- [ ] Comments/Discussion
- [ ] Email notifications
- [ ] Advanced analytics
- [ ] API documentation
- [ ] Mobile app

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Weekly active users | 20+ |
| Innovations discovered/week | 10-15 |
| User submissions/month | 5+ |
| Avg. votes per innovation | 8+ |
| Time to research (AI) | < 5 min |
| Page load time | < 2s |

---

## 13. Design Decisions

1. **Vote threshold for promotion**: Most votes wins (no fixed threshold - top voted gets promoted)
2. **Moderation**: No approval needed - user submissions publish immediately
3. **Notifications**: No email notifications
4. **Integration**: No external integrations (Slack/Teams)
5. **Data retention**: Keep everything forever (no archival policy)

---

## Appendix A: Radar Visualization Concept

The radar visualization shows innovations as dots on concentric circles:

- **Inner ring**: Highest relevance (8-10)
- **Middle ring**: Medium relevance (5-7)
- **Outer ring**: Lower relevance (1-4)

Segments represent categories (8 segments like a pie chart).

Dot size = vote count
Dot color = category
Hover = tooltip with name
Click = navigate to detail

This provides an at-a-glance view of the innovation landscape.

---

*Document Version: 1.0*
*Last Updated: 2025-02-21*
