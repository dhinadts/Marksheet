#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

for required_file in backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json; do
  if [[ ! -f "$required_file" ]]; then
    echo "Missing $required_file. Deploy from the repository root with its lockfiles included." >&2
    exit 1
  fi
done

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy deploy/ec2/env.example to .env and replace every placeholder." >&2
  exit 1
fi

echo "Starting PostgreSQL, Redis and AI service..."

docker compose up -d --build postgres redis ai-service

echo "Waiting for PostgreSQL to become ready..."

for i in {1..30}; do
  if docker compose exec -T postgres sh -c \
    'pg_isready -U "$POSTGRES_USER" -d postgres' >/dev/null 2>&1; then

    echo "PostgreSQL is ready."
    break
  fi

  if [[ "$i" -eq 30 ]]; then
    echo "PostgreSQL did not become ready in time." >&2
    docker compose logs --tail=100 postgres
    exit 1
  fi

  echo "Waiting for PostgreSQL... attempt $i/30"
  sleep 2
done

echo "Checking application database..."

if ! docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '\''university_marksheets'\''"' \
  | grep -q 1; then

  echo "Creating university_marksheets database..."

  docker compose exec -T postgres sh -c \
    'createdb -U "$POSTGRES_USER" university_marksheets'
else
  echo "Database university_marksheets already exists."
fi

echo "Starting backend and frontend..."

docker compose up -d --build backend frontend

echo "Waiting briefly for backend container..."
sleep 5

echo "Running Prisma migrations..."

docker compose exec -T backend npx prisma migrate deploy

echo "Checking backend..."

curl --fail \
  --retry 20 \
  --retry-delay 3 \
  http://127.0.0.1:3001/ >/dev/null

echo "Backend healthy."

echo "Checking frontend..."

curl --fail \
  --retry 20 \
  --retry-delay 3 \
  http://127.0.0.1:3000/ >/dev/null

echo "Frontend healthy."

echo "AI-MARKS deployment is healthy."