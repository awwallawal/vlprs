# Story 1.7: CI/CD Pipeline & Production Infrastructure

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-19 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocks: 1.8a (Design Foundation), 1.8b (Role-Specific Screens — requires deployed URL for client access) -->
<!-- Blocked By: 1.1 (Monorepo Scaffold), 1.2 (Auth — login endpoint for spike), 1.6 (Frontend Shell — Playwright tests in CI) -->
<!-- FRs: (infrastructure, no direct FR) | NFRs: NFR-REL-1/NFR-AVAIL-1 (99.5% business hours), NFR-REL-2 (zero data loss — managed PG backups), NFR-REL-4 (<4hr RTO), NFR-SEC-3/NFR-SEC-1 (TLS 1.2+), NFR-SEC-8 (secrets management) -->

## Story

As the **development team**,
I want automated testing, building, and deployment on every merge to main,
so that the system is always live with the latest verified code and deployments are atomic and reliable.

## Acceptance Criteria (BDD)

### AC1: Spike-First Validation (End-to-End Pipeline Proof)

```gherkin
Given a fresh DigitalOcean Droplet with Docker and Docker Compose installed
When I deploy the VLPRS application through the full pipeline:
  GitHub Actions → Docker build → push to ghcr.io → SSH to Droplet → docker compose pull + up → Nginx → SSL
Then the target domain (or Droplet IP) responds with the VLPRS application over HTTPS
And SSL termination via Let's Encrypt + Certbot is confirmed working
And HTTP requests are redirected to HTTPS
And the full pipeline path is validated end-to-end before investing in further optimisations

Given the spike deployment is working
When I verify the health endpoint
Then GET https://<domain>/api/health returns { status: "ok", timestamp: "..." } with 200
```

### AC2: GitHub Actions CI Pipeline

```gherkin
Given a GitHub Actions workflow file at .github/workflows/ci.yml
When a pull request is opened or updated targeting main
Then the pipeline runs these stages in order:
  1. Install dependencies (pnpm install --frozen-lockfile)
  2. Lint (pnpm lint)
  3. Typecheck (pnpm typecheck)
  4. Test (pnpm test)
And if any stage fails, the pipeline stops and the PR shows a red check

When all stages pass
Then the PR shows a green check
And the pipeline completes in under 5 minutes (target)
```

### AC3: GitHub Actions CD Pipeline (Deploy on Merge)

```gherkin
Given the CI pipeline passes
When a PR is merged to main (push event on main)
Then the pipeline additionally runs:
  5. Build Docker images for server and client (multi-stage, production target)
  6. Push images to ghcr.io (GitHub Container Registry) tagged with commit SHA and "latest"
  7. SSH to the DigitalOcean Droplet
  8. Pull new images and restart services: docker compose -f compose.prod.yaml pull && docker compose -f compose.prod.yaml up -d
And the deployment is atomic — new containers start, health check passes, old containers stop
And the deployment completes in under 3 minutes (excluding CI stages)
```

### AC4: Production Docker Compose with SSL

```gherkin
Given compose.prod.yaml is deployed on the Droplet
When docker compose -f compose.prod.yaml up -d is run
Then the following services start:
  - server: Express application on internal port 3001 (NOT exposed to host)
  - client (nginx): Serves React SPA, proxies /api/* to server:3001, terminates SSL
  - certbot: Let's Encrypt certificate issuance and auto-renewal
And PostgreSQL is external (managed database or separate Droplet service — NOT in compose.prod.yaml)
And Nginx listens on ports 80 (HTTP → HTTPS redirect) and 443 (SSL)
And internal services communicate via Docker network (server port NOT exposed externally)
And all services have health checks and restart: unless-stopped
And docker compose -f compose.prod.yaml logs shows structured JSON output from server
```

### AC5: Improved Production Dockerfiles

```gherkin
Given the existing multi-stage Dockerfiles
When Docker images are built for production
Then the server image uses pnpm deploy --prod --filter server to create a minimal production bundle
And the server production stage copies only the deployed output (not full node_modules)
And the client image builds the React SPA with Vite and serves via Nginx
And both images use non-root users in production
And both images have HEALTHCHECK instructions
And final production images are as small as practical (< 200MB server, < 50MB client target)
```

### AC6: Branch Protection on main

```gherkin
Given the GitHub repository
When branch protection rules are configured for main
Then direct pushes to main are rejected
And PRs require at least 1 approval (can be self-approval for solo dev)
And PRs require CI status checks to pass before merging
And force pushes to main are disabled
And the dev branch allows direct pushes (no protection)
```

### AC7: Production Initial Seed

```gherkin
Given the production environment is deployed for the first time
When I run the production seed via: docker compose -f compose.prod.yaml exec server pnpm seed:prod
Then an initial super admin account is created using SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD from environment variables
And the script is idempotent — running it again does not create duplicates
And credentials are NEVER hardcoded (sourced from .env on Droplet only)

Note: The seed-production.ts script already exists (Story 1.2). This story ensures it's runnable in the containerised production environment.
```

