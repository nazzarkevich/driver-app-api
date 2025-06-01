#!/bin/sh
echo "Running Prisma migrations..."
npx prisma migrate deploy

# Optional: Run production seeds
# echo "Running production seeds..."
# yarn seed:prod

echo "Starting application..."
exec yarn start:prod