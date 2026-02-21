# VLPRS Production Deployment Guide

## Architecture

```
Internet → DNS (<DOMAIN>) → Droplet (<DROPLET_IP>)
  → Nginx (port 80) → HTTP→HTTPS redirect
  → Nginx (port 443) → SSL termination
    → /api/* → proxy to server:3001 (Docker internal network)
    → /* → serve React SPA
```

## Prerequisites

- DigitalOcean Droplet with Docker + Docker Compose
- Domain with A record pointing to Droplet IP
- GitHub repository with Actions enabled

## Droplet Directory Structure

```
/opt/vlprs/
├── compose.prod.yaml      # Production Docker Compose
├── .env                   # Production secrets (NEVER in repo)
├── certbot/
│   ├── conf/              # Let's Encrypt certificates
│   └── www/               # ACME challenge files
└── scripts/
    └── init-letsencrypt.sh
```

## Initial Setup

### 1. Droplet Preparation

> **Security note:** Create a dedicated deploy user instead of using root.
> Run `adduser deploy && usermod -aG docker deploy` then use that user for all operations.
> Disable root SSH login in `/etc/ssh/sshd_config` (`PermitRootLogin no`).

```bash
ssh <DROPLET_USER>@<DROPLET_IP>
apt update && apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
mkdir -p /opt/vlprs
```

### 2. Production Environment File

Create `/opt/vlprs/.env`:

```bash
cat > /opt/vlprs/.env << 'EOF'
# Database (PostgreSQL in Docker)
DATABASE_URL=postgresql://vlprs:YOUR_STRONG_PASSWORD@db:5432/vlprs_prod
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD

# JWT
JWT_SECRET=GENERATE_64_CHAR_RANDOM_STRING
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Server
PORT=3001
NODE_ENV=production

# CSRF
CSRF_SECRET=GENERATE_64_CHAR_RANDOM_STRING

# Session
INACTIVITY_TIMEOUT_MINUTES=30

# Initial admin (for production seed)
SUPER_ADMIN_EMAIL=admin@oyo.gov.ng
SUPER_ADMIN_PASSWORD=STRONG_PASSWORD_HERE
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin
EOF
```

Generate random secrets:
```bash
openssl rand -hex 32  # Run twice: once for JWT_SECRET, once for CSRF_SECRET
```

### 3. Login to GitHub Container Registry

```bash
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 4. Clone Repository to Droplet

The CI/CD pipeline uses `git pull` to keep the Droplet in sync with `main`. Clone the repo once during initial setup:

```bash
ssh <DROPLET_USER>@<DROPLET_IP>
cd /opt
git clone https://github.com/<owner>/vlprs.git
cd vlprs
```

> **Note:** The full repository is cloned to the Droplet so that `compose.prod.yaml`,
> `scripts/`, and `nginx/` configs stay in sync with the codebase on each deploy.
> Application code runs inside Docker containers (not directly from the repo).

### 5. SSL Certificate Setup

```bash
ssh <DROPLET_USER>@<DROPLET_IP>
cd /opt/vlprs
chmod +x scripts/init-letsencrypt.sh
./scripts/init-letsencrypt.sh
```

### 6. Start All Services

```bash
cd /opt/vlprs
docker compose -f compose.prod.yaml up -d
```

### 7. Apply Database Schema

Schema is auto-applied on every CI/CD deploy. For initial manual setup:

```bash
cat scripts/init-schema.sql | docker exec -i vlprs-db-1 psql -U vlprs -d vlprs_prod
```

> **Note:** `drizzle-kit` is a dev dependency and is NOT available in the production image.
> Use `init-schema.sql` for all schema operations in production.

### 8. Run Production Seed

The production seed uses a direct SQL INSERT with a pre-hashed bcrypt password
(bcrypt compilation fails in ESM production containers):

```bash
# Generate a bcrypt hash for the super admin password:
# Use an online tool or: node -e "require('bcrypt').hash('PASSWORD', 12).then(h => console.log(h))"
# Then insert directly:
docker exec -i vlprs-db-1 psql -U vlprs -d vlprs_prod <<SQL
INSERT INTO users (id, email, hashed_password, first_name, last_name, role, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'admin@oyo.gov.ng', '<BCRYPT_HASH>', 'Super', 'Admin', 'super_admin', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
SQL
```

> **Note:** `pnpm seed:prod` is NOT available in the production container.

### 9. Verify

```bash
curl -sf https://<DOMAIN>/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

## CI/CD Pipeline

### How It Works

1. Push to PR → CI runs (lint, typecheck, test)
2. PR shows green/red check
3. Merge to main → CI runs + CD deploys
4. CD builds Docker images → pushes to ghcr.io → SSHs to Droplet → pulls + restarts

### GitHub Actions Secrets Required

| Secret | Value |
|---|---|
| `DROPLET_IP` | Droplet public IPv4 (from DigitalOcean dashboard) |
| `DROPLET_USER` | SSH username (use a dedicated deploy user, not root) |
| `DROPLET_SSH_KEY` | SSH private key (entire PEM content) |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions |

### Setting Up Secrets

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret from the table above

## Rollback Procedure

If a deployment introduces a breaking change:

```bash
ssh <DROPLET_USER>@<DROPLET_IP>
cd /opt/vlprs

# Rollback to a previous commit SHA using IMAGE_TAG
export IMAGE_TAG=<previous-commit-sha>
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml up -d

# Verify
curl -sf https://<DOMAIN>/api/health
```

> **Note:** `compose.prod.yaml` uses `${IMAGE_TAG:-latest}` for image tags.
> Set `IMAGE_TAG` to any commit SHA that was previously deployed.
> To find recent SHA tags: `docker image ls ghcr.io/awwallawal/vlprs-server`

## Monitoring

- **UptimeRobot:** Pings `GET https://<DOMAIN>/api/health` every 5 minutes
- **Logs:** `docker compose -f compose.prod.yaml logs -f server`
- **Service status:** `docker compose -f compose.prod.yaml ps`

## Common Operations

```bash
# View logs
docker compose -f compose.prod.yaml logs -f server
docker compose -f compose.prod.yaml logs -f client

# Restart services
docker compose -f compose.prod.yaml restart

# Stop all services
docker compose -f compose.prod.yaml down

# Update (manual deploy)
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml up -d
docker image prune -f
```
