# LexiGuide AI — Production Deployment & Operational Runbook

> **Tagline:** "Legal language, made human."  
> **Core Promise:** UNDERSTAND → COMPARE → PREPARE

---

## 1. Deployment Architecture & Trust Model

LexiGuide AI is engineered as a persistent, account-based legal document application:
- **Application Layer**: Next.js 16 (Turbopack, React 19, TypeScript strict mode).
- **Persistence Layer**: Embedded SQLite (`better-sqlite3` + `drizzle-orm`); production defaults to DELETE journal mode and development to WAL unless `SQLITE_JOURNAL_MODE` is set.
- **File Storage**: Local filesystem storage isolated outside the public web root (`LocalStorageService`).
- **AI Integration**: Google Gemini API via `@google/genai` (server-side only, with automatic deterministic offline fallbacks).
- **Abuse Prevention**: In-memory sliding window rate limiter (20 heavy AI req/min, 100 standard API req/min per signed session).

### Persistent Storage Requirement
> [!IMPORTANT]
> **Persistent Disk Required**:
> The SQLite database (`DATABASE_URL`) and document storage directory (`STORAGE_DIR`) **must reside on persistent, writable disk volumes**.
> **DO NOT deploy to ephemeral serverless platforms** (e.g. default Vercel serverless functions without mounted persistent storage), as SQLite databases and uploaded PDF files will be destroyed when ephemeral function instances terminate.
> Suitable deployment targets include:
> - Docker on a persistent host (AWS ECS/EC2, GCP Compute Engine, DigitalOcean, Hetzner, fly.io with persistent volumes)
> - Standalone Linux / Windows Server VMs
> - Self-hosted internal intranet servers

---

## 2. Prerequisites & Environment Setup

### System Requirements
- **Node.js**: v22+ (the Docker image uses Node 22; local verification used Node 24.21.0)
- **npm**: v10+
- **Build Tools** (for native SQLite compiling): `python3`, `make`, `g++` (installed automatically in Dockerfile)
- **Disk Space**: At least 5 GB for database and document archives.

### Environment Configuration
Copy `.env.example` to `.env.local` (or supply runtime environment variables in production):

```bash
# Server-side Gemini Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Database Persistence Path
DATABASE_URL=./data/lexiguide.db

# Isolated Document Storage Path
STORAGE_DIR=./uploads

# Required session-signing secret
APP_SESSION_SECRET=<at least 32 random characters>

# Optional shared evaluator sample workspace (normally disabled in production)
EVALUATOR_DEMO_ENABLED=false

# Environment Mode
NODE_ENV=production
```

> [!NOTE]
> Server secrets are strictly protected. Never prefix `GEMINI_API_KEY` with `NEXT_PUBLIC_`.

---

## 3. Standard Production Build & Start (VM / Bare Metal)

```bash
# 1. Install production dependencies
npm ci

# 2. Build Next.js production bundle
npm run build

# 3. Start production server
npm run start
```
The server will bind to `0.0.0.0:3000`.

---

## 4. Docker Container Deployment

### Option A: Using Docker Compose (Recommended)
```bash
# Start container with volume persistence in detached mode
docker compose up -d

# Check operational logs
docker compose logs -f

# Check container health status
docker compose ps
```

### Option B: Using Plain Docker CLI
```bash
# 1. Build the production image
docker build -t lexiguide-ai:latest .

# 2. Run container with persistent host volumes
docker run -d \
  --name lexiguide \
  --restart unless-stopped \
  -p 3000:8080 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/uploads:/app/uploads \
  --env-file .env.local \
  lexiguide-ai:latest
```

---

## 5. Health Check & Operational Monitoring

LexiGuide AI includes a zero-leak operational health check:
- **Endpoint**: `GET /api/health`
- **Method**: HTTP GET
- **Healthy Response (HTTP 200)**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-17T17:00:00.000Z",
    "database": "connected",
    "service": "LexiGuide AI"
  }
  ```
- **Degraded Response (HTTP 503)**:
  ```json
  {
    "status": "degraded",
    "timestamp": "2026-09-17T17:00:00.000Z",
    "database": "disconnected",
    "service": "LexiGuide AI"
  }
  ```
- **Headers**: Enforces `Cache-Control: no-store, no-cache, must-revalidate`.

---

## 6. Backup & Disaster Recovery Runbook

The database backup uses SQLite's backup API, which takes a consistent database snapshot. The PDF directory is copied separately, so pause writes or stop the app while backing up to keep the database and uploaded files aligned. Keep backup destinations outside public web roots and protect them like the original legal documents.

### Performing a Safe Online Backup
```bash
# After pausing writes, snapshot the database and copy uploaded files
node scripts/backup.mjs