### AC8: Tests & Verification

```gherkin
Given Story 1.7 is implemented
When I run pnpm test from the monorepo root
Then all existing tests from Stories 1.1-1.6 continue to pass

When I push a commit to a PR targeting main
Then the CI pipeline runs and reports status on the PR

When I merge a PR to main
Then the CD pipeline deploys to the Droplet automatically
And the health endpoint returns 200 within 60 seconds of deployment completing
```

### AC9: Monitoring Foundation & Rollback Procedure

```gherkin
Given the production deployment is live
When UptimeRobot is configured to ping GET /api/health every 5 minutes
Then email alerts fire on downtime
And 99.5% availability SLA (NFR-REL-1) is tracked during business hours (Mon-Fri, 8am-6pm WAT)

Given DigitalOcean Managed PostgreSQL is the production database
Then automated daily backups with 7-day retention are enabled (NFR-REL-2)
And point-in-time recovery is available (NFR-REL-4: <4 hours RTO)

Given a deployment introduces a breaking change
When the team needs to rollback
Then docker compose -f compose.prod.yaml pull ghcr.io/…/server:<previous-commit-sha> reverts to the previous working version
And the rollback procedure is documented in docs/deployment.md
```

## Tasks / Subtasks

- [ ] Task 1: Spike — Validate full pipeline end-to-end (AC: #1)
  - [ ] 1.1 Ensure DigitalOcean Droplet is provisioned with Docker + Docker Compose installed, SSH key configured
  - [ ] 1.2 Create a GitHub Personal Access Token (classic) with `write:packages` and `read:packages` scopes, store as GitHub Actions secret `GHCR_TOKEN`
  - [ ] 1.3 Add GitHub Actions secrets: `DROPLET_IP`, `DROPLET_SSH_KEY` (private key), `DROPLET_USER` (e.g., `root` or `deploy`), `GHCR_TOKEN`
  - [ ] 1.4 Create minimal `.github/workflows/deploy.yml` that builds and pushes current app to ghcr.io, SSHs to Droplet, pulls and runs
  - [ ] 1.5 On Droplet: create `/opt/vlprs/` directory, place `.env` file with production secrets (DATABASE_URL, JWT_SECRET, etc.)
  - [ ] 1.6 Verify the application responds on `http://<DROPLET_IP>` — spike validated
  - [ ] 1.7 If spike fails: debug, fix, redeploy. Do NOT proceed to Task 2 until the full pipeline path works

- [ ] Task 2: GitHub Actions CI workflow (AC: #2)
  - [ ] 2.1 Create `.github/workflows/ci.yml` — triggers on `pull_request` targeting `main` and on `push` to `main`
  - [ ] 2.2 Use `pnpm/action-setup@v4` BEFORE `actions/setup-node@v4` (order matters — pnpm must be available for setup-node caching)
  - [ ] 2.3 Configure `actions/setup-node@v4` with `node-version: 22`, `cache: 'pnpm'`
  - [ ] 2.4 CI stages (sequential jobs or steps): `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test`
  - [ ] 2.5 Set `fail-fast: true` — stop pipeline on first failure
  - [ ] 2.6 Use `concurrency` group to cancel in-progress runs when new commits push to same PR

- [ ] Task 3: GitHub Actions CD workflow — build & deploy (AC: #3)
  - [ ] 3.1 Add CD steps to `.github/workflows/ci.yml` — runs only on `push` to `main` (not on PR), after CI stages pass
  - [ ] 3.2 Login to ghcr.io: `docker/login-action@v3` with `registry: ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}`
  - [ ] 3.3 Build and push server image: `docker/build-push-action@v6` with `context: .`, `file: Dockerfile.server`, `target: production`, `push: true`, tags `ghcr.io/<owner>/vlprs-server:${{ github.sha }}` and `ghcr.io/<owner>/vlprs-server:latest`
  - [ ] 3.4 Build and push client image: same pattern for `Dockerfile.client`
  - [ ] 3.5 Enable Docker BuildKit cache: `cache-from: type=gha`, `cache-to: type=gha,mode=max` on both build-push-action steps
  - [ ] 3.6 Deploy via SSH: `appleboy/ssh-action@v1` — connect to Droplet, run:
    ```bash
    cd /opt/vlprs
    docker compose -f compose.prod.yaml pull
    docker compose -f compose.prod.yaml up -d
    docker image prune -f
    ```
  - [ ] 3.7 Add secrets to ssh-action: `host: ${{ secrets.DROPLET_IP }}`, `username: ${{ secrets.DROPLET_USER }}`, `key: ${{ secrets.DROPLET_SSH_KEY }}`
  - [ ] 3.8 Add post-deploy health check step: `curl -sf https://<domain>/api/health || exit 1` (or use a simple HTTP check action)

- [ ] Task 4: Production Nginx configuration with SSL (AC: #4)
  - [ ] 4.1 Create `nginx/nginx.prod.conf` — production Nginx config with:
    - HTTP server block (port 80): redirect all traffic to HTTPS, except `.well-known/acme-challenge/` (Certbot verification)
    - HTTPS server block (port 443): SSL certificate paths, serve React SPA, proxy `/api/*` to `server:3001`
    - SSL configuration: TLS 1.2+, modern cipher suite, HSTS header (`max-age=31536000; includeSubDomains`)
    - Security headers: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `X-XSS-Protection 1; mode=block`, `Referrer-Policy strict-origin-when-cross-origin`
    - Gzip compression for text/html, text/css, application/json, application/javascript
    - Static asset caching: `Cache-Control: public, immutable` with 1-year expiry for hashed assets
    - Client body size limit: `client_max_body_size 10m` (for CSV uploads)
  - [ ] 4.2 Keep existing `nginx.conf` for development Docker Compose (rename if needed for clarity)
  - [ ] 4.3 Create `certbot/` directory placeholder — Certbot volumes will mount here

- [ ] Task 5: Production Docker Compose (AC: #4)
  - [ ] 5.1 Update `compose.prod.yaml` with production-ready configuration:
    ```yaml
    services:
      server:
        image: ghcr.io/<owner>/vlprs-server:latest
        env_file: .env
        expose:
          - "3001"    # Internal only — NOT ports
        healthcheck:
          test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/api/health"]
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 10s
        restart: unless-stopped
        networks:
          - internal

      client:
        image: ghcr.io/<owner>/vlprs-client:latest
        ports:
          - "80:80"
          - "443:443"
        volumes:
          - ./certbot/conf:/etc/letsencrypt:ro
          - ./certbot/www:/var/www/certbot:ro
        depends_on:
          server:
            condition: service_healthy
        restart: unless-stopped
        networks:
          - internal

      certbot:
        image: certbot/certbot:latest
        volumes:
          - ./certbot/conf:/etc/letsencrypt
          - ./certbot/www:/var/www/certbot
        entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h; done'"
        networks:
          - internal

    networks:
      internal:
        driver: bridge
    ```
  - [ ] 5.2 Remove `build:` directives from compose.prod.yaml — production pulls pre-built images from ghcr.io
  - [ ] 5.3 Server uses `env_file: .env` instead of inline environment variables (cleaner, all secrets in one file on Droplet)
  - [ ] 5.4 Server port is `expose: ["3001"]` not `ports: ["3001:3001"]` — internal traffic only, Nginx proxies

- [ ] Task 6: Improve production Dockerfiles (AC: #5)
  - [ ] 6.1 Update `Dockerfile.server` production stage:
    - Use `pnpm deploy --prod --filter server /app/deploy` in build stage to create a minimal production bundle
    - Production stage copies `/app/deploy` (only server deps + dist) instead of full `node_modules`
    - Add `HEALTHCHECK` instruction: `HEALTHCHECK --interval=30s --timeout=5s CMD wget --spider -q http://localhost:3001/api/health || exit 1`
    - Keep non-root user (`appuser`)
  - [ ] 6.2 Update `Dockerfile.client` production stage:
    - Copy `nginx/nginx.prod.conf` instead of `nginx.conf` for production target
    - Add `HEALTHCHECK` instruction: `HEALTHCHECK --interval=30s --timeout=5s CMD curl -sf http://localhost:80/ || exit 1` (or use wget)
    - Note: Nginx alpine has curl but not wget — use `curl -sf` or install wget
  - [ ] 6.3 Create `.dockerignore` if not exists — exclude: `node_modules`, `.env`, `.git`, `dist`, `*.md`, `.github`, `_bmad*`, `error.txt`, `playwright-report`, `test-results`
  - [ ] 6.4 Test builds locally: `docker build -f Dockerfile.server --target production -t vlprs-server:test .` and same for client
  - [ ] 6.5 Verify image sizes meet targets (server < 200MB, client < 50MB)

- [ ] Task 7: SSL setup — Let's Encrypt + Certbot (AC: #1, #4)
  - [ ] 7.1 Create `scripts/init-letsencrypt.sh` — initial certificate issuance script:
    - Download recommended TLS parameters (dhparam, ssl options) from Certbot GitHub
    - Create a dummy certificate so Nginx can start (Nginx won't start without valid SSL cert files)
    - Start Nginx with dummy cert
    - Delete dummy cert
    - Run `certbot certonly --webroot -w /var/www/certbot -d <domain> --email <email> --agree-tos --no-eff-email`
    - Reload Nginx with real cert
  - [ ] 7.2 Document the one-time setup: `ssh <droplet>` → `cd /opt/vlprs` → `chmod +x scripts/init-letsencrypt.sh` → `./scripts/init-letsencrypt.sh`
  - [ ] 7.3 Certbot auto-renewal handled by the certbot service in compose.prod.yaml (runs `certbot renew` every 12 hours)
  - [ ] 7.4 Add Nginx `reload` cron or signal on cert renewal — Certbot includes a deploy hook: `--deploy-hook "docker compose -f compose.prod.yaml exec client nginx -s reload"`

- [ ] Task 8: Branch protection (AC: #6)
  - [ ] 8.1 Configure branch protection on `main` via GitHub CLI or API:
    ```bash
    gh api repos/<owner>/<repo>/branches/main/protection \
      --method PUT \
      --field required_status_checks='{"strict":true,"contexts":["ci"]}' \
      --field enforce_admins=true \
      --field required_pull_request_reviews='{"required_approving_review_count":0}' \
      --field restrictions=null \
      --field allow_force_pushes=false \
      --field allow_deletions=false
    ```
  - [ ] 8.2 Note: `required_approving_review_count: 0` for solo dev — PR required but self-merge allowed. Increase to 1 when team grows.
  - [ ] 8.3 Verify: attempt direct push to `main` — should be rejected. Create PR → CI passes → merge succeeds.

- [ ] Task 9: Droplet production environment setup (AC: #1, #7)
  - [ ] 9.1 Document the Droplet setup steps in a `docs/deployment.md` (or inline in this story):
    - Install Docker + Docker Compose on Ubuntu
    - Create `/opt/vlprs/` directory structure
    - Place `.env` file with production secrets
    - Login to ghcr.io: `docker login ghcr.io -u <username> -p <token>`
    - Run initial SSL setup: `./scripts/init-letsencrypt.sh`
    - Start services: `docker compose -f compose.prod.yaml up -d`
    - Run production seed: `docker compose -f compose.prod.yaml exec server pnpm seed:prod`
  - [ ] 9.2 Add production environment variables to `.env.example` documentation:
    ```
    # Production deployment (Story 1.7)
    SUPER_ADMIN_EMAIL=
    SUPER_ADMIN_PASSWORD=
    SUPER_ADMIN_FIRST_NAME=
    SUPER_ADMIN_LAST_NAME=
    ```
  - [ ] 9.3 Verify production seed runs in container: `docker compose -f compose.prod.yaml exec server pnpm seed:prod`

- [ ] Task 10: Monitoring & rollback documentation (AC: #9)
  - [ ] 10.1 Set up UptimeRobot (free tier) to ping `GET https://<domain>/api/health` every 5 minutes with email alerts on downtime
  - [ ] 10.2 Verify DigitalOcean Managed PostgreSQL has automated daily backups enabled with 7-day retention (NFR-REL-2)
  - [ ] 10.3 Document rollback procedure in `docs/deployment.md`: pull previous SHA-tagged image → `docker compose up -d` → verify health
  - [ ] 10.4 Note: Weekly `pg_dump` to DO Spaces is deferred — Managed PG daily backups + point-in-time recovery satisfy NFR-REL-2/REL-4 for MVP. Add supplementary `pg_dump` cron when operational maturity increases.

- [ ] Task 11: Database schema application in production (AC: #1, #7)
  - [ ] 11.1 After first deployment, apply DB schema to production: `docker compose -f compose.prod.yaml exec server pnpm db:push`
  - [ ] 11.2 Verify audit_log immutability trigger is applied on production DB (Story 1.5's `applyTriggers.ts`)
  - [ ] 11.3 Document schema migration strategy in `docs/deployment.md`: for subsequent deployments, `drizzle-kit push` runs as part of the deploy sequence (post-deploy step or entrypoint script)
  - [ ] 11.4 Verify `trust proxy` setting in Express (`app.set('trust proxy', 'loopback')`) — required for correct `req.ip` extraction behind Nginx reverse proxy. If missing, audit log IP addresses will all be `127.0.0.1`. This setting should already exist from Story 1.5; verify it's present in `apps/server/src/app.ts`.

- [ ] Task 12: Verification & cleanup (AC: #8)
  - [ ] 12.1 Run `pnpm test` from monorepo root — all existing tests pass
  - [ ] 12.2 Run `pnpm lint` — no new lint errors
  - [ ] 12.3 Run `pnpm typecheck` — no type errors
  - [ ] 12.4 Push to a PR targeting `main` — verify CI pipeline runs and reports status
  - [ ] 12.5 Merge PR to `main` — verify CD pipeline deploys to Droplet
  - [ ] 12.6 Verify `https://<domain>/api/health` returns 200 with `{ status: "ok", timestamp: "..." }`
  - [ ] 12.7 Verify `https://<domain>` serves the React SPA (login page or landing page)
  - [ ] 12.8 Clean up any spike/temporary files

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 7 of 58** — the **deployment foundation**. Every subsequent story auto-deploys to the client's domain on merge to `main`. The PRD explicitly states: "System is deployed to the client's domain from Sprint 1 with CI/CD auto-deploying on every merge to main. The client receives demo credentials and can access the live hosted system at any time."

**VLPRS is deployed to a DigitalOcean Droplet**, not a managed platform like Vercel or Railway. The architecture specifies Docker + Docker Compose for production deployment with Nginx as reverse proxy and SSL via Let's Encrypt.

**Spike-first validation is MANDATORY.** Do NOT invest time in production Dockerfile optimisations or Nginx SSL config until you have proven the basic pipeline path works: build → push → SSH → pull → run → responds. If the spike takes a full day, that's expected. If it takes 10 minutes, you got lucky.

**What this story produces:**

| Component | Purpose | Consumed By |
|---|---|---|
| `.github/workflows/ci.yml` | CI/CD pipeline | Every future PR and merge |
| `compose.prod.yaml` (upgraded) | Production orchestration | Droplet deployment |
| `nginx/nginx.prod.conf` | SSL + reverse proxy + SPA serving | Client container |
| `Dockerfile.server` (improved) | Lean production server image | ghcr.io registry |
| `Dockerfile.client` (improved) | Lean production client image | ghcr.io registry |
| `scripts/init-letsencrypt.sh` | One-time SSL certificate setup | Droplet initial deployment |
| Branch protection on `main` | Prevents broken deploys | Repository governance |
| Production seed (verified) | Initial super admin account | First deployment |

**What previous stories created that this story builds on:**

| Component | Location | What Was Created | Story |
|---|---|---|---|
| Health endpoint | `GET /api/health` | Returns `{ status: 'ok', timestamp }` | 1.1 |
| Dockerfile.server | `Dockerfile.server` | Multi-stage build (base→deps→dev→build→prod) | 1.1 |
| Dockerfile.client | `Dockerfile.client` | Multi-stage build (base→deps→dev→build→nginx) | 1.1 |
| nginx.conf | `nginx.conf` | Basic SPA config with API proxy | 1.1 |
| compose.dev.yaml | `compose.dev.yaml` | Dev environment with PostgreSQL 17, hot-reload | 1.1 |
| compose.prod.yaml | `compose.prod.yaml` | Minimal production compose (no SSL, no health checks) | 1.1 |
| Production seed | `apps/server/src/db/seed-production.ts` | Idempotent super admin creation from env vars | 1.2 |
| Demo seed | `apps/server/src/db/seed-demo.ts` | 3 MDAs + 5 users for development | 1.2 |
| ESLint config | `eslint.config.js` | Monorepo-wide linting | 1.1 |
| TypeScript config | `tsconfig.json` (root + per package) | Strict typecheck | 1.1 |
| Vitest config | Per-package `vitest.config.ts` or vite.config.ts | Unit tests | 1.1+ |

### Constraints

1. **No application code changes** — This story only touches infrastructure files (Dockerfiles, compose, Nginx, GitHub Actions, scripts). Exception: verify `trust proxy` setting exists (Task 11.4).
2. **No PostgreSQL in compose.prod.yaml** — Production uses DigitalOcean Managed PostgreSQL. `DATABASE_URL` in `.env` points to external DB.
3. **No hardcoded secrets** — All secrets via GitHub Actions secrets or Droplet `.env` file. Never in workflow files or Nginx config.
4. **No hardcoded domain** — Nginx `server_name` uses a placeholder configured during Droplet setup.
5. **No `docker compose up --build` in production** — Production pulls pre-built images from ghcr.io.
6. **No PM2/systemd/Terraform/Kubernetes** — Docker is the process manager. Manual Droplet setup is sufficient for single-server deployment.
7. **Spike-first (Task 1)** — Do NOT proceed to Tasks 2+ until the full pipeline path works end-to-end.
8. **Node.js 22-alpine** — Do not change. Architecture doc mentions Node 20 but 22 is in use and working.

### Spike Approach — Detailed

The spike is the most critical task. Here's the exact flow:

```
Developer laptop                  GitHub                    ghcr.io                 Droplet
     |                              |                          |                      |
     |-- git push (to PR) --------->|                          |                      |
     |                              |-- CI: lint+type+test --->|                      |
     |                              |        (pass?)           |                      |
     |-- merge PR to main --------->|                          |                      |
     |                              |-- docker build ---------->                      |
     |                              |-- docker push ----------->                      |
     |                              |                          |                      |
     |                              |-- SSH ------------------------------------------------>
     |                              |                          |    docker compose pull
     |                              |                          |<-- pull images ------
     |                              |                          |    docker compose up -d
     |                              |                          |                      |
     |<-------- https://<domain> responds -------------------------------------------|
```

**Spike minimum viable workflow (Task 1):**
1. GitHub Actions builds Docker images with current Dockerfiles (even if unoptimised)
2. Pushes to ghcr.io
3. SSHs to Droplet
4. Pulls and starts containers
5. Application responds on HTTP (SSL comes in Task 7)

**Only after the spike validates the pipeline path**, proceed to optimise Dockerfiles (Task 6), add SSL (Task 4, 7), and configure branch protection (Task 8).

### GitHub Actions Workflow — Key Patterns

**pnpm setup (MUST be before setup-node):**

```yaml
- name: Install pnpm
  uses: pnpm/action-setup@v4
  # Do NOT set `version:` here — let packageManager field in package.json dictate
  # the pnpm version. Setting version: 9 when the project uses pnpm 10 causes
  # --frozen-lockfile to fail due to lockfile version mismatch.

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: 'pnpm'

- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

**Concurrency (cancel in-progress runs):**

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Docker build-push-action with GHA cache:**

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push server
  uses: docker/build-push-action@v6
  with:
    context: .
    file: Dockerfile.server
    target: production
    push: true
    tags: |
      ghcr.io/${{ github.repository_owner }}/vlprs-server:${{ github.sha }}
      ghcr.io/${{ github.repository_owner }}/vlprs-server:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**SSH deploy:**

```yaml
- name: Deploy to Droplet
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.DROPLET_IP }}
    username: ${{ secrets.DROPLET_USER }}
    key: ${{ secrets.DROPLET_SSH_KEY }}
    script: |
      cd /opt/vlprs
      docker compose -f compose.prod.yaml pull
      docker compose -f compose.prod.yaml up -d
      docker image prune -f
```

### Nginx Production Configuration — SSL

```nginx
# HTTP — redirect to HTTPS + ACME challenge
server {
    listen 80;
    server_name <domain>;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS — main server
server {
    listen 443 ssl;
    server_name <domain>;

    ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

    # Modern SSL config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # SPA routing
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://server:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 256;

    # Upload size limit (CSV uploads in Epic 5)
    client_max_body_size 10m;
}
```

### Dockerfile.server — Improved Production Stage

```dockerfile
# Stage 4: Build
FROM deps AS build
COPY . .
RUN pnpm --filter shared build && pnpm --filter server build
# Create minimal production deployment
RUN pnpm deploy --prod --filter server /app/deploy

# Stage 5: Production
FROM node:22-alpine AS production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=build /app/deploy ./
COPY --from=build /app/apps/server/dist ./dist
USER appuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --spider -q http://localhost:3001/api/health || exit 1
CMD ["node", "dist/index.js"]
```

**Key improvement:** `pnpm deploy --prod --filter server /app/deploy` creates a standalone directory with only the server's production dependencies (no dev deps, no other workspaces' deps). This replaces copying the entire `node_modules` tree.

**Note:** The `pnpm deploy` output includes `node_modules` and `package.json`. The `dist` directory from `tsup` build still needs to be copied separately since it's generated after the deploy step.

### Environment Variables — Production `.env` on Droplet

```bash
# Database (managed PostgreSQL or external)
DATABASE_URL=postgresql://vlprs:<password>@<db-host>:5432/vlprs_prod

# JWT
JWT_SECRET=<strong-random-64-char-string>
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Server
PORT=3001
NODE_ENV=production

# CSRF
CSRF_SECRET=<strong-random-64-char-string>

# Session
INACTIVITY_TIMEOUT_MINUTES=30

# Initial admin (for production seed)
SUPER_ADMIN_EMAIL=admin@oyo.gov.ng
SUPER_ADMIN_PASSWORD=<strong-password>
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin

# Rate limiting
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
```

**These NEVER go in the repo.** Only `.env.example` is committed.

### Droplet Directory Structure

```
/opt/vlprs/
├── compose.prod.yaml          # Copied from repo or pulled via git
├── .env                       # Production secrets (NEVER in repo)
├── certbot/
│   ├── conf/                  # Let's Encrypt certificates (auto-managed)
│   └── www/                   # ACME challenge files (auto-managed)
└── scripts/
    └── init-letsencrypt.sh    # One-time SSL setup script
```

### File Structure — What This Story Creates/Modifies

```
vlprs/
├── .github/
│   └── workflows/
│       └── ci.yml                  # NEW — CI/CD pipeline
├── nginx/
│   └── nginx.prod.conf             # NEW — production Nginx with SSL
├── scripts/
│   └── init-letsencrypt.sh         # NEW — one-time SSL setup
├── Dockerfile.server               # MODIFY — improve production stage (pnpm deploy, HEALTHCHECK)
├── Dockerfile.client               # MODIFY — use nginx.prod.conf, add HEALTHCHECK
├── compose.prod.yaml               # MODIFY — image-based, SSL, certbot, health checks
├── .dockerignore                    # NEW or MODIFY — comprehensive exclusions
├── .env.example                     # MODIFY — add production seed variables
└── nginx.conf                      # NO CHANGE — stays for dev Docker Compose
```

**Files this story MUST NOT modify:**

```
apps/server/src/**                  # No application code changes
apps/client/src/**                  # No application code changes
packages/shared/**                  # No shared package changes
compose.dev.yaml                    # Dev environment unchanged
apps/server/src/db/seed-production.ts  # Already exists, just verify it works in container
apps/server/src/db/seed-demo.ts     # Untouched
```

### Architecture Compliance

**Deployment Architecture:**

```
Internet → DNS (A record) → Droplet IP
  → Nginx (port 80) → HTTP→HTTPS redirect
  → Nginx (port 443) → SSL termination
    → /api/* → proxy to server:3001 (Docker internal network)
    → /* → serve React SPA from /usr/share/nginx/html
    → static assets → cached 1 year

GitHub Actions → ghcr.io (images) → Droplet (pull + run)
```

**CI/CD Pipeline Flow:**

```
1. Developer pushes to PR → CI runs (lint, typecheck, test)
2. PR shows green/red check → review + merge
3. Merge to main → CI runs again + CD triggers
4. CD: build Docker images → push to ghcr.io → SSH to Droplet
5. Droplet: pull new images → restart services → health check
6. Total time: <8 minutes (CI ~5min + CD ~3min)
```

**Security Checklist:**
- [ ] All secrets in GitHub Actions secrets (never in workflow files)
- [ ] All secrets in Droplet `.env` file (never in repo)
- [ ] Server port NOT exposed externally (Nginx proxy only)
- [ ] HTTPS enforced (HTTP → HTTPS redirect)
- [ ] HSTS header set
- [ ] Security headers configured (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- [ ] Non-root users in Docker containers
- [ ] `--frozen-lockfile` in CI (reproducible builds)
- [ ] Branch protection prevents broken deploys

### GitHub Actions Secrets Required

| Secret | Value | Where To Get |
|---|---|---|
| `DROPLET_IP` | Droplet public IPv4 | DigitalOcean dashboard |
| `DROPLET_USER` | SSH username (e.g., `root` or `deploy`) | Droplet setup |
| `DROPLET_SSH_KEY` | SSH private key (entire PEM content) | `ssh-keygen -t ed25519` |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | Automatic — no setup needed |

**Note:** `GITHUB_TOKEN` has `write:packages` scope by default in GitHub Actions. No need for a separate `GHCR_TOKEN` unless the auto-token lacks permissions.

### Previous Story Intelligence

**From Story 1.1 (scaffold):**
1. Dockerfiles already exist with multi-stage builds — improve, don't rewrite from scratch
2. `compose.prod.yaml` exists but is minimal (no SSL, no health checks, uses `build:` not `image:`)
3. `nginx.conf` exists for basic SPA serving — keep for dev, create separate prod config
4. Health endpoint at `GET /api/health` — already works, used by Docker HEALTHCHECK
5. Root `package.json` has `lint`, `typecheck`, `test`, `build` scripts — CI pipeline calls these directly
6. `pnpm` workspace with `onlyBuiltDependencies: ["bcrypt"]` — important for `pnpm deploy` to work

**From Story 1.2 (auth):**
1. `seed-production.ts` already exists and is idempotent — reads `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` from env
2. `seed-demo.ts` creates 3 MDAs + 5 users — used for development, not production
3. `env.ts` validates environment variables with Zod — `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` are optional (not required for dev)

**From Story 1.3 (session security):**
1. `CSRF_SECRET` env var required in production — must be in Droplet `.env`
2. `INACTIVITY_TIMEOUT_MINUTES` default is 30 — included in `.env.example`

**From Story 1.5 (audit logging):**
1. Structured JSON logging via `pino` — Docker captures stdout/stderr. `docker compose logs server` shows all logs.
2. `req.ip` requires `trust proxy: 'loopback'` in Express to get real client IPs behind Nginx. Verify this exists in `apps/server/src/app.ts` before deploying behind Nginx.
3. `audit_log` table has an immutability trigger (`trg_audit_log_immutable`) — must be applied to production DB via `applyTriggers.ts`.

**From Story 1.6 (frontend shell):**
1. Playwright E2E tests will be added — CI pipeline must handle them (or they can be optional initially)
2. Client app has `VITE_API_URL` env var — handled at Docker build time via build args. `VITE_RECAPTCHA_SITE_KEY` is not yet needed (added by Story 1.6).

### Dockerfile Location Note

The architecture document shows Dockerfiles inside `apps/client/Dockerfile` and `apps/server/Dockerfile`. **The actual codebase has them at project root** as `Dockerfile.server` and `Dockerfile.client` (established in Story 1.1). Use the root-level paths — ignore the architecture doc's per-app layout.

### Infrastructure Code Review Patterns

Previous stories had adversarial code reviews finding 14 (Story 1.1) and 11 (Story 1.2) issues. For infrastructure files, watch for:
- Secrets accidentally left in workflow YAML examples or Nginx config
- Missing health check timeout/retry values
- Nginx security headers omitted or misconfigured (especially HSTS `includeSubDomains`)
- `.dockerignore` missing entries that bloat images (e.g., `_bmad*`, `playwright-report`, `test-results`)
- Docker build context too large (should be <10MB after .dockerignore)
- pnpm version mismatch between CI and lockfile (use `packageManager` field, not hardcoded version)

### Known Considerations

**bcrypt on Alpine:** The current `node:22-alpine` base image may need build tools (`python3`, `make`, `g++`) for bcrypt compilation. The `pnpm install --frozen-lockfile` in the deps stage handles this. If it fails, add `RUN apk add --no-cache python3 make g++` to the deps stage. Monitor CI build logs for bcrypt compilation errors.

**pnpm deploy compatibility:** `pnpm deploy` requires the lockfile to be up-to-date. Always run `pnpm install --frozen-lockfile` before `pnpm deploy`. If `pnpm deploy` doesn't support workspace protocol (`workspace:^`), use `pnpm --filter server --prod deploy /app/deploy` syntax.

**Vite env vars at build time:** Vite replaces `import.meta.env.VITE_*` during build, so production values must be set as Docker build args. **For this story, only `VITE_API_URL` is needed** — `VITE_RECAPTCHA_SITE_KEY` is a placeholder for Story 1.6 (frontend shell, not yet implemented). Handle it as follows:

```dockerfile
# In Dockerfile.client, build stage:
ARG VITE_API_URL
# Future: ARG VITE_RECAPTCHA_SITE_KEY (add when Story 1.6 is complete)
```

```yaml
# In GitHub Actions build step:
build-args: |
  VITE_API_URL=https://<domain>/api
  # Future: VITE_RECAPTCHA_SITE_KEY=${{ secrets.RECAPTCHA_SITE_KEY }}
```

**Alternatively:** Use a runtime config approach (inject `window.__ENV__` via Nginx sub_filter or a config.js loaded before the app). The build-arg approach is simpler for now.

### Git Intelligence

**Recent commits:**
```
9e6dd63 fix: code review fixes for Story 1.1 scaffold (14 issues resolved)
2084119 chore: scaffold VLPRS monorepo (Story 1.1)
```

**Branch:** `dev` | **Commit style:** `type: description` (conventional commits)

**Expected commit for this story:** `feat: add CI/CD pipeline and production infrastructure (Story 1.7)`

### Scope Boundaries

**Explicitly IN scope:**
- GitHub Actions CI workflow (lint, typecheck, test)
- GitHub Actions CD workflow (Docker build, push ghcr.io, SSH deploy)
- Production Nginx configuration with SSL (Let's Encrypt + Certbot)
- Production Docker Compose (image-based, health checks, certbot service)
- Improved production Dockerfiles (pnpm deploy, HEALTHCHECK)
- Branch protection on `main`
- SSL setup script (`init-letsencrypt.sh`)
- `.dockerignore`
- Production environment documentation
- Verification that production seed works in container

**Explicitly NOT in scope (later stories or manual setup):**
- DigitalOcean Droplet provisioning (manual, one-time)
- DNS configuration (manual at registrar)
- Managed PostgreSQL setup (manual via DigitalOcean)
- Weekly `pg_dump` backup cron to DO Spaces — deferred (Managed PG daily backups satisfy NFR-REL-2/REL-3 for MVP; supplementary `pg_dump` is belt-and-suspenders to add when operational maturity increases)
- DigitalOcean infrastructure alerts (CPU >80%, memory >85%, disk >90%) — deferred (configure manually post-deployment)
- Application code changes (exception: verify `trust proxy` setting exists — Task 11.4)
- Playwright E2E in CI (Story 1.6 adds Playwright; CI integration can be added then or as a follow-up)
- Zero-downtime rolling deploys (Docker Compose restarts are sufficient for MVP)
- Terraform/Pulumi IaC, Kubernetes/Swarm (over-engineering for single Droplet serving 63 MDAs)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7: CI/CD Pipeline & Production Infrastructure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure Decisions — CI/CD]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure Decisions — Containerisation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure Decisions — Deploy mechanism]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure Decisions — Branch protection]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure Decisions — Reverse proxy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure Decisions — SSL/TLS]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure Decisions — Process management]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure Decisions — Environment config]
- [Source: _bmad-output/planning-artifacts/architecture.md#Docker File Organization]
- [Source: _bmad-output/planning-artifacts/prd.md#Client Visibility Strategy]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-AVAIL-1 — 99.5% availability]
- [Source: _bmad-output/planning-artifacts/prd.md#Solo Developer Build Sequence — Step 3]
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-development-environment.md]
- [Source: _bmad-output/implementation-artifacts/1-2-user-registration-login.md — Production Seed]
- [Source: _bmad-output/implementation-artifacts/1-6-frontend-authentication-shell.md — Playwright Config]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
