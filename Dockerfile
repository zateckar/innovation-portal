# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:24-alpine AS production

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libstdc++

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sveltekit -u 1001

# Copy built application
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./package.json
COPY --from=builder --chown=sveltekit:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=sveltekit:nodejs /app/src/lib/server/db ./src/lib/server/db
COPY --from=builder --chown=sveltekit:nodejs /app/scripts ./scripts
COPY --from=builder --chown=sveltekit:nodejs /app/entrypoint.sh ./entrypoint.sh

# Create data directory
RUN mkdir -p /app/data && chown -R sveltekit:nodejs /app/data

# Switch to non-root user
USER sveltekit

# Environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/app/data/innovation-radar.db

# Expose port (can be overridden by docker run)
EXPOSE ${PORT}

# Health check dynamically uses the PORT environment variable
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Start command (runs migrations then starts app)
CMD ["./entrypoint.sh"]
