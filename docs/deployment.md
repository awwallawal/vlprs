# VLPRS Production Deployment Guide

## Architecture

```
Internet → DNS (oyocarloan.com.ng) → Droplet (161.35.146.183)
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

```bash
ssh root@161.35.146.183
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

### 4. Copy Production Files to Droplet

```bash
# From your local machine:
scp compose.prod.yaml root@161.35.146.183:/opt/vlprs/
scp -r scripts/ root@161.35.146.183:/opt/vlprs/
```

### 5. SSL Certificate Setup

```bash
ssh root@161.35.146.183
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

```bash
docker compose -f compose.prod.yaml exec server pnpm db:push
```

### 8. Apply Audit Log Triggers

```bash
docker compose -f compose.prod.yaml exec server node dist/db/applyTriggers.js
```

### 9. Run Production Seed

```bash
docker compose -f compose.prod.yaml exec server pnpm seed:prod
```

### 10. Verify

```bash
curl -sf https://oyocarloan.com.ng/api/health
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
| `DROPLET_IP` | `161.35.146.183` |
| `DROPLET_USER` | `root` |
| `DROPLET_SSH_KEY` | SSH private key (entire PEM content) |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions |

### Setting Up Secrets

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret from the table above

## Rollback Procedure

If a deployment introduces a breaking change:

```bash
ssh root@161.35.146.183
cd /opt/vlprs

# Pull the previous working version by commit SHA
docker compose -f compose.prod.yaml pull ghcr.io/awwallawal/vlprs-server:<previous-sha>
docker compose -f compose.prod.yaml pull ghcr.io/awwallawal/vlprs-client:<previous-sha>

# Or edit compose.prod.yaml to pin specific image tags
# Then restart
docker compose -f compose.prod.yaml up -d

# Verify
curl -sf https://oyocarloan.com.ng/api/health
```

## Monitoring

- **UptimeRobot:** Pings `GET https://oyocarloan.com.ng/api/health` every 5 minutes
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
