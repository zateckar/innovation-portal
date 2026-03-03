# Innovation Portal

AI-powered internal platform for discovering, evaluating, and voting for IT innovations + catalog of innovations for users to try.

![Build Status](https://github.com/zateckar/innovation-portal/actions/workflows/build-and-push.yml/badge.svg)

## Features

- **Automated Discovery**: Scans Hacker News, RSS feeds, and tech news for innovations
- **AI-Powered Analysis**: Uses Gemini to filter and research discoveries
- **Stylish Dark UI**: Modern glassmorphism design with Portal visualization
- **Democratic Voting**: Employees vote to prioritize implementations
- **User Submissions**: Propose your own innovation discoveries
- **Discussion & Comments**: Threaded discussions on each innovation
- **Corporate SSO**: OIDC authentication (Azure AD, Okta, Keycloak, etc.)

## Quick Start

### Prerequisites

- Node.js 20+
- Google Gemini API key (for AI features)

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

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_PATH` | SQLite database path | No (default: `./data/innovation-Portal.db`) |
| `SESSION_SECRET` | Session encryption key | Yes (for production) |
| `GEMINI_API_KEY` | Google Gemini API key | Yes (for AI features) |
| `PUBLIC_APP_URL` | Public URL of the app | No |
| `PORT` | Server port | No (default: `3000`) |
| `HOST` | Server host | No (default: `0.0.0.0`) |
| `BASE_PATH` | Base path for serving under a subpath (build-time) | No |
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

Innovation Portal supports OIDC-based Single Sign-On. Configure it by setting the following environment variables:

```env
OIDC_ISSUER=https://keycloak.example.com/realms/{realm}
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=https://your-app.com/auth/callback
```
When SSO is configured, users will see a "Sign in with Corporate SSO" button on the login page. The system will automatically link OIDC accounts to existing email-matched accounts.

## Base Path Configuration

To serve the application under a subpath (e.g., `http://hostname/inno`), set the `BASE_PATH` environment variable at **build time**.

> ⚠️ **Critical:** BASE_PATH is baked into the build. You MUST rebuild the application after changing this value. Runtime changes will NOT work.

### Local Development

```bash
# Build with base path (both formats work - will be normalized to /inno)
BASE_PATH=inno npm run build
# or
BASE_PATH=/inno npm run build

# Preview the built app
npm run preview
```

### Docker Build (Local)

```bash
# Build Docker image with base path
docker build --build-arg BASE_PATH=inno -t innovation-portal .

# Run the container
docker run -p 3000:3000 innovation-portal
```

The application will then be accessible at `http://localhost:3000/inno`.

### GitHub Actions

The GitHub Actions workflow supports BASE_PATH through:

1. **Repository Variable (Recommended)**: Go to Settings → Secrets and variables → Actions → Variables, add `BASE_PATH` with value `inno`
2. **Manual Trigger**: Use "Run workflow" button and enter the base path

After setting the variable, trigger a new build to apply the base path.

### Reverse Proxy Configuration

When using a reverse proxy (nginx, Traefik, etc.), ensure it forwards requests correctly:

**Nginx example:**
```nginx
location /inno/ {
    proxy_pass http://localhost:3000/inno/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

**Traefik example (with PathPrefix):**
```yaml
- "traefik.http.routers.innovation.rule=PathPrefix(`/inno`)"
```

### Notes

- The base path is automatically normalized (e.g., `inno`, `/inno`, `/inno/` all become `/inno`)
- All internal links and assets will be served under the base path
- The app responds to requests at `{BASE_PATH}/` (e.g., `/inno/`, `/inno/innovations`, etc.)

## License

MIT
