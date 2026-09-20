#!/bin/sh
set -e

echo "Applying database migrations..."
prisma migrate deploy --schema=./prisma/schema.prisma

echo "Ensuring an admin user exists..."
node prisma/seed.docker.cjs || true

echo "Starting server..."
exec "$@"
