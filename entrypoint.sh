#!/bin/sh
set -e

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