# Optionally specify a custom destination directory:
node scripts/backup.mjs /var/backups/lexiguide/2026-09-17
```

### Restoring from a Backup
```bash
# Restores the database and documents from an archived backup folder
node scripts/restore.mjs ./backups/backup-2026-09-17T17-00-00-000Z
```

---

## 7. Upgrades & Rollbacks

### Application Upgrade
1. Create a safe backup: `node scripts/backup.mjs`.
2. Pull latest codebase: `git pull origin main`.
3. Install dependencies: `npm ci`.
4. Compile production build: `npm run build`.
5. Restart server or container. Checked-in migrations apply on first database connection; `db:generate` is only for developing a new schema change.

### Rollback Procedure
1. Stop the application server: `docker compose down` or stop systemd process.
2. Checkout previous release tag or rollback Docker image tag.
3. Restore database snapshot if schema changes were applied:
   ```bash
   node scripts/restore.mjs ./backups/pre-upgrade-backup
   ```
4. Start previous release: `npm run start` or `docker compose up -d`.

---

## 8. Deployment Checklist

### Pre-Deployment
- [ ] Persistent volumes configured and mounted for `./data` and `./uploads`.
- [ ] `APP_SESSION_SECRET` set to a real random value of at least 32 characters.
- [ ] Evaluator demo account disabled, or confirmed to contain non-sensitive sample data only.
- [ ] `GEMINI_API_KEY` supplied if live AI analysis is required; without it only the documented local fallback is available.
- [ ] `NODE_ENV=production` set.
- [ ] Port `3000` accessible or configured behind reverse proxy (Nginx / Caddy / Cloudflare).
- [ ] Security headers active in `next.config.ts`.
- [ ] All unit tests pass: `npm test`.
- [ ] TypeScript check passes: `npm run type-check`.
- [ ] ESLint check passes: `npm run lint`.
- [ ] Production build succeeds: `npm run build`.

### Post-Deployment
- [ ] `GET /api/health` returns HTTP 200 and `"database": "connected"`.
- [ ] Landing page loads at `/`.
- [ ] Demo experience operates at `/demo`.
- [ ] Uploading a sample PDF succeeds and persists in `./uploads`.
- [ ] Legal X-Ray analysis generates without secret leakage.
- [ ] Version comparison generates diffs and dual citations.
- [ ] Matter workspace organizes documents, timelines, and relationships.
- [ ] Application restart preserves all records and files.

---

## 9. Recommended Final Demo Walkthrough (18-Step Script)

When demonstrating LexiGuide AI to stakeholders, evaluators, or hackathon judges, follow this sequence:

1. **Landing Page (`/`)**:
   - Introduce the core promise: *"Legal language, made human."*
   - Highlight the 3 pillars: `UNDERSTAND • COMPARE • PREPARE`.
   - Point out the prominent legal safety disclaimer (*"Information and preparation support, not legal advice"*).

2. **Isolated Demo Experience (`/demo`)**:
   - Open `/demo` to show the zero-friction, pre-analyzed Commercial Lease Renewal Dispute.
   - Show how evaluators can inspect the product immediately without uploading files.

3. **Upload Workflow (`/dashboard`)**:
   - Return to dashboard. Drag-and-drop a sample legal PDF.
   - Note honest progress indicators, 20 MB size limit, and `%PDF-` magic-byte verification.

4. **Document Viewer (`/analyze/[docId]`)**:
   - Show the two-pane workspace: PDF Viewer on the left, Legal X-Ray on the right.
   - Demonstrate zoom, page flipping, and keyboard shortcuts.

5. **Legal X-Ray & Evidence Citations**:
   - Review the plain-language executive summary and parties breakdown.
   - Click a citation badge (`Page 2`). Notice the PDF viewer jumps directly to the cited page and paragraph.

6. **5-Tier Evidence Classification**:
   - Explain the badges: `DOCUMENT_FACT`, `AI_INTERPRETATION`, `GENERAL_INFO`, `NEEDS_REVIEW`, `USER_PROVIDED`.
   - Emphasize anti-hallucination: unverified quotes are automatically downgraded to `NEEDS_REVIEW`.

7. **Attention Areas**:
   - Review high-priority clauses (indemnity, automatic renewal, non-compete) categorized objectively without sensationalized risk scores.

8. **Semantic Document Comparison (`/compare`)**:
   - Select Base Agreement vs Revised Agreement.
   - Show that diffing is semantic, not raw text noise: captures changes in notice periods (30 days → 60 days) and liability caps.
   - Click comparison citations to view dual independent PDF page jumps.

9. **Create Matter Workspace (`/matters`)**:
   - Create a multi-document Matter (e.g. *"Commercial Headquarters Lease 2026"*).
   - Attach the analyzed documents and assign roles (`PRIMARY_AGREEMENT`, `AMENDMENT`).

10. **Cross-Document Relationships & Timeline**:
    - View discovered relationships (`AMENDS`, `REFERENCES`, `INCORPORATES`).
    - View the chronological timeline synthesized across all matter agreements.

11. **Cross-Document Consistency Analysis**:
    - Inspect discrepancies identified across agreements (conflicting payment dates or notice periods).
    - Note that the system highlights the conflict without adjudicating which agreement "wins".

12. **Source Map Hierarchy (`/matters/[matterId] -> Source Map`)**:
    - Expand the 4-tier tree: Documents → Pages → Evidence Excerpts → Downstream Claims.
    - Show complete evidence coverage metrics.

13. **Evidence Ledger (`/matters/[matterId] -> Evidence Ledger`)**:
    - Filter evidence by classification (`DOCUMENT_FACT`), verification status, and search keywords.

14. **Guided Action Plan (`/matters/[matterId] -> Action Plan`)**:
    - View automatically generated tasks with traceable provenance (`whyThisExists`).
    - Mark an item complete; notice changes persist.

15. **Counsel Questions (`/matters/[matterId] -> Counsel Questions`)**:
    - Review prioritized questions prepared for the user to ask their licensed attorney.

16. **Counsel Brief Dossier (`/matters/[matterId] -> Counsel Brief`)**:
    - View the synthesized briefing document ready for lawyer consultation.
    - Click "Print / Export PDF" to demonstrate clean `@media print` styling without UI artifacts.

17. **Ask My Matter (Adversarial Safety Test)**:
    - Ask: *"Which agreement wins in court?"*
    - Observe the strict anti-adjudication guardrail: system politely refuses to declare legal precedence and provides relevant factual excerpts and attorney questions instead.

18. **Legal Information Navigator (`/legal-info`)**:
    - Show authoritative government sources (NALSA, Cornell Legal Information Institute, Supreme Court).
    - Explain strict domain allowlisting and non-inference of jurisdiction.
