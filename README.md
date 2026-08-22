# AI-MARKS

AI-MARKS is a multi-tenant examination mark digitization system. It captures mark-sheet
images, runs advisory AI extraction, lets authorized people review every individual mark,
calculates totals from verified values, and produces reports and private exports.

This guide explains how to run the project:

1. On a local Windows, macOS, or Linux computer using Docker.
2. On an AWS EC2 Ubuntu server using Docker Compose.

> AI suggestions never finalize marks. A reviewer must validate individual marks before
> calculation or export.

## Project components

| Component | Technology | Default address |
| --- | --- | --- |
| Web application | Next.js | `http://localhost:3000` |
| Main API and Swagger | NestJS | `http://localhost:3001` and `/api/docs` |
| AI service | FastAPI | `http://localhost:8000/health` |
| Database | PostgreSQL 17 | `localhost:5432` |
| Queue/cache | Redis 7 | `localhost:6379` |
| Mobile application | Flutter | Runs separately on Android/iOS |

Question numbers, question parts, maximum marks, confidence thresholds, and paper totals
are versioned administrator data. They are not hard-coded application rules.

## Before you start

The easiest setup uses Docker Compose. Install:

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows/macOS, or Docker Engine on Linux
- An AWS account and a private S3 bucket if you want image upload and export downloads

Docker Desktop users must start Docker Desktop and wait until its engine says it is running.

## Local installation with Docker

### 1. Download the project

Open PowerShell, Terminal, or a Linux shell:

```sh
git clone https://github.com/dhinadts/Marksheet.git
cd Marksheet
```

If you already have the project, enter its folder instead. In this development workspace
the folder is `D:\Nagarajan`.

### 2. Create the environment file

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```sh
cp .env.example .env
```

Open `.env` in a text editor. At minimum, replace these values:

```env
NODE_ENV=development

POSTGRES_DB=university_Marksheets
POSTGRES_USER=ai_marks
POSTGRES_PASSWORD=choose-a-long-local-database-password
DATABASE_URL=postgresql://ai_marks:choose-a-long-local-database-password@postgres:5432/university_Marksheets?schema=public

JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
AI_INTERNAL_API_KEY=replace-with-another-long-random-secret

SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=choose-a-password-at-least-12-characters

CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

The password in `POSTGRES_PASSWORD` and `DATABASE_URL` must be identical. URL-encode
special characters in `DATABASE_URL`; beginners can initially use letters, digits, `_`,
and `-` to avoid URL-encoding mistakes.

Generate a random secret with Node.js if needed:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run it twice and use different values for `JWT_SECRET` and `AI_INTERNAL_API_KEY`.

### 3. Configure private S3 storage

Without S3 configuration, the application and reports can start, but image upload and
generated export storage will fail.

Create a private S3 bucket in the AWS console. Keep **Block all public access** enabled.
Create a dedicated IAM identity with access only to that bucket, then add this to `.env`:

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=replace-with-dedicated-access-key
AWS_SECRET_ACCESS_KEY=replace-with-dedicated-secret-key
AWS_S3_BUCKET=replace-with-private-bucket-name
AWS_S3_ENDPOINT=
AWS_S3_FORCE_PATH_STYLE=false
UPLOAD_URL_TTL_SECONDS=900
EXPORT_TTL_HOURS=24
EXPORT_MAX_ROWS=10000
```

Never commit `.env` or real AWS credentials. For browser/mobile direct uploads, configure
the bucket CORS policy for the origins that will use the application. A local example is:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 4. Build and start everything

```sh
docker compose up -d --build
```

The first build can take several minutes. Check service status:

```sh
docker compose ps
```

All main services should eventually show `running` or `healthy`. Watch logs if a service
does not start:

```sh
docker compose logs -f backend
docker compose logs -f ai-service
docker compose logs -f frontend
```

The backend automatically applies committed Prisma migrations when its container starts.

### 5. Load demonstration data

```sh
docker compose exec backend npm run db:seed
```

