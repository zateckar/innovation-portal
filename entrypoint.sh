#!/bin/sh
set -e

# Persist workspaces alongside the database when a /app/data volume is mounted.
# The app reads/writes builds at the hardcoded path /home/bun/app/workspaces;
# symlinking that onto the mounted volume (/app/data/workspaces) keeps builds
# across container/pod restarts. Pair with DATABASE_PATH=/app/data/db/innovation-radar.db.
if [ -d /app/data ]; then
  mkdir -p /app/data/db /app/data/workspaces
  if [ ! -L /home/bun/app/workspaces ]; then
    rm -rf /home/bun/app/workspaces
    ln -s /app/data/workspaces /home/bun/app/workspaces
  fi
fi

echo "Running database migrations..."
# Load .env if present (local dev without Docker; in prod, env vars come from Docker/K8s)
if [ -f .env ]; then
  bun --env-file=.env scripts/db-migrate.js
else
  bun scripts/db-migrate.js
fi

echo "Starting application..."
if [ -f .env ]; then
  exec bun --env-file=.env ./build/index.js
else
  exec bun ./build/index.js
fi
