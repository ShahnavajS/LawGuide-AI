# LexiGuide AI

> **"Legal language, made human."**

LexiGuide AI is a GenAI-powered legal information and document-assistance platform designed to demystify complex contracts, agreements, and policies. It provides structured breakdowns, obligation tracking, and evidence citations that anchor every insight directly to verifiable source text.

> **Important Legal Safety Notice:**  
> LexiGuide AI provides legal information and document analysis tools, **not legal advice**. The platform does not form an attorney-client relationship and is not a substitute for consultation with a licensed attorney.

---

## Core Experience

```
UNDERSTAND  →  COMPARE  →  ASK  →  PREPARE
```

1. **Understand (Legal X-Ray)**: Plain-language translation of complex clauses, obligations, and non-standard risks.
2. **Compare**: Semantic comparison between document versions highlighting shifts in balance and added liabilities.
3. **Ask (Evidence Q&A)**: Natural language document queries with precise, clickable page and paragraph citations.
4. **Prepare (Consultation Brief)**: Evidence-grounded briefing dossier, prioritized attorney questions, and actionable checklist with native print/PDF export.
5. **Matter Workspace**: Multi-document case context organizing related agreements, amendments, notices, and schedules with cross-document relationship discovery, consistency checks, timeline generation, and anti-adjudication safety.

---

## 5-Tier Evidence Classification

To eliminate AI hallucinations and ensure complete user transparency, all findings are tagged using a strict 5-tier model:

| Classification | Badge | Meaning |
|:---|:---|:---|
| **DOCUMENT_FACT** | `Fact` | Directly stated in the text with verifiable page/section citation. |
| **AI_INTERPRETATION** | `Interpretation` | Plain-language synthesis or inferred meaning derived from document clauses. |
| **GENERAL_INFO** | `General` | Educational explanation of standard legal concepts or statutory definitions. |
| **NEEDS_REVIEW** | `Review` | Ambiguous, high-risk, or non-standard terms requiring professional attorney scrutiny. |
| **USER_PROVIDED** | `User` | Consultation objectives, notes, or background context entered directly by the user. |

---

## Technology Stack

- **Framework**: Next.js 16 (App Router, Turbopack, React 19, Strict TypeScript)
- **Styling**: Vanilla CSS & CSS Modules with comprehensive CSS custom property design tokens (No Tailwind)
- **AI Engine**: Google Gemini via `@google/genai` (Configurable model, default `gemini-2.5-flash`)
- **Database**: SQLite with Write-Ahead Logging (`better-sqlite3` + `drizzle-orm`)
- **Document Persistence**: Decoupled filesystem storage abstraction (`LocalStorageService`)
- **Testing**: Vitest for unit tests

---

## Project Structure

```
├── docs/                        # Architecture, safety, and roadmap specs
│   ├── architecture.md
│   ├── techstack.md
│   ├── legal-safety.md
│   ├── data-model.md
│   ├── ai-prompts.md
│   └── steps.md
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── analyze/[docId]/     # Legal X-Ray & Evidence Viewer
│   │   ├── compare/             # Version comparison workspace
│   │   ├── dashboard/           # Document management workspace
│   │   ├── legal-info/          # Legal Information Navigator
│   │   ├── matters/             # Matter Hub & Workspace (/matters/[matterId])
│   │   ├── prepare/             # Lawyer consultation brief & checklist
│   │   ├── globals.css          # Design tokens, dark mode, resets
│   │   ├── layout.tsx           # Inter font, header, footer
│   │   └── page.tsx             # Landing page
│   ├── components/
│   │   ├── analysis/            # Legal X-Ray dossier & viewer components
│   │   ├── comparison/          # Comparison workspace & diff viewer
│   │   ├── layout/              # Header, Footer
│   │   ├── legal-info/          # Legal info workspace & modal components
│   │   ├── matter/              # Matter list, workspace, and intelligence tabs
│   │   ├── prepare/             # Brief editor, checklist, & dossier view
│   │   └── ui/                  # Button, Card, Badge, Input, Modal, Spinner, Skeleton, Tooltip
│   └── lib/
│       ├── ai/                  # Gemini client, config, prompts, safety guardrails, schemas
│       ├── config/              # Server-only environment validation
│       ├── db/                  # SQLite connection, Drizzle schema, migrations
│       ├── document/            # Storage & processor interfaces (PDF.js text extractor)
│       ├── evidence/            # Citation models & anti-fabrication validator
│       ├── legal-info/          # Taxonomy, authoritative sources, validator, legal-aid, service
│       ├── matter/              # Matter domain service, cross-document intelligence, Q&A
│       ├── preparation/         # Brief synthesis, checklist engine, service
│       └── utils/               # Secure ID and error handling utilities
├── tests/                       # Unit and integration test suites (232 passing tests across 38 suites)
│   └── unit/
├── .env.example                 # Environment variable templates
├── drizzle.config.ts            # Drizzle ORM configuration
├── next.config.ts               # Security headers (CSP, FrameGuard, NoSniff)
└── vitest.config.mts            # Unit testing configuration
```

