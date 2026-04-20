# Stage 1: Build
FROM oven/bun:1 AS builder

# Build-time argument for base path (e.g., /myapp)
ARG BASE_PATH=""
ENV BASE_PATH=${BASE_PATH}

WORKDIR /home/bun/app

# Copy package files (no native compilation needed — bun:sqlite is built into Bun)
COPY package.json bun.lock ./

# Install all dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application with BASE_PATH
RUN bun run build

# Reinstall production-only dependencies to prune devDependencies
RUN bun install --frozen-lockfile --production

# Stage 2: Production
FROM oven/bun:1 AS production

WORKDIR /home/bun/app

# Install runtime dependencies:
# - libstdc++6: required by native modules in AI-generated workspace scaffolds
# - python3, make, g++: required to compile native modules (e.g. better-sqlite3) in workspace scaffolds
# - git: used by the builder for git operations
# - curl: used by OpenCode CLI for API calls
# - netstat (net-tools): used by opencode-agent.ts for port checks
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libstdc++6 python3 make g++ git curl net-tools && \
    rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=builder --chown=bun:bun /home/bun/app/build ./build
COPY --from=builder --chown=bun:bun /home/bun/app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /home/bun/app/package.json ./package.json
COPY --from=builder --chown=bun:bun /home/bun/app/drizzle ./drizzle
COPY --from=builder --chown=bun:bun /home/bun/app/scripts ./scripts
COPY --from=builder --chown=bun:bun /home/bun/app/entrypoint.sh ./entrypoint.sh

# Create data and workspaces directories with restrictive permissions.
# 700 on /data prevents AI-generated workspace child apps (running as the
# same `bun` user) from reading /data/innovation-radar.db (which contains
# users, sessions, and admin secrets).
RUN mkdir -p /home/bun/app/data /home/bun/app/workspaces && \
    chown -R bun:bun /home/bun/app/data /home/bun/app/workspaces && \
    chmod 700 /home/bun/app/data

# Make entrypoint executable
RUN chmod +x /home/bun/app/entrypoint.sh

# Switch to non-root user (pre-existing in the base image)
USER bun

# Install OpenCode CLI globally AS THE bun USER (used by the autonomous builder).
# Previously this RUN ran as root, which installed the binary under
# /root/.bun/install/global/node_modules/.bin/opencode. /root is mode 700 so
# the runtime `bun` user couldn't read it — every build crashed at Phase 3
# with `ENOENT: spawn opencode` even though `command -v opencode` succeeded
# during image build (because that check also ran as root).
#
# Two extra wrinkles when running as `bun`:
#  1. The oven/bun base image sets BUN_INSTALL=/usr/local, which makes
#     `bun install -g` try to link binaries into /usr/local/bin — write-protected
#     for the `bun` user (EACCES "Failed to link opencode-ai"). Override
#     BUN_INSTALL to bun's home so both the package files AND the bin symlink
#     land under /home/bun/.bun/.
#  2. We point PATH at $BUN_INSTALL/bin where bun actually places the symlink.
ENV BUN_INSTALL=/home/bun/.bun
ENV PATH="/home/bun/.bun/bin:${PATH}"
RUN bun install -g opencode-ai@latest && \
    (command -v opencode >/dev/null || (echo "FATAL: 'opencode' not on PATH after install" && exit 1))

# Configure git for the builder (required for OpenCode)
RUN git config --global user.email "builder@innovation-portal.local" && \
    git config --global user.name "Innovation Portal Builder" && \
    git config --global init.defaultBranch main

# Environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/home/bun/app/data/innovation-radar.db

# Expose port (can be overridden by docker run)
EXPOSE ${PORT}

# Health check dynamically uses the PORT environment variable
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD bun --eval "fetch('http://localhost:' + process.env.PORT + '/api/health').then(r => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))" || exit 1

# Start command (runs migrations then starts app)
CMD ["./entrypoint.sh"]
