#!/bin/sh
set -e

echo "Running database migrations..."
node scripts/db-migrate.js

echo "Starting application..."
exec node build