---

## Getting Started

### Prerequisites

- **Node.js**: v20+ LTS (Tested on v24.21.0)
- **npm**: v10+

### 1. Clone & Install

```bash
git clone <repository-url>
cd "LawGuide AI"
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure your variables in `.env.local`:

```env
# Server-side ONLY
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
DATABASE_URL=./data/lexiguide.db
STORAGE_DIR=./uploads
NODE_ENV=development
```

### 3. Run Migrations

```bash
npm run db:generate
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the landing page and workspace.

---

## Development Scripts

| Command | Description |
|:---|:---|
| `npm run dev` | Starts Next.js development server with Turbopack |
| `npm run build` | Compiles optimized production bundle |
| `npm run start` | Runs built production server |
| `npm run lint` | Runs ESLint |
| `npm run type-check` | Runs TypeScript compiler validation (`tsc --noEmit`) |
| `npm run test` | Runs unit test suite via Vitest |
| `npm run db:generate` | Generates SQL migrations using Drizzle Kit |

---

## Implementation Status

- [x] **Phase 0: Architecture & Planning** (Complete)
- [x] **Phase 1: Engineering Foundation** (Complete)
  - Next.js 16 + React 19 + TypeScript strict mode
  - Vanilla CSS design tokens & dark mode architecture
  - Reusable UI component library (8 components)
  - SQLite database foundation with Drizzle ORM & migrations
  - `@google/genai` abstraction layer with configurable model
  - Legal safety constants, disclaimers, and guardrails
  - Document storage abstraction layer
  - Evidence & citation interface models
  - Security headers (CSP, FrameGuard, NoSniff)
  - Unit test suite (16 passing tests)
  - Professional landing page and workspace dashboard shell
- [x] **Phase 2: Document Ingestion & Storage** (Complete)
  - Strict server-side PDF validation (extension, MIME, 20 MB size, `%PDF-` magic-byte signature)
  - Filename sanitization & path traversal defense
  - Isolated physical file storage outside public web root (`LocalStorageService`)
  - Auto-migrating SQLite database schema with `documents` table (`status: UPLOADED`)
  - Document service layer (`DocumentService`) with transactional rollback
  - Secure API endpoints: `POST /api/documents/upload`, `GET /api/documents`, `GET/DELETE /api/documents/[docId]`, `GET /api/documents/[docId]/file`
  - Accessible upload UI (`DocumentUpload`) with drag-and-drop, honest progress indicators, and keyboard navigation
  - Document card & list components with file size formatting and delete confirmation dialog
  - Integrated workspace dashboard (`/dashboard`) with real-time state synchronization
  - 43 passing unit and integration tests across 7 suites
