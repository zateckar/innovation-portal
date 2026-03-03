# Innovation Radar

AI-powered internal platform for discovering, evaluating, and voting for IT innovations.

![Build Status](https://github.com/YOUR_ORG/innovation-radar/actions/workflows/build-and-push.yml/badge.svg)

## Features

- **Automated Discovery**: Scans Hacker News, RSS feeds, and tech news for innovations
- **AI-Powered Analysis**: Uses Gemini to filter and research discoveries
- **Stylish Dark UI**: Modern glassmorphism design with radar visualization
- **Democratic Voting**: Employees vote to prioritize implementations
- **User Submissions**: Propose your own innovation discoveries
- **Discussion & Comments**: Threaded discussions on each innovation
- **Corporate SSO**: OIDC authentication (Azure AD, Okta, Keycloak, etc.)

## Quick Start

### Prerequisites

- Node.js 20+
- Google Gemini API key (for AI features)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Initialize database
npm run db:push

# Seed with sample data
npm run db:seed

# Start development server
npm run dev
```

### Test Accounts

After seeding:
- **Admin**: `admin@company.com` / `admin123`
- **User**: `demo@company.com` / `demo123`

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Create environment file
cp .env.example .env
# Edit .env with your settings (including INIT_ADMIN_* for initial admin user)

# Build and run
docker-compose up -d
```

The initial admin user will be created automatically on first startup if `INIT_ADMIN_EMAIL` and `INIT_ADMIN_PASSWORD` environment variables are set and no admin user exists yet.

**Example `.env` for production:**
```env
SESSION_SECRET=your-very-long-random-secret-key
GEMINI_API_KEY=your-gemini-api-key
INIT_ADMIN_EMAIL=admin@yourcompany.com
INIT_ADMIN_PASSWORD=secure-password-change-me
INIT_ADMIN_NAME=System Administrator
```

### Using Docker directly

```bash
# Build image
docker build -t innovation-radar .

# Run container
docker run -d \
  --name innovation-radar \
  -p 3000:3000 \
  -v innovation-data:/app/data \
  -e SESSION_SECRET=your-secret-key \
  -e GEMINI_API_KEY=your-gemini-key \
  innovation-radar
```

### Using GitHub Container Registry

```bash
# Pull latest image
docker pull ghcr.io/YOUR_ORG/innovation-radar:latest

# Run with your environment
docker run -d \
  --name innovation-radar \
  -p 3000:3000 \
  -v innovation-data:/app/data \
  -e SESSION_SECRET=your-secret-key \
  -e GEMINI_API_KEY=your-gemini-key \
  ghcr.io/YOUR_ORG/innovation-radar:latest
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run check` | Type check |

## Architecture

- **Frontend**: SvelteKit 2 + Svelte 5 + TailwindCSS 4
- **Backend**: SvelteKit API routes
- **Database**: SQLite (via Drizzle ORM)
- **Auth**: Local accounts + OIDC (corporate SSO)
- **AI**: Google Gemini API

## Project Structure

```
src/
├── routes/           # SvelteKit pages & API
├── lib/
│   ├── components/   # Svelte components
│   │   ├── ui/       # Base UI components
│   │   ├── innovations/  # Innovation-specific
│   │   └── layout/   # Layout components
│   ├── server/
│   │   ├── db/       # Drizzle schema
│   │   ├── services/ # AI, scanner, auth
│   │   └── jobs/     # Background jobs
│   ├── stores/       # Svelte stores
│   └── types.ts      # TypeScript types
```

## Admin Features

As an admin, you can:
- Add/manage news sources (RSS, APIs)
- Trigger manual scans
- Run AI filtering and research
- View pending items

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_PATH` | SQLite database path | No (default: `./data/innovation-radar.db`) |
| `SESSION_SECRET` | Session encryption key | Yes (for production) |
| `GEMINI_API_KEY` | Google Gemini API key | Yes (for AI features) |
| `PUBLIC_APP_URL` | Public URL of the app | No |
| `PORT` | Server port | No (default: `3000`) |
| `HOST` | Server host | No (default: `0.0.0.0`) |
| `OIDC_ISSUER` | OIDC provider URL | No (for SSO) |
| `OIDC_CLIENT_ID` | OIDC client ID | No (for SSO) |
| `OIDC_CLIENT_SECRET` | OIDC client secret | No (for SSO) |
| `OIDC_REDIRECT_URI` | OAuth callback URL | No (defaults to `{PUBLIC_APP_URL}/auth/callback`) |
| `INIT_ADMIN_EMAIL` | Initial admin email (created on first startup) | No |
| `INIT_ADMIN_PASSWORD` | Initial admin password | No |
| `INIT_ADMIN_NAME` | Initial admin display name | No (default: `Admin`) |

### Adding Sources

1. Login as admin
2. Go to Admin > Manage Sources
3. Add RSS feed URLs or API endpoints

Suggested sources:
- Hacker News (API): `https://hacker-news.firebaseio.com`
- Ars Technica (RSS): `https://feeds.arstechnica.com/arstechnica/technology-lab`
- TechCrunch (RSS): `https://techcrunch.com/feed/`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/innovations/:id/vote` | POST | Vote for innovation |
| `/api/innovations/:id/vote` | DELETE | Remove vote |
| `/api/innovations/:id/comments` | GET | Get innovation comments |
| `/api/innovations/:id/comments` | POST | Add comment |
| `/api/comments/:id` | DELETE | Delete comment |
| `/api/comments/:id` | PATCH | Update comment |

## SSO Configuration

Innovation Radar supports OIDC-based Single Sign-On. Configure it by setting the following environment variables:

### Azure AD (Microsoft Entra ID)

```env
OIDC_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=https://your-app.com/auth/callback
```

### Okta

```env
OIDC_ISSUER=https://dev-xxxxx.okta.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=https://your-app.com/auth/callback
```

### Keycloak

```env
OIDC_ISSUER=https://keycloak.example.com/realms/{realm}
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=https://your-app.com/auth/callback
```

When SSO is configured, users will see a "Sign in with Corporate SSO" button on the login page. The system will automatically link OIDC accounts to existing email-matched accounts.

## GitHub Actions

The repository includes a CI/CD workflow that:

1. **On Pull Request**: Runs type checking and builds the app
2. **On Push to main**: Builds and pushes Docker image to GitHub Container Registry
3. **Security Scanning**: Runs Trivy vulnerability scanner on images

### Setting up GitHub Actions

1. Ensure GitHub Packages is enabled for your repository
2. The workflow uses `GITHUB_TOKEN` automatically for authentication
3. Images are tagged with:
   - `latest` (for main branch)
   - Git SHA
   - Semantic version (if tagged)

## License

Private - Internal Use Only