The seed is idempotent, so it is safe to run again. It creates:

- Tenant ID: `00000000-0000-4000-8000-000000000001`
- Demo university, college, department, class, section, and subject
- 20 demo students
- Question paper `Q0013`
- A configurable 100-mark scheme
- The administrator configured by `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`

### 6. Verify the services

Open these addresses:

- Web: [http://localhost:3000](http://localhost:3000)
- Swagger API: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- Backend health/identity: [http://localhost:3001](http://localhost:3001)
- AI health: [http://localhost:8000/health](http://localhost:8000/health)

Windows users can run the automated smoke script:

```powershell
.\scripts\smoke.ps1
```

### 7. Log in and use the current web screens

The current web application has review and report screens, but it does not yet include a
web login form. Obtain an access token through Swagger:

1. Open `http://localhost:3001/api/docs`.
2. Expand `POST /auth/login` and select **Try it out**.
3. Submit:

   ```json
   {
     "tenantId": "00000000-0000-4000-8000-000000000001",
     "email": "admin@example.test",
     "password": "the-password-from-SEED_ADMIN_PASSWORD"
   }
   ```

4. Copy `accessToken` from the response.
5. Open `http://localhost:3000`, press `F12`, select **Console**, and run:

   ```js
   sessionStorage.setItem('ai_marks_access_token', 'PASTE_ACCESS_TOKEN_HERE')
   ```

6. Refresh the page. Open `/reports`, or enter a mark-sheet UUID on the home page.

The token is removed when the browser session ends. Do not paste a production token into
screenshots, messages, or source files.

## Useful local commands

```sh
# Stop containers but keep database data
docker compose down

# Stop containers and delete local PostgreSQL/Redis volumes (destructive)
docker compose down -v

# Restart after configuration changes
docker compose up -d --build

# View all logs
docker compose logs -f

# Run the optional AI worker
docker compose --profile ai-processing up -d ai-worker

# Apply migrations manually
docker compose exec backend npm run db:migrate

# Seed demo data
docker compose exec backend npm run db:seed
```

## Running tests locally

For application development, also install Node.js 20+, Python 3.12+, and Flutter. Then:

```sh
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run prisma:validate

python -m pip install -e "./ai-service[dev]"
python -m ruff check ai-service
python -m mypy ai-service/app
python -m pytest ai-service/tests

cd mobile
flutter pub get
flutter analyze
flutter test
```

## Flutter mobile application

The mobile application is not started by Docker Compose. Install Flutter and connect a
device or emulator.

Android emulator:

```sh
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001
```

Physical phone on the same Wi-Fi:

```sh
flutter run --dart-define=API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:3001
```

Allow port `3001` through the computer firewall when using a physical phone.

## AWS EC2 Ubuntu deployment

This section describes a simple single-server deployment suitable for demonstration or
controlled pilot use. A high-availability production deployment should use the Terraform
foundation in `infrastructure/terraform`, RDS, ElastiCache, ECS, an Application Load
Balancer, ACM certificates, managed secrets, monitoring, and tested backups.

### 1. Create the EC2 instance

In AWS EC2:

1. Choose Ubuntu Server 24.04 LTS.
2. Use at least `t3.large` for the complete stack; AI inference may require a larger or GPU instance.
3. Allocate at least 40 GB of encrypted storage.
4. Attach an Elastic IP so the public address does not change.
5. Configure the security group:

   | Port | Source | Purpose |
   | --- | --- | --- |
   | 22 | Your public IP only | SSH |
   | 80 | Anywhere | HTTP used for certificate setup and redirect |
   | 443 | Anywhere | HTTPS web application and API |

Do not expose PostgreSQL `5432`, Redis `6379`, or AI port `8000` publicly. For a public
production site, expose only ports 80/443 through Nginx or an AWS load balancer.

### 2. Connect by SSH

```sh
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### 3. Install Docker and Git

```sh
sudo apt update
sudo apt install -y ca-certificates curl git nginx certbot python3-certbot-nginx
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
exit
```

Reconnect by SSH so the Docker group change takes effect, then verify:

```sh
docker --version
docker compose version
```

### 4. Clone and configure AI-MARKS

```sh
git clone https://github.com/dhinadts/Marksheet.git
cd Marksheet
cp deploy/ec2/env.example .env
nano .env
```

Use strong, unique production values. The supplied example already binds all containers
to localhost and configures `marksheet.dhinadts.com` for the web UI and
`api.dhinadts.com` for the backend API:

```env
NODE_ENV=production
HOST_BIND_ADDRESS=127.0.0.1

POSTGRES_DB=university_Marksheets
POSTGRES_USER=ai_marks
POSTGRES_PASSWORD=REPLACE_WITH_A_LONG_RANDOM_DATABASE_PASSWORD
DATABASE_URL=postgresql://ai_marks:REPLACE_WITH_THE_SAME_PASSWORD@postgres:5432/university_Marksheets?schema=public
REDIS_URL=redis://redis:6379

JWT_SECRET=REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS
AI_INTERNAL_API_KEY=REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
AUTH_MAX_FAILED_ATTEMPTS=5

CORS_ORIGINS=https://marksheet.dhinadts.com
NEXT_PUBLIC_API_URL=https://api.dhinadts.com
AI_SERVICE_URL=http://ai-service:8000
AI_ENVIRONMENT=production

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=REPLACE_WITH_DEDICATED_KEY
AWS_SECRET_ACCESS_KEY=REPLACE_WITH_DEDICATED_SECRET
AWS_S3_BUCKET=REPLACE_WITH_PRIVATE_BUCKET
AWS_S3_ENDPOINT=
AWS_S3_FORCE_PATH_STYLE=false

SEED_ADMIN_EMAIL=admin@your-domain.example
SEED_ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_ADMIN_PASSWORD
```

Update the S3 CORS `AllowedOrigins` value to `https://marksheet.dhinadts.com`. Do not use
`*` for production CORS.

Protect the environment file:

```sh
chmod 600 .env
```

Before starting, create DNS `A` records for both domains pointing to the EC2 Elastic IP.
Install the included Nginx configuration:

```sh
sudo cp deploy/ec2/ai-marks.nginx.conf /etc/nginx/sites-available/ai-marks
sudo ln -s /etc/nginx/sites-available/ai-marks /etc/nginx/sites-enabled/ai-marks
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Start, seed, and verify

```sh
chmod +x deploy/ec2/deploy.sh
./deploy/ec2/deploy.sh
docker compose ps
docker compose exec backend npm run db:seed
curl http://localhost:3001/
curl http://localhost:8000/health
curl -I http://localhost:3000/
```

The deployment script creates `university_Marksheets` if it does not exist, applies
committed migrations, and checks the UI and API. It does not delete or replace an
existing database. Then enable HTTPS:

```sh
sudo certbot --nginx -d marksheet.dhinadts.com -d api.dhinadts.com
```

From your own computer, open:

- `https://marksheet.dhinadts.com`
- `https://api.dhinadts.com/api/docs`

Follow the earlier Swagger login instructions using the seeded tenant ID and production
administrator credentials.

### 6. Enable the AI worker

```sh
docker compose --profile ai-processing up -d ai-worker
docker compose logs -f ai-worker
```

If no valid ONNX model path and checksum are configured, the service remains a prototype
pipeline and must not be represented as having production handwriting accuracy.

### 7. Updating the EC2 deployment

Take a database backup before migrations or major releases. Then:

```sh
cd ~/Marksheet
git pull --ff-only origin main
./deploy/ec2/deploy.sh
docker compose ps
docker compose logs --tail=100 backend
```

The backend container applies forward Prisma migrations before starting. Never use
`prisma migrate reset` on production data.

### 8. Backing up the EC2 database

Create a backup directory and dump PostgreSQL:

```sh
mkdir -p ~/ai-marks-backups
docker compose exec -T postgres pg_dump -U ai_marks -d university_Marksheets -Fc > ~/ai-marks-backups/university_Marksheets_$(date +%F_%H%M).dump
```

Copy backups to encrypted S3 and test restoration regularly. A database backup does not
replace S3 object versioning; both database records and mark-sheet files are required.

### 9. HTTPS and domain mapping

The included Nginx and Certbot steps terminate HTTPS with this mapping:

```env
CORS_ORIGINS=https://marksheet.dhinadts.com
NEXT_PUBLIC_API_URL=https://api.dhinadts.com
```

Only ports 80/443 should remain publicly accessible after the reverse proxy is working.

## Troubleshooting

### Docker cannot connect

Start Docker Desktop, or on Ubuntu run:

```sh
sudo systemctl enable --now docker
```

### Backend repeatedly restarts

```sh
docker compose logs --tail=200 backend
```

Check that `JWT_SECRET` is at least 32 characters, passwords match, required AWS settings
exist in production, and `DATABASE_URL` contains the Docker hostname `postgres`.

If the log shows Prisma `P1000`, PostgreSQL was previously initialized with credentials
different from `.env`. Docker does not change an existing database user's password when
`POSTGRES_PASSWORD` changes. Preserve the data by restoring the original password in both
`POSTGRES_PASSWORD` and `DATABASE_URL`. Only when the local data is disposable, use the
reset procedure below to initialize `university_Marksheets` with the new credentials.

If Docker reports that port `5432` is already in use, another PostgreSQL installation is
running on the host. Either stop that instance or set `POSTGRES_HOST_PORT=5433` in `.env`.
Containers still connect internally to `postgres:5432`; do not change the Compose
`DATABASE_URL` port.

### Frontend calls localhost on EC2

`NEXT_PUBLIC_API_URL` is embedded during the frontend image build. Correct `.env`, then
force a rebuild:

```sh
docker compose build --no-cache frontend
docker compose up -d frontend
```

### Seeded administrator cannot log in

Ensure the seed completed and use the fixed demo tenant ID:

```sh
docker compose exec backend npm run db:seed
```

Passwords must contain at least 12 characters.

### Upload reports that the bucket is unavailable

Verify the AWS region, bucket name, dedicated credentials, S3 permissions, bucket CORS,
and EC2 clock. Signed requests fail when the system clock is incorrect.

### Resetting local data

Only do this for disposable local development data:

```sh
docker compose down -v
docker compose up -d --build
docker compose exec backend npm run db:seed
```

Never run this reset procedure on an EC2 production or pilot database.

## Security checklist before real use

- Replace every placeholder and use unique secrets.
- Keep `.env` readable only by the deployment user.
- Restrict SSH to administrator IP addresses.
- Do not expose PostgreSQL, Redis, or the AI service publicly.
- Use HTTPS and a trusted domain.
- Keep the S3 bucket private with public access blocked.
- Use least-privilege AWS credentials and rotate them.
- Enable encrypted backups, monitoring, alarms, and restore drills.
- Review audit logs and user permissions.
- Never claim unmeasured AI accuracy.

## Additional documentation

- [API documentation](docs/api/README.md)
- [Architecture](docs/architecture/system-architecture.md)
- [Database design](docs/database/database-design.md)
- [Security](docs/security/README.md)
- [Testing](docs/testing/README.md)
- [Deployment](docs/deployment/README.md)
- [AWS Terraform foundation](infrastructure/terraform/README.md)

## Current limitations

- The web interface currently requires a token obtained through the API; a web login page is not yet included.
- A production ONNX handwriting model and measured accuracy are deployment-specific.
- The simple EC2 Compose topology is not highly available.
- PDF export currently replaces unsupported non-ASCII glyphs.
- Terraform provisions the AWS foundation; environment-specific ECS services, load balancers, DNS, certificates, autoscaling, and alarms still require deployment decisions.
