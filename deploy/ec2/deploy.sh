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

ensure_secret() {
  local name="$1"
  local current
  current=$(grep -E "^${name}=" .env | tail -n 1 | cut -d= -f2- || true)
  if [[ -n "$current" && "$current" != REPLACE_* && "$current" != change-me* ]]; then
    export "${name}=${current}"
    return
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    echo "${name} is missing and openssl is unavailable. Set ${name} in .env." >&2
    exit 1
  fi
  local generated
  generated=$(openssl rand -hex 32)
  if grep -qE "^${name}=" .env; then
    sed -i -E "s|^${name}=.*$|${name}=${generated}|" .env
  else
    printf '\n%s=%s\n' "$name" "$generated" >> .env
  fi
  export "${name}=${generated}"
  echo "Generated and saved ${name} in .env."
}

# Backend and AI service authenticate internal requests with the same persisted
# secret. Generate it once when an older deployment .env does not contain it.
ensure_secret AI_INTERNAL_API_KEY

cors_origins=$(grep '^CORS_ORIGINS=' .env | tail -n 1 | cut -d= -f2- || true)
if [[ -z "$cors_origins" || "$cors_origins" == "http://localhost:3000" ]]; then
  cors_origins="https://marksheet.dhinadts.com"
  if grep -q '^CORS_ORIGINS=' .env; then
    sed -i -E "s|^CORS_ORIGINS=.*$|CORS_ORIGINS=${cors_origins}|" .env
  else
    printf '\nCORS_ORIGINS=%s\n' "$cors_origins" >> .env
  fi
  export CORS_ORIGINS="$cors_origins"
  echo "Updated and saved CORS_ORIGINS for the production web application."
fi

database_url=$(grep '^DATABASE_URL=' .env | cut -d= -f2- || true)
if [[ -z "$database_url" ]]; then
  echo "DATABASE_URL is missing from .env." >&2
  exit 1
fi
if [[ "$database_url" =~ @(localhost|127\.0\.0\.1): ]]; then
  database_url=$(printf '%s' "$database_url" | sed -E 's/@(localhost|127\.0\.0\.1):/@postgres:/')
  sed -i -E "s|^DATABASE_URL=.*$|DATABASE_URL=${database_url}|" .env
  export DATABASE_URL="$database_url"
  echo "Updated and saved DATABASE_URL to use the Docker PostgreSQL service."
fi

echo "Starting PostgreSQL, Redis, AI service and persistent AI worker..."

docker compose --profile ai-processing up -d --build postgres redis ai-service ai-worker

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

# Build only this image. `up --build backend` also rebuilds every dependency
# (PostgreSQL, Redis and AI service) on some Compose versions.
docker compose --progress plain build backend
docker compose up -d --no-deps --force-recreate backend

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

# Next.js compilation can take several minutes on small EC2 instances. Keep the
# output visible and do not rebuild backend or its dependencies a second time.
docker compose --progress plain build frontend
docker compose up -d --no-deps --force-recreate frontend

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
