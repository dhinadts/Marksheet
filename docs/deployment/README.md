# Deployment

## Local Docker runtime

`docker compose up -d --build` starts PostgreSQL, Redis, the API, AI service, and frontend.
The API applies committed Prisma migrations before starting. Application containers run as
non-root users and use Docker's no-new-privileges control. Run `scripts/smoke.ps1` on
Windows for a build, health, and HTTP smoke test. The optional AI worker starts with the
`ai-processing` profile.
