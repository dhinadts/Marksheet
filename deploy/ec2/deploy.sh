#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy deploy/ec2/env.example to .env and replace every placeholder." >&2
  exit 1
fi

docker compose up -d --build postgres redis ai-service

if ! docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '\''university_Marksheets'\''"' | grep -q 1; then
  docker compose exec -T postgres sh -c \
    'createdb -U "$POSTGRES_USER" university_Marksheets'
fi

docker compose up -d --build backend frontend
docker compose exec -T backend npx prisma migrate deploy
curl --fail --retry 20 --retry-delay 3 http://127.0.0.1:3001/ >/dev/null
curl --fail --retry 20 --retry-delay 3 http://127.0.0.1:3000/ >/dev/null
echo "AI-MARKS deployment is healthy."
