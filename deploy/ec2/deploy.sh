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

database_url=$(grep '^DATABASE_URL=' .env | cut -d= -f2- || true)
if [[ -z "$database_url" ]]; then
  echo "DATABASE_URL is missing from .env." >&2
  exit 1
fi
if [[ "$database_url" =~ @(localhost|127\.0\.0\.1): ]]; then
  database_url=$(printf '%s' "$database_url" | sed -E 's/@(localhost|127\.0\.0\.1):/@postgres:/')
  export DATABASE_URL="$database_url"
  echo "Updated DATABASE_URL to use the Docker PostgreSQL service."
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

echo "Starting backend..."

docker compose up -d --build backend

echo "Waiting for backend to become healthy..."
for i in {1..30}; do
  if docker compose ps --status running --services | grep -qx backend && \
    docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q backend)" | grep -qx healthy; then
    echo "Backend is healthy."
    break
  fi

  if [[ "$i" -eq 30 ]]; then
    echo "Backend did not become healthy in time." >&2
    docker compose logs --tail=100 backend
    exit 1
  fi

  echo "Waiting for backend... attempt $i/30"
  sleep 2
done

echo "Starting frontend..."

docker compose up -d --build frontend

if command -v nginx >/dev/null 2>&1; then
  echo "Enabling Marksheet Nginx site..."
  sudo cp deploy/ec2/ai-marks.nginx.conf /etc/nginx/sites-available/ai-marks
  sudo ln -sfn /etc/nginx/sites-available/ai-marks /etc/nginx/sites-enabled/ai-marks
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "Checking backend..."

curl --fail \
  --retry 20 \
  --retry-delay 3 \
  http://127.0.0.1:3001/ >/dev/null

echo "Checking frontend..."

frontend_port=$(grep '^FRONTEND_PORT=' .env | cut -d= -f2- || true)
frontend_port=${frontend_port:-3000}
curl --fail \
  --retry 20 \
  --retry-delay 3 \
  "http://127.0.0.1:${frontend_port}/" >/dev/null

echo "Frontend healthy."

echo "AI-MARKS deployment is healthy."