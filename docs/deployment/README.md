# Deployment

## Local Docker runtime

`docker compose up -d --build` starts PostgreSQL, Redis, the API, AI service, and frontend.
The API applies committed Prisma migrations before starting. Application containers run as
non-root users and use Docker's no-new-privileges control. Run `scripts/smoke.ps1` on
Windows for a build, health, and HTTP smoke test. The optional AI worker starts with the
`ai-processing` profile.

## Production

The Terraform foundation targets AWS ECS/Fargate, RDS PostgreSQL, ElastiCache Redis, S3,
ECR, KMS, and CloudWatch. GitHub Actions authenticates through OIDC—never static AWS keys.
Production changes require the protected `production` environment and an explicit manual
apply selection. Take an RDS snapshot before schema migrations; deploy API tasks with a
one-off migration task, then roll services gradually. Roll back application images by
digest. Database migrations require forward repair rather than destructive reset. Enable
AWS Backup, RDS snapshots, S3 versioning, alarms, access logging, Sentry, and tested restore
drills before go-live.