- [x] **Phase 3: PDF Processing & Document Viewer** (Complete)
  - Server-side page-aware PDF text extraction (`PdfDocumentProcessor` via `pdfjs-dist`)
  - Strict preservation of natural page boundaries, 1-indexed page numbering, and source text integrity
  - Honest handling of image-only/scanned pages (`hasText: false`, `text: ''`) without hallucinations
  - SQLite `document_pages` table storing extracted page text for downstream citations
  - Robust document lifecycle state machine (`UPLOADED` -> `PROCESSING` -> `READY` / `FAILED`)
  - Full idempotency on `READY` documents and resilient retry recovery on `FAILED` documents
  - Safe error handling without raw stack traces or confidential content leakage
  - Interactive client-side PDF viewer (`DocumentViewer`) with zoom, page navigation, and keyboard controls
  - Two-pane analysis workspace at `/analyze/[docId]`
  - Gemini Files API upload abstraction with graceful offline fallback
  - 54 passing unit and integration tests across 8 suites
- [x] **Phase 4: Legal X-Ray & Evidence Citations** (Complete)
  - GenAI legal extraction prompt with XML spotlighting (`<untrusted_legal_document>`) and injection defenses
  - Structured output schemas covering Overview, Parties, Dates, Obligations, Rights, Finances, Attention Items, and Lawyer Questions
  - Anti-fabrication citation verification engine (`CitationValidator`) with whitespace normalization and wrong-page detection
  - Automatic citation reconciliation: Unverified quotes downgraded from `DOCUMENT_FACT` to `NEEDS_REVIEW` with advisory notice
  - SQLite database schema expansion with `analysis_data_json` and Drizzle migrations
  - Analysis service layer (`AnalysisService`) with idempotency, caching, and deterministic offline fallback
  - Analysis API endpoints (`POST /api/documents/[docId]/analyze`, `GET /api/documents/[docId]/analysis`)
  - Bidirectional PDF viewer navigation: Clicking citation badges or seals commands viewer to jump directly to cited page
  - Executive obsidian and gold legal dossier UI (`LegalXRay.tsx`) with zero AI slop, interactive pill tabs, and evidence health metrics
  - 71 passing unit and integration tests across 10 suites with zero TypeScript and zero ESLint errors
- [x] **Phase 5: Document Version Comparison** (Complete)
  - Semantic section & clause alignment engine (`alignment.ts`) operating at the document -> section -> clause -> semantic level
  - Normalization of formatting and OCR extraction noise without altering legal text, numbers, or qualifiers
  - Semantic delta detection tracking shifts in notice periods, durations, monetary figures, and indemnification
  - Dual-citation anti-fabrication validation verifying base quotes against base pages and target quotes against target pages
  - SQLite schema extension with `comparison_data_json`, `updated_at`, `processing_error`, and `citations.comparison_id`
  - Robust backend comparison service (`ComparisonService`) with self-comparison prevention, caching, and deterministic fallback
  - REST API routes (`POST /api/comparisons`, `GET /api/comparisons`, `GET /api/comparisons/[comparisonId]`)
  - Full executive obsidian & gold comparison workspace (`/compare`) with document selection, statistics pills, filter toolbar, difference dossier, and dual PDF viewers with independent active page navigation
  - 96 passing unit and integration tests across 13 suites with zero TypeScript and zero ESLint errors
- [x] **Phase 6: Lawyer Consultation Brief + Actionable Checklist + Dossier** (Complete)
  - Evidence-first lawyer consultation brief generation (`BriefService`) synthesizing Legal X-Ray findings and comparison deltas
  - Client context and consultation objectives capture with dedicated `USER_PROVIDED` classification
  - Consolidated attention dossier merging high-risk clauses from Legal X-Ray and balance shifts from Version Comparison
  - Prioritized attorney questions categorized by subject, urgency, and underlying document citations
  - Actionable preparation checklist categorized into Documents to Bring, Questions to Ask, Facts to Clarify, and Action Items with interactive completion tracking
  - Native print & PDF dossier styling (`@media print`) rendering clean, professional dossiers with formal legal disclaimers
  - SQLite schema extension with `consultation_briefs` table and Drizzle migration `0004`
  - Comprehensive REST API routes (`POST /api/briefs`, `GET /api/briefs`, `GET /api/briefs/[briefId]`, `PATCH /api/briefs/[briefId]`, `DELETE /api/briefs/[briefId]`)
  - Executive workspace at `/prepare` and `/prepare/[briefId]` with real-time briefing updates
  - 115 passing unit and integration tests across 16 suites with zero TypeScript and zero ESLint errors
