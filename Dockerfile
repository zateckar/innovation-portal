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

# Install OpenCode CLI globally for the autonomous builder.
#
# History of what's gone wrong here (do not regress):
#  1. Original: install as root with default BUN_INSTALL=/usr/local. Bun put
#     the binary under /root/.bun/bin (it defaults to $HOME/.bun, not
#     /usr/local). /root is mode 700, so the runtime `bun` user got
#     `ENOENT: spawn opencode` at Phase 3 of every build, even though the
#     image build's `command -v opencode` (running as root) passed.
#  2. Switched to USER bun before install. Bun then tried to link the binary
#     into /usr/local/bin (a hardcoded fallback) → EACCES "Failed to link
#     opencode-ai". ENV BUN_INSTALL didn't reroute the link step.
#  3. Install as root with HOME+BUN_INSTALL pointed at /home/bun/.bun, then
#     chown to bun. This worked at image-build time but if PATH ENV got
#     overridden anywhere downstream the runtime spawn still failed with
#     ENOENT.
#
# Final, bulletproof approach: install as root into /home/bun/.bun (so the
# JS files are owned by bun and readable), THEN create a hard symlink at
# /usr/local/bin/opencode. /usr/local/bin is on the default PATH for every
# user, mode 755, world-readable — so spawn('opencode') resolves regardless
# of any custom ENV PATH manipulation, USER switch, or downstream PATH reset.
# NOTE: Do not put `#` comments inside the RUN block below — Docker joins
# backslash-continued lines into a single shell command (no newlines left),
# so an inline `#` would comment out the rest of the script. Comments stay
# out here in Dockerfile-comment form.
#
# Steps performed by the RUN below:
#   1. bun install -g opencode-ai (forced into /home/bun/.bun via HOME+BUN_INSTALL)
#   2. chown the install tree to bun so the runtime user can read it
#   3. Resolve the actual binary path (Bun symlinks $BUN_INSTALL/bin/<name>
#      → ../install/global/node_modules/<pkg>/bin/<name>; we follow the link)
#   4. Symlink /usr/local/bin/opencode → resolved target. /usr/local/bin is
#      on every user's default PATH and world-readable.
#   5. Smoke test as root (bun-user verification happens after USER switch).
ENV BUN_INSTALL=/home/bun/.bun
RUN set -eux; \
    HOME=/home/bun BUN_INSTALL=/home/bun/.bun bun install -g opencode-ai@latest; \
    chown -R bun:bun /home/bun/.bun; \
    OC_BIN=""; \
    if [ -e /home/bun/.bun/bin/opencode ]; then \
        OC_BIN="$(readlink -f /home/bun/.bun/bin/opencode || echo /home/bun/.bun/bin/opencode)"; \
    else \
        OC_BIN="$(find /home/bun/.bun -maxdepth 6 \( -name opencode -type f -o -name opencode -type l \) -print -quit)"; \
    fi; \
    if [ -z "$OC_BIN" ] || [ ! -e "$OC_BIN" ]; then \
        echo "FATAL: opencode binary not found under /home/bun/.bun after install"; \
        find /home/bun/.bun -maxdepth 6 -name 'opencode*'; \
        exit 1; \
    fi; \
    echo "Resolved opencode binary at $OC_BIN"; \
    ln -sf "$OC_BIN" /usr/local/bin/opencode; \
    chmod 755 /usr/local/bin/opencode "$OC_BIN" || true; \
    /usr/local/bin/opencode --version

# Switch to non-root user (pre-existing in the base image)
USER bun

# Put bun's global bin on PATH for completeness (also lets bunx work), then
# verify resolvability AS THE bun USER. /usr/local/bin is on the default
# PATH so the symlink above is the primary resolution path.
ENV PATH="/home/bun/.bun/bin:${PATH}"
RUN command -v opencode >/dev/null && opencode --version >/dev/null 2>&1 \
    || (echo "FATAL: 'opencode' not resolvable for bun user" && which opencode; ls -la /usr/local/bin/opencode /home/bun/.bun/bin/ 2>&1; exit 1)

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
