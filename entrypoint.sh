#!/bin/sh
set -e

echo "Running database schema migration..."
npx drizzle-kit push --force

echo "Starting application..."
exec node build
