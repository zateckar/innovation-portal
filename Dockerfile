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

# Install OpenCode CLI for the autonomous builder.
#
# History of what's gone wrong here (do not regress):
#  1. Install as root with default BUN_INSTALL → binary under /root/.bun/bin
#     which is mode 700 → unreadable by runtime `bun` user → ENOENT at runtime.
#  2. Switch to USER bun before install → bun tries to link into /usr/local/bin
#     (hardcoded fallback) → EACCES.
#  3. Install as root with HOME+BUN_INSTALL pointed at /home/bun/.bun + chown
#     → permission OK, but PATH-env drift at runtime still caused ENOENT.
#  4. Same as 3 + symlink to /usr/local/bin → permissions OK, PATH OK, but
#     `bun install -g opencode-ai` MISDETECTS LIBC: it pulls
#     `opencode-linux-x64-musl` (the musl variant) on the glibc Debian-based
#     `oven/bun:1` image. The musl binary references /lib/ld-musl-x86_64.so.1
#     which does not exist → kernel returns ENOENT for exec → "/usr/local/bin/
#     opencode: not found" (despite the file being there). Known Bun bug.
#
# Final, bulletproof approach: skip the `opencode-ai` JS wrapper entirely
# (it's what triggers the buggy libc auto-detection). Download the explicit
# `opencode-linux-x64` glibc tarball straight from the npm registry, extract
# to /opt/opencode, and symlink /usr/local/bin/opencode → the binary.
#
# Pros:
#   - No dependence on Bun's libc detection.
#   - Single self-contained binary (the Bun-compiled standalone executable).
#   - Reproducible: version is pinned via ARG so rebuilds stay deterministic.
#   - Smaller image: skips the npm wrapper layer + dev dependency tree.
#
# To upgrade opencode: bump OPENCODE_VERSION below (or override at build time
# with `docker build --build-arg OPENCODE_VERSION=x.y.z`). Verify the version
# exists at https://www.npmjs.com/package/opencode-linux-x64 first.
ARG OPENCODE_VERSION=1.14.19
RUN set -eux; \
    mkdir -p /opt/opencode; \
    curl -fsSL "https://registry.npmjs.org/opencode-linux-x64/-/opencode-linux-x64-${OPENCODE_VERSION}.tgz" \
        | tar -xz -C /opt/opencode --strip-components=1; \
    if [ ! -x /opt/opencode/bin/opencode ]; then \
        echo "FATAL: extracted tarball does not contain bin/opencode"; \
        ls -la /opt/opencode /opt/opencode/bin 2>&1 || true; \
        exit 1; \
    fi; \
    chmod 755 /opt/opencode/bin/opencode; \
    ln -sf /opt/opencode/bin/opencode /usr/local/bin/opencode; \
    /usr/local/bin/opencode --version

# Switch to non-root user (pre-existing in the base image)
USER bun

# Verify resolvability AS THE bun USER. /opt/opencode is world-readable
# (default tar perms) and /usr/local/bin is on the default PATH, so the
# symlink works without any extra ENV manipulation.
RUN command -v opencode >/dev/null && opencode --version >/dev/null 2>&1 \
    || (echo "FATAL: 'opencode' not resolvable for bun user" && which opencode; ls -la /usr/local/bin/opencode /opt/opencode/bin/opencode 2>&1; exit 1)

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
