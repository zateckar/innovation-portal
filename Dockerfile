# Stage 1: Build
FROM node:24-slim AS builder

# Build-time argument for base path (e.g., /myapp)
ARG BASE_PATH=""
ENV BASE_PATH=${BASE_PATH}

WORKDIR /home/node/app

# Install build dependencies for better-sqlite3
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application with BASE_PATH
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:24-slim AS production

WORKDIR /home/node/app

# Install runtime dependencies:
# - libstdc++6: required by better-sqlite3
# - python3, make, g++: required to compile better-sqlite3 in workspace scaffolds
# - git: used by the builder for git operations
# - curl: used by OpenCode CLI for API calls
# - netstat (net-tools): used by opencode-agent.ts for port checks
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libstdc++6 python3 make g++ git curl net-tools && \
    rm -rf /var/lib/apt/lists/*

# Install OpenCode CLI globally (used by the autonomous builder)
# OpenCode is a Go binary distributed as an npm package
RUN npm install -g opencode@latest tsx 2>/dev/null || true

# Copy built application
COPY --from=builder --chown=node:node /home/node/app/build ./build
COPY --from=builder --chown=node:node /home/node/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /home/node/app/package.json ./package.json
COPY --from=builder --chown=node:node /home/node/app/drizzle ./drizzle
COPY --from=builder --chown=node:node /home/node/app/scripts ./scripts
COPY --from=builder --chown=node:node /home/node/app/entrypoint.sh ./entrypoint.sh

# Create data and workspaces directories with proper permissions
RUN mkdir -p /home/node/app/data /home/node/app/workspaces && \
    chown -R node:node /home/node/app/data /home/node/app/workspaces

# Make entrypoint executable
RUN chmod +x /home/node/app/entrypoint.sh

# Switch to non-root user (pre-existing in the base image)
USER node

# Configure git for the builder (required for OpenCode)
RUN git config --global user.email "builder@innovation-portal.local" && \
    git config --global user.name "Innovation Portal Builder" && \
    git config --global init.defaultBranch main

# Environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/home/node/app/data/innovation-radar.db

# Expose port (can be overridden by docker run)
EXPOSE ${PORT}

# Health check dynamically uses the PORT environment variable
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start command (runs migrations then starts app)
CMD ["./entrypoint.sh"]
