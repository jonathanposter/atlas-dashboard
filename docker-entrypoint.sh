#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma db push --skip-generate --accept-data-loss

echo "Starting app..."
exec node server.js
