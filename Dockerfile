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

# Install runtime dependencies for better-sqlite3
RUN apt-get update && \
    apt-get install -y --no-install-recommends libstdc++6 && \
    rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=builder --chown=node:node /home/node/app/build ./build
COPY --from=builder --chown=node:node /home/node/app/node_modules ./node_modules
COPY --from=builder --chown=node:node /home/node/app/package.json ./package.json
COPY --from=builder --chown=node:node /home/node/app/drizzle ./drizzle
COPY --from=builder --chown=node:node /home/node/app/scripts ./scripts
COPY --from=builder --chown=node:node /home/node/app/entrypoint.sh ./entrypoint.sh

# Create data directory and set permissions
RUN mkdir -p /home/node/app/data && chown -R node:node /home/node/app/data

# Make entrypoint executable
RUN chmod +x /home/node/app/entrypoint.sh

# Switch to non-root user (pre-existing in the base image)
USER node

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
