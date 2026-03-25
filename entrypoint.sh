#!/bin/sh
set -e

echo "Running database migrations..."
# Load .env if present (local dev without Docker; in prod, env vars come from Docker/K8s)
if [ -f .env ]; then
  node --env-file=.env scripts/db-migrate.js
else
  node scripts/db-migrate.js
fi

echo "Starting application..."
if [ -f .env ]; then
  exec node --env-file=.env build
else
  exec node build
fi