- [x] **Phase 7: Legal Information Navigator + Jurisdiction-Aware Source Explorer** (Complete)
  - Three distinct non-overlapping operational modes: `MODE 1 — MY DOCUMENT` (verified document facts), `MODE 2 — GENERAL LEGAL INFORMATION` (authoritative general law), and `MODE 3 — PREPARE FOR COUNSEL` (neutral attorney questions)
  - Jurisdiction-First Design with strict non-inference rules (governing law or direct user input only; defaults to `JURISDICTION NOT ESTABLISHED`)
  - 29-topic controlled legal taxonomy with plain-language definitions, practical importance, standard questions for counsel, and common limitations
  - Authoritative source registry with 2-tier trust model (`PRIMARY` official gazettes/statutes/courts and `SECONDARY` accredited university legal institutes)
  - Strict URL security validator (`validateExternalSourceUrl`) enforcing HTTPS and domain allowlist while blocking private IPs and insecure protocols
  - Controlled "Ask about this concept" Q&A interface strictly separating Document Facts from General Law and Questions for Counsel
  - Official Public Legal-Aid Navigator directing eligible users to government-funded legal assistance (NALSA, Tele-Law, LSC, LawHelp, CLA)
  - In-place slide-over `LegalInfoModal` integrated directly into Legal X-Ray and Semantic Comparison workspaces
  - Persistent SQLite caching for legal info queries (`legal_information_cache`) with migration `0005`
  - REST API endpoints (`GET /api/legal-info/topics`, `GET /api/legal-info/topics/[topicId]`, `POST /api/legal-info/query`, `GET /api/legal-info/legal-aid`)
  - 152 passing unit and integration tests across 22 suites with zero TypeScript and zero ESLint errors
- [x] **Phase 8: Multi-Document Matter Context & Cross-Document Engine** (Complete)
  - Multi-document matter workspace organizing related contracts, amendments, notices, and schedules
  - Cross-document relationship discovery and consistency checking with anti-adjudication safeguards
  - Chronological matter timeline generation and multi-document search
  - Physical document preservation: deleting a matter never deletes underlying documents
  - 190 passing unit and integration tests across 26 suites with zero TypeScript and zero ESLint errors
- [x] **Phase 9: Guided Matter Copilot, Action Plan & Counsel Workflow** (Complete)
  - Action Plan engine with intelligent task generation, deduplication, and priority filtering
  - Objective Matter Readiness Evaluator assessing 6 workflow states with ZERO artificial win rates
  - Non-adjudicative Counsel Questions generator and consultation brief dossier
  - Activity audit trail logging all lifecycle and intelligence operations
  - 211 passing unit and integration tests across 32 suites with zero TypeScript and zero ESLint errors
- [x] **Phase 10: Evidence Intelligence, Source Map & Traceable Legal Record** (Complete)
  - Materialized Evidence Intelligence Ledger (`matter_evidence`) anchoring assertions, findings, questions, and action items
  - Complete 4-tier Source Map hierarchy (Documents → Pages → Evidence → UsedBy) with evidence coverage metrics
  - Extended `CitationValidator` with exactMatch, normalizedMatch, wrongPage, and verification status metadata
  - Searchable & filterable Evidence Ledger with multi-attribute filtering (classification, verification status, docId, search query)
  - In-depth action item provenance (`whyThisExists`), evidence chain, and multi-tenant cross-matter security isolation
  - 232 passing unit and integration tests across 38 suites with zero TypeScript and zero ESLint errors
- [x] **Phase 11: Product UX, Onboarding & Hackathon Demo Experience** (Complete)
  - Refined landing page with core pillars (`UNDERSTAND • COMPARE • PREPARE`), clear disclaimers, and 6 capability showcase cards
  - Accessible `<Breadcrumb />` integrated across Legal X-Ray and Matter Workspaces
  - Zero-state polish across Document Lists, Comparisons, and Matter Workspaces
  - Native print stylesheets for matter brief dossiers and analysis views
  - Isolated static interactive hackathon demo experience (`/demo`)
  - 246 passing unit and integration tests across 39 suites with zero TypeScript and zero ESLint errors
- [x] **Phase 12: Production Hardening, Security, Reliability & Deployment Readiness** (Complete)
  - Health & Operational Readiness endpoint (`GET /api/health`) verifying system availability and SQLite connectivity without secret leakage
  - In-memory sliding window rate limiter (`rateLimiter`) protecting expensive AI analysis, comparison, matter brief, and query operations
  - Path traversal hardening in `LocalStorageService` (rejecting `../`, `..\\`, null bytes `%00`, and path escapes)
  - Multi-tenant cross-matter resource isolation with strict relationship verification
  - Secret & credential scrubber (`sanitizeErrorString`) stripping Google API keys, bearer tokens, DB URIs, and filesystem paths from error payloads and logs
  - AI Prompt Injection defense preserving `<untrusted_legal_document>` XML spotlighting boundaries against adversarial document text
  - Anti-adjudication compliance ensuring system never issues strategic legal determinations, predictions, or contract validity decisions
  - 268 passing unit and integration tests across 40 suites with zero TypeScript errors, zero ESLint errors, and clean Next.js 16.3.5 Turbopack production build

---

## Production Deployment & Operational Guidelines

### Architecture & Trust Model
LexiGuide AI operates on a **single-tenant / private-workspace model**:
- Documents and analysis records are persisted locally in SQLite (`data/lexiguide.db`) and an isolated filesystem directory (`uploads/`).
- Document ownership, matter membership, and physical storage boundaries are enforced strictly on the server.
- The platform does not claim multi-tenant enterprise isolation or GDPR/DPDP certification out-of-the-box; it is intended for single-tenant self-hosted servers, private intranet VMs, or containerized internal legal ops environments.

### Deployment Requirements
1. **Persistent Filesystem**:
   - The database file (`DATABASE_URL`) and document storage directory (`STORAGE_DIR`) **must reside on persistent, writable disk storage**.
   - **Do NOT deploy to ephemeral serverless platforms (e.g. basic Vercel serverless functions without persistent volumes)**, as SQLite files and uploaded PDFs will be discarded across function invocations.
2. **Runtime Environment**:
   - Node.js v20+ LTS or v24+ on Linux, macOS, or Windows Server.
   - For containerized deployments (Docker), ensure the `data` and `uploads` folders are mounted as external persistent volumes:
     ```bash
     docker run -d -p 3000:3000 \
       -v /var/data/lexiguide:/app/data \
       -v /var/uploads/lexiguide:/app/uploads \
       --env-file .env.production \
       lexiguide-ai:latest
     ```
3. **Database Concurrency**:
   - SQLite Write-Ahead Logging (`WAL`) mode is enabled automatically on connection to support concurrent reader threads alongside serialized writes.

### Operational Health Check
- **Endpoint**: `GET /api/health`
- **Response Format**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-17T17:00:00.000Z",
    "database": "connected",
    "service": "LexiGuide AI"
  }
  ```
- **HTTP Statuses**: `200 OK` (Healthy), `503 Service Unavailable` (Database unreachable).
- **Security**: Never reveals filesystem paths, connection strings, credentials, or environment details.

### Abuse Prevention & Rate Limiting
- Built-in sliding-window in-memory limiter:
  - **Heavy AI Operations** (Analysis, Comparison, Matter Brief, Ask My Matter): 20 requests per minute per IP.
  - **Standard API Operations**: 100 requests per minute per IP.
  - Exceeding requests receive `429 Too Many Requests` with a `Retry-After: <seconds>` response header.

---

## Legal Safety & Anti-Adjudication Principles

LexiGuide AI is built from the ground up around strict legal safety guardrails:
1. **Not a Lawyer**: Does not provide legal advice, legal strategy, or form an attorney-client relationship.
2. **Not a Judge**: Strictly refuses to declare contract "winners", legal enforceability, or litigation outcome probabilities.
3. **Evidence-Grounded**: Every document-derived assertion is verified against verbatim document excerpts using `CitationValidator`.
4. **Jurisdiction-Conscious**: Never guesses or infers governing law from IP, language, or addresses; only explicit contract text or direct user specification establishes jurisdiction.


