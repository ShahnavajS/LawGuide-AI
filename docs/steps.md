# LexiGuide AI — Development Steps

## Phase-by-Phase Implementation Roadmap

This document outlines the exact implementation steps for each development phase. Each step includes deliverables, verification criteria, and dependencies.

---

## Phase 0: Architecture & Planning ✅ COMPLETE

**Deliverables:**
- [x] Repository analysis
- [x] Tech stack selection (techstack.md)
- [x] System architecture design
- [x] Data model design
- [x] Folder structure design
- [x] AI architecture design
- [x] Security architecture
- [x] Development phase roadmap (steps.md)
- [x] Implementation plan (implementation_plan.md)

---

## Phase 1: Engineering Foundation ✅ COMPLETE

**Goal:** Set up a production-quality project foundation that all subsequent phases build on.

**Deliverables Completed:**
- [x] Initialize Next.js 16 (App Router, Turbopack, React 19, TypeScript strict mode)
- [x] Configure CSS design system with CSS custom property tokens (colors, typography, surfaces, status badges)
- [x] Set up SQLite + Drizzle ORM (schema for documents, analyses, citations, chat, comparisons + migrations)
- [x] Configure Google Gemini GenAI client abstraction (`@google/genai`, configurable model)
- [x] Establish legal safety constants, disclaimers, and 4-tier evidence classifications
- [x] Build reusable UI components (Button, Card, Badge, Input, Modal, Spinner, Skeleton, Tooltip)
- [x] Create application layout (Header, Footer with legal disclaimers, responsive container)
- [x] Build professional landing page with hero, problem breakdown, core capabilities, and evidence demo
- [x] Build dashboard placeholder with polished empty state and informational modal
- [x] Create document storage abstraction (`DocumentStorageService` & `LocalStorageService`)
- [x] Create evidence validation interfaces (`EvidenceValidator`)
- [x] Implement security headers in `next.config.ts` and safe error formatting
- [x] Configure Vitest unit testing suite with 16 passing tests
- [x] Verify: `npm run lint`, `npm run type-check`, `npm run test`, `npm run build` all pass cleanly

**Verification Commands:**
```bash
npm run dev         # Starts without errors
npm run type-check  # Passes with 0 TypeScript errors
npm run lint        # Zero lint errors / warnings
npm run test        # 16/16 Vitest unit tests pass
npm run build       # Next.js static production build succeeds
```

**Dependencies:** None (greenfield)

---

## Phase 2: Document Upload & Storage ✅ COMPLETE

**Goal:** Users can securely upload PDF documents, see them in the dashboard workspace, and manage them.

**Deliverables Completed:**
- [x] Multi-tier server validation: `.pdf` extension, MIME type (`application/pdf`), file size (20 MB limit), magic bytes signature (`%PDF-`)
- [x] Filename sanitization & path traversal defense (stripping directory separators and relative traversal sequences)
- [x] Isolated storage architecture (`LocalStorageService` with server-controlled `<docId>/document.pdf` structure outside public web root)
- [x] Auto-migrating SQLite database with `documents` schema (tracking `id`, `title`, `originalFilename`, `mimeType`, `fileSize`, `status: UPLOADED`)
- [x] Document service layer (`DocumentService`) coordinating validation, storage rollback on DB failure, and DTO transformation
- [x] Multipart upload API (`POST /api/documents/upload`)
- [x] Document listing API (`GET /api/documents`)
- [x] Document detail and deletion API (`GET / DELETE /api/documents/[docId]`)
- [x] Document file retrieval API (`GET /api/documents/[docId]/file`)
- [x] Accessible upload component (`DocumentUpload`) with drag-and-drop, keyboard activation, client pre-validation, and live status
- [x] Document card & list components (`DocumentCard`, `DocumentList`) with formatted file sizes, timestamps, and delete confirmation modal
- [x] Dashboard workspace integration (`/dashboard`) connecting upload zone and live document list
- [x] Unit test suite: 43/43 tests passing across 7 test suites

**Verification Commands:**
```bash
npm run type-check  # 0 TypeScript errors
npm run lint        # 0 ESLint errors & 0 warnings
npm run test        # 43/43 Vitest tests pass
npm run build       # Next.js static and dynamic route compilation passes
node scratch/test-live-upload.mjs # Live end-to-end API test passes with 100% success
```

**Dependencies:** Phase 1

---

## Phase 3: PDF Processing & Viewer ✅ COMPLETE

**Goal:** Turn uploaded PDFs into structured, page-aware, navigable documents ready for downstream AI analysis.

**Deliverables Completed:**
- [x] Integrate `pdfjs-dist` legacy build in Node.js runtime for server-side page-aware extraction
- [x] Implement `PdfDocumentProcessor implements DocumentProcessor`
- [x] Preserve exact page boundaries, 1-indexed page numbers, and source text integrity
- [x] Handle empty/scanned pages honestly (`hasText: false`, `text: ''`) without hallucinations
- [x] Extend SQLite schema with `document_pages` table and `processing_error`, `gemini_file_uri`
- [x] Generate Drizzle migrations (`0001_sweet_jubilee.sql`)
- [x] Implement `processDocument(docId)` and `getDocumentPages(docId)` in `DocumentService`
- [x] Ensure idempotent processing of `READY` documents and safe retry of `FAILED` documents
- [x] Implement Gemini Files API upload abstraction with graceful offline fallback
- [x] Create API endpoints: `POST /api/documents/[docId]/process` and `GET /api/documents/[docId]/pages`
- [x] Build interactive `DocumentViewer.tsx` client component with `react-pdf`:
  - Page navigation (Previous, Next, current indicator `Page X of Y`)
  - Jump-to-page input with validation
  - Zoom controls (Zoom In, Zoom Out, Reset Zoom)
  - Keyboard accessibility (Arrow keys, PageUp/PageDown, +/-)
  - Accessible loading skeletons and error states with retry
- [x] Build two-pane responsive workspace at `/analyze/[docId]`:
  - Left pane: document metadata, honest processing state machine, Phase 4 foundation notice
  - Right pane: interactive PDF viewer
  - Automatic processing trigger on upload with safe error display
- [x] Update Dashboard "View PDF" / "Open Workspace" routing to `/analyze/[docId]`
- [x] Add comprehensive test suite in `tests/unit/processor.test.ts` (11 new tests, 54 total passed)
- [x] Verify: `npm run lint` (0 errors), `npm run type-check` (0 errors), `npm run test` (54/54 passed), `npm run build` (successful)

**Verification Commands:**
```bash
npm run type-check  # Passes with 0 TypeScript errors
npm run lint        # Zero lint errors / warnings
npm run test        # 54/54 Vitest unit tests pass
npm run build       # Next.js production build succeeds with Turbopack
```

**Dependencies:** Phase 2

---

## Phase 4: Legal X-Ray Analysis ✅ COMPLETE

**Goal:** AI extracts structured legal information from documents with evidence labeling and anti-fabrication citation verification.

**Deliverables Completed:**
- [x] Design Legal X-Ray system prompt with XML spotlighting (`<untrusted_legal_document>`), anti-hallucination rules, and injection defenses
- [x] Structured domain output schema (`LegalXRayAnalysis`, `DocumentOverview`, `PartyFinding`, `DateFinding`, `ObligationFinding`, `RightFinding`, `FinancialTermFinding`, `MaterialClauseFinding`, `AttentionAreaFinding`, `LawyerQuestionFinding`)
- [x] Citation validation engine (`CitationValidator`) with exact matching, whitespace-normalized matching, wrong-page detection, and citation reconciliation (`DOCUMENT_FACT` downgraded to `NEEDS_REVIEW` with advisory note if unverified)
- [x] SQLite schema expansion: `analysisDataJson` column in `analyses` table with Drizzle migration `0002_cynical_major_mapleleaf.sql`
- [x] Backend service layer (`AnalysisService`):
  - Idempotent analysis with caching and forced re-run
  - Non-`READY` document rejection
  - Page text retrieval and prompt assembly
  - Gemini GenAI structured output generation with deterministic offline fallback
  - Citation verification and DB persistence into `analyses` and `citations`
- [x] Analysis API endpoints:
  - `POST /api/documents/[docId]/analyze` (trigger or force re-run)
  - `GET /api/documents/[docId]/analyze`
  - `GET /api/documents/[docId]/analysis` (cached analysis retrieval)
- [x] Interactive PDF viewer navigation integration:
  - Added `activePage?: number` prop to `DocumentViewer.tsx` synced during render (React 19 compliant)
  - Clicking any citation in the Legal X-Ray commands the viewer to jump to that page
- [x] Executive Legal X-Ray UI (`LegalXRay.tsx`, `LegalXRay.module.css`):
  - Bespoke obsidian and gold luxury legal tech aesthetic (zero "AI slop")
  - Evidence health bar displaying verified citation percentage
  - Pill tabs: Overview, Clauses, Obligations, Rights, Finances, Attention, Prep
  - Attention badges (`HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`) with honest legal language
  - Interactive citation seals (`📄 Page X · Section Y`) triggering page navigation
  - Grounded lawyer consultation questions for human legal review
- [x] Comprehensive test suites:
  - `tests/unit/validator.test.ts` (10 tests)
  - `tests/unit/analysis-service.test.ts` (7 tests)
  - 71/71 total project tests passing cleanly
- [x] Verified Next.js 16 production build (`npm run build`) with Turbopack

**Verification Commands:**
```bash
npm run type-check  # 0 TypeScript errors
npm run lint        # 0 ESLint errors & 0 warnings
npm run test        # 71/71 Vitest tests pass across 10 test files
npm run build       # Next.js static & dynamic production build succeeds
```

**Dependencies:** Phase 3

---

## Phase 5: Semantic Document Comparison & Dual Evidence Verification ✅ COMPLETE

**Goal:** Users can select two processed documents (Base/Original vs. Target/Revised), extract substantive clause differences, detect semantic changes (durations, notice periods, amounts, indemnities), validate evidence across both documents using `CitationValidator`, and interact with synchronized dual PDF viewers.

**Deliverables Completed:**
- [x] Clause alignment engine (`alignment.ts`):
  - Normalization of harmless formatting/extraction artifacts without altering words, numbers, or legal qualifiers
  - Section and clause parsing by numbering hierarchy (`1.1`, `11.2`, `Article 2`) or structured paragraphs
  - Semantic delta detection for notice periods, durations, monetary figures, and indemnification
  - Deterministic alignment: `UNCHANGED`, `MODIFIED`, `ADDED`, `REMOVED`
- [x] AI Prompt Engineering:
  - `SYSTEM_COMPARISON_ANALYST_PROMPT` with XML spotlighting (`<untrusted_legal_document type="base">` and `<untrusted_legal_document type="target">`)
  - Injection defense, anti-hallucination rules, and neutral non-legal-advice framing
  - `buildDualDocumentComparisonPrompt()` page-aware builder
- [x] Anti-Fabrication Dual-Citation Validation:
  - Base evidence verified against base pages using `CitationValidator`
  - Target evidence verified against target pages using `CitationValidator`
  - Unverified claims downgraded from `DOCUMENT_FACT` to `NEEDS_REVIEW` with explicit discrepancy notes
- [x] SQLite schema expansion:
  - Added `comparisonDataJson`, `updatedAt`, `processingError` to `comparisons` table
  - Added `comparisonId` foreign key to `citations` table
  - Applied migration `0003_conscious_skaar.sql`
- [x] Backend service layer (`ComparisonService`):
  - Self-comparison rejection (`baseDocId !== targetDocId`)
  - Status check: only `READY` documents eligible for comparison
  - Order sensitivity preservation (`A -> B` !== `B -> A`)
  - Idempotent caching with forced re-analysis option (`force: true`)
  - Deterministic offline comparison fallback for resilient offline testing
  - Full persistence of comparison results and validated citations
- [x] API routes:
  - `POST /api/comparisons`: Run or retrieve comparison
  - `GET /api/comparisons?baseDocumentId=...&targetDocumentId=...`: Cached pair lookup
  - `GET /api/comparisons/[comparisonId]`: Direct lookup by ID
- [x] Executive Obsidian & Gold UI (`ComparisonWorkspace.tsx`):
  - Document selection bar with swap button and validation
  - Executive summary and governing law identification
  - Statistics bar: Added (emerald), Removed (crimson), Modified (amber), Unchanged (slate)
  - Filter toolbar: Filter by Change Type and Category dropdown
  - Difference Cards with dual citation seals (`BASE · 📄 Page X`, `REVISED · 📄 Page Y`)
  - Unverified evidence warning banners
  - Semantic deltas table (`30 days` → `60 days`)
  - Grounded questions for legal counsel
  - Dual PDF viewer pane: Side-by-side or tabbed view with independent `baseActivePage` and `targetActivePage` navigation
- [x] Comprehensive test suite:
  - `tests/unit/comparison-alignment.test.ts` (10 tests)
  - `tests/unit/comparison-service.test.ts` (8 tests)
  - `tests/unit/comparison-api.test.ts` (7 tests)
  - All 96 project unit tests passing cleanly
- [x] Verified Next.js 16 production build (`npm run build`) with Turbopack

**Verification Commands:**
```bash
npm run type-check  # 0 TypeScript errors
npm run lint        # 0 ESLint errors & 0 warnings
npm run test        # 96/96 Vitest tests pass across 13 test files
npm run build       # Next.js static & dynamic production build succeeds
```

**Dependencies:** Phase 4

---

## Phase 6: Lawyer Consultation Brief + Actionable Checklist + Print/PDF Dossier ✅ COMPLETE

**Goal:** Turn evidence-grounded Legal X-Ray and Semantic Comparison findings into an executive consultation preparation dossier for legal counsel, featuring prioritized questions, an actionable checklist with interactive persistence, and a native print/PDF export stylesheet.

**Deliverables Completed:**
- [x] Database Schema Expansion:
  - Added `preparations` table (`id`, `document_id`, `comparison_id`, `purpose`, `user_notes_json`, `checklist_state_json`, `preparation_data_json`, `status`, `created_at`, `updated_at`)
  - Added `preparation_id` foreign key reference to `citations` table
  - Generated and applied Drizzle migration `0004_friendly_changeling.sql`
- [x] Domain Models & Schemas (`schemas.ts`):
  - `PreparationBrief`, `PreparationLawyerQuestion`, `PreparationChecklistItem`, `PreparationDocumentToBring`, `PreparationTimelineEvent`, `PreparationMissingInfoItem`, `PreparationUserNote`, `PreparationKeyFact`, `PreparationDocumentInfo`
- [x] Prompt Engineering & Safety Directives (`prompts.ts` & `safety.ts`):
  - Added `SYSTEM_PREPARATION_ANALYST_PROMPT` with strict XML boundary defenses (`<verified_document_evidence>`, `<verified_comparison_evidence>`, `<user_provided_context>`)
  - Added `USER_PROVIDED` classification to separate user notes from document facts
  - Prohibited legal verdicts ("illegal", "void", "unfavorable"); enforced calm informational phrasing
- [x] Preparation Service Layer (`src/lib/preparation/service.ts`):
  - Source validation (requires `READY` document with completed analysis, or `COMPLETED` comparison)
  - Grounded evidence synthesis combining facts, key dates, financial terms, obligations, and attention areas
  - Dual comparison change integration (Original vs Revised evidence quotes and semantic deltas)
  - Anti-fabrication citation validation (`CitationValidator`) downgrading unverified quotes to `NEEDS_REVIEW`
  - Lawyer question deduplication across X-Ray, comparison differences, and user notes
  - Actionable checklist generation (`BEFORE_CONSULTATION`, `FOR_THE_LAWYER`, `AFTER_CONSULTATION`)
  - Idempotent caching with `force: true` regeneration support
  - Interactive checklist state persistence via `updateChecklistState`
  - Deterministic offline preparation generator for resilient testing without live LLM calls
- [x] REST API Endpoints:
  - `POST /api/preparations`: Create or retrieve preparation brief
  - `GET /api/preparations`: Retrieve cached preparation by query parameters (`?documentId=...` / `?comparisonId=...`)
  - `GET /api/preparations/[preparationId]`: Retrieve brief by unique ID
  - `PATCH /api/preparations/[preparationId]/checklist`: Toggle checklist item state in SQLite
- [x] Executive Obsidian & Gold UI (`PreparationWorkspace.tsx` & CSS Module):
  - Source selector bar with quick-pick consultation purpose chips and user notes input
  - Executive header with title, purpose banner, document metadata, and citation health bar
  - 10-tab section navigation (All Sections, Questions, Checklist, Facts, Obligations, Attention, Changes, Documents to Bring, Notes)
  - Numbered lawyer question cards with "Why this matters", source citations, "Copy Question" and "Mark Prepared" toggles
  - Interactive checkable items with real-time optimistic updates and backend persistence
  - Integrated collapsible `DocumentViewer` pane with citation navigation (`📄 Page X`)
  - Native `@media print` stylesheet optimizing typography and page breaks for physical handouts or PDF saving
- [x] Comprehensive Unit Test Suite:
  - `tests/unit/preparation-service.test.ts` (8 tests)
  - `tests/unit/preparation-synthesis.test.ts` (4 tests)
  - `tests/unit/preparation-api.test.ts` (7 tests)
  - All 115 unit tests passing across 16 test files
- [x] Verified Turbopack production build (`npm run build`) and strict typing (`npm run type-check`)

**Verification Commands:**
```bash
npm run type-check  # 0 TypeScript errors
npm run lint        # 0 ESLint errors & 0 warnings
npm test            # 115/115 Vitest tests pass across 16 test files
npm run build       # Next.js static & dynamic production build succeeds
```

**Dependencies:** Phase 4 & Phase 5

---

## Phase 7: Legal Information Navigator + Jurisdiction-Aware Source Explorer ✅ COMPLETE

**Goal:** Build a controlled Legal Information Navigator that helps users understand legal concepts found in their documents, grounded in authoritative sources, with explicit 3-mode operation and a strict jurisdiction non-inference engine, without turning into an "AI lawyer".

**Deliverables Completed:**
- [x] Controlled Taxonomy & Source Registry:
  - 29 canonical legal topics (`TERMINATION`, `INDEMNIFICATION`, `ARBITRATION`, `NOTICE_PERIOD`, `LIMITATION_OF_LIABILITY`, etc.) with categories, search aliases, plain-English educational definitions, standard questions for counsel, and important limitations (`src/lib/legal-info/taxonomy.ts`)
  - Curated authoritative source registry with 3 trust levels: `PRIMARY` (India Code, Supreme Court of India, NALSA, MCA, UK Legislation, WIPO, UNCITRAL) and `SECONDARY` (Cornell LII) (`src/lib/legal-info/sources.ts`)
  - Strict URL security validator enforcing HTTPS, domain allowlist, and blocking `javascript:`, `data:`, `file:`, localhost, and internal IPs (`src/lib/legal-info/validator.ts`)
  - Public legal-aid directory providing verified contact points and statutory basis for NALSA, Tele-Law, LSC, and CLA (`src/lib/legal-info/legal-aid.ts`)
- [x] Strict Jurisdiction & Safety Architecture:
  - 3 Explicit Operational Modes: `MODE 1 — MY DOCUMENT`, `MODE 2 — GENERAL LEGAL INFORMATION`, `MODE 3 — PREPARE FOR COUNSEL`
  - Jurisdiction provenance engine with strict non-inference rule: `DOCUMENT JURISDICTION` (from verified governing law) vs `USER-PROVIDED JURISDICTION` vs `JURISDICTION NOT ESTABLISHED` (never guesses from IP, browser, currency, language, or company address)
  - Anti-UPL guardrails preventing definitive legal conclusions ("illegal", "invalid", "unenforceable", "you should sue/sign")
  - Prompt injection defense using XML containers (`<concept_context>`, `<legal_information_sources>`, `<document_evidence>`)
- [x] Persistent SQLite Caching & Database Schema:
  - Added `legal_information_cache` table (`id`, `cache_key`, `topic`, `jurisdiction_json`, `response_json`, `created_at`, `expires_at`)
  - Generated and applied clean Drizzle migration `0005_gray_sersi.sql`
- [x] Backend Service Layer (`LegalInformationService`):
  - Topic resolution and alias mapping
  - Jurisdiction provenance resolution
  - Document-evidence grounding with `CitationValidator`
  - Controlled concept Q&A separating Document Facts from General Legal Information and Questions for Counsel
  - Deterministic offline fallback engine for resilient testing and zero-downtime reliability
- [x] REST API Routes:
  - `GET /api/legal-info/topics`: List and search taxonomy topics
  - `GET /api/legal-info/topics/[topicId]`: Retrieve topic dossier with document evidence and authoritative sources
  - `POST /api/legal-info/query`: Controlled "Ask about this concept" endpoint
  - `GET /api/legal-info/legal-aid`: Directory of public legal-aid organizations
- [x] Executive Obsidian & Gold UI (`/legal-info` & Components):
  - Dedicated `/legal-info` workspace with 3-mode selector, jurisdiction status badge, country selector, topic search, and taxonomy browser
  - Distinct visual badges: Gold seal for Document Evidence vs Blue/Neutral badges for Official Sources vs Red/Amber alert for Limitations
  - Integrated "Ask about this concept" Q&A with suggested question chips
  - "Get Legal Help" section highlighting NALSA and Tele-Law
  - In-place `LegalInfoModal` drawer integrated directly into Legal X-Ray finding cards and Comparison difference cards
  - Main navigation link added to Header
- [x] Comprehensive Testing & Verification:
  - 37 new tests across 6 dedicated test files:
    - `tests/unit/legal-info-taxonomy.test.ts` (5 tests)
    - `tests/unit/legal-info-jurisdiction.test.ts` (6 tests)
    - `tests/unit/legal-info-sources.test.ts` (9 tests)
    - `tests/unit/legal-info-safety.test.ts` (5 tests)
    - `tests/unit/legal-info-service.test.ts` (5 tests)
    - `tests/unit/legal-info-api.test.ts` (7 tests)
  - All 152 / 152 unit and integration tests passing across 22 test files
  - 0 TypeScript errors, 0 ESLint errors/warnings, clean Turbopack production build

**Verification Commands:**
```bash
npm run type-check  # 0 TypeScript errors
npm run lint        # 0 ESLint errors & 0 warnings
npm test            # 152/152 Vitest tests pass across 22 test files
npm run build       # Next.js static & dynamic production build succeeds
```

**Dependencies:** Phase 4, Phase 5, Phase 6

## Phase 8: Matter Workspace & Cross-Document Intelligence ✅ COMPLETE

**Goal:** Turn individual document analyses into a coherent Legal Matter Workspace where users organize related contracts, amendments, notices, and supporting documents under a unified case context with cross-document intelligence and strict anti-adjudication safety.

**Deliverables Completed:**
- [x] Database Schema & Migrations:
  - Added `matters` table (`id`, `title`, `description`, `jurisdiction`, `jurisdiction_provenance`, `status: ACTIVE|ARCHIVED`, timestamps)
  - Added `matter_documents` membership join table (`id`, `matter_id`, `document_id`, `role`, `role_suggestion`, `role_confirmed`, `display_order`, `added_at`) with foreign key cascading
  - Added `document_relationships` table (`id`, `matter_id`, `source_document_id`, `target_document_id`, `relationship_type`, `description`, `source_page`, `source_quote`, `target_page`, `target_quote`, `confidence`, `classification`, `status: SUGGESTED|CONFIRMED|REJECTED`, `is_validated`)
  - Added `matter_notes` table (`id`, `matter_id`, `title`, `content`, `classification`, timestamps)
  - Extended `preparations` table with optional `matter_id` foreign key
  - Generated and applied clean Drizzle migration `0006_graceful_speedball.sql`
- [x] Safety & Guardrails Engine:
  - 8 Document roles: `PRIMARY_AGREEMENT`, `REVISED_AGREEMENT`, `AMENDMENT`, `NOTICE`, `POLICY`, `ANNEXURE`, `SUPPORTING_DOCUMENT`, `OTHER`
  - 6 Cross-document relationship types: `REFERENCES`, `AMENDS`, `INCORPORATES`, `SUPERSEDES_PARTIALLY`, `ATTACHMENT_TO`, `CONFLICTS_WITH_DISCUSSION_ONLY`
  - 11 Multi-document consistency categories: `DATES`, `PARTIES`, `NOTICE`, `PAYMENT`, `TERM`, `TERMINATION`, `GOVERNING_LAW`, `LIABILITY`, `CONFIDENTIALITY`, `DEFINED_TERMS`, `DOCUMENT_REFERENCES`
  - Strict Anti-Adjudication: AI and deterministic engines observe factual differences with neutral discussion points for legal counsel, strictly refusing to declare which contract wins, prevails, or controls
  - Citation validation: Cross-document relationship quotes dual-verified against source/target page text; unverified downgraded to `NEEDS_REVIEW`
  - Document safety: Deleting a Matter or detaching a document NEVER deletes the physical document or its analysis
- [x] Backend Service Layer (`MatterService`):
  - Full Matter CRUD with ACTIVE/ARCHIVED status filtering
  - Document membership and role suggestion/confirmation
  - Cross-document relationship extraction with `CitationValidator` dual verification
  - Multi-document consistency checking across member documents
  - Document-derived chronological timeline generation
  - Multi-document server-side indexed page search (`searchMatter`)
  - "Ask My Matter" cross-document Q&A (`queryMatter`) grounded in member text with anti-adjudication protection
  - User notes CRUD with action-item classification
  - Integrated with `PreparationService` to link consultation briefs to matters
- [x] REST API Routes:
  - `POST /api/matters`: Create matter
  - `GET /api/matters`: List matters with status filter
  - `GET /api/matters/[matterId]`: Retrieve matter details and metrics
  - `PATCH /api/matters/[matterId]`: Update matter metadata and status
  - `DELETE /api/matters/[matterId]`: Delete matter (leaving physical documents intact)
  - `POST /api/matters/[matterId]/documents`: Attach document to matter
  - `PATCH /api/matters/[matterId]/documents/[documentId]`: Update member role
  - `DELETE /api/matters/[matterId]/documents/[documentId]`: Detach document
  - `GET /api/matters/[matterId]/relationships`: List relationships
  - `POST /api/matters/[matterId]/relationships/refresh`: Scan and extract relationships
  - `PATCH /api/matters/[matterId]/relationships/[relationshipId]`: Confirm or reject relationship
  - `GET /api/matters/[matterId]/consistency`: Get multi-document consistency findings
  - `GET /api/matters/[matterId]/timeline`: Get chronological timeline events
  - `GET /api/matters/[matterId]/search`: Server-side page search across matter
  - `POST /api/matters/[matterId]/query`: Ask My Matter Q&A
  - `GET /api/matters/[matterId]/notes`: List matter user notes
  - `POST /api/matters/[matterId]/notes`: Create matter note
  - `DELETE /api/matters/[matterId]/notes/[noteId]`: Delete matter note
  - `POST /api/preparations`: Updated to support `matterId`
- [x] Executive Obsidian & Gold UI (`/matters` & Components):
  - `/matters` Matter Hub page with status filtering, live metrics, and matter creation modal
  - `/matters/[matterId]` Matter Workspace page with 8 dedicated tabs:
    1. **Overview**: Executive dashboard with document count, role breakdown, relationship metrics, consistency alerts, and quick actions
    2. **Documents**: Member document list with role badges, role editor, add document modal, in-place document viewer drawer, and detach action
    3. **Timeline**: Chronological event feed with date values, document tags, page numbers, and quoted evidence
    4. **Relationships**: Interactive relationship cards with flow indicators, dual citations, verification badges, and Confirm/Reject actions
    5. **Consistency**: Multi-document difference cards with side-by-side comparison of conflicting values, severity tags, and discussion points for counsel
    6. **Search**: Server-side page text search with highlighted matching snippets, document attribution, and page links
    7. **Ask My Matter**: Natural language Q&A with grounded citations, suggested counsel questions, and anti-adjudication safeguards
    8. **Notes**: User-provided private consultation notes with action item classifications
  - In-place Document Viewer drawer allowing users to inspect member pages without leaving the workspace
  - Concept explanation modal integration linking terms to the Legal Information Navigator
  - Main navigation updated with "Matters" item in Header
- [x] Comprehensive Testing & Verification:
  - 38 new unit and integration tests across 4 dedicated test files:
    - `tests/unit/matter-service.test.ts` (13 tests)
    - `tests/unit/matter-intelligence.test.ts` (4 tests)
    - `tests/unit/matter-search-query.test.ts` (4 tests)
    - `tests/unit/matter-api.test.ts` (17 tests)
  - All 190 / 190 tests passing across all 26 test files (100% pass rate)
  - 0 TypeScript errors (`npm run type-check`)
  - 0 ESLint errors & 0 warnings (`npm run lint`)
  - Clean Next.js 16.3.5 Turbopack production build (`npm run build`)

**Verification Commands:**
```bash
npm run type-check  # 0 TypeScript errors
npm run lint        # 0 ESLint errors & 0 warnings
npm test            # 190/190 Vitest tests pass across 26 test files
npm run build       # Next.js static & dynamic production build succeeds
```

**Dependencies:** Phase 4, Phase 5, Phase 6, Phase 7

---

## Phase 9: Guided Matter Copilot, Action Plan & Counsel Workflow

**Goal:** Turn cross-document matter intelligence into an actionable preparation roadmap, objective matter readiness states, non-adjudicative counsel questions, and an executive attorney consultation brief dossier.

**Completed Items:**
- [x] Database Schema & Migrations (`src/lib/db/schema.ts`):
  - `matter_action_items` table with task type, status (`OPEN`, `IN_PROGRESS`, `COMPLETED`, `DISMISSED`), priority (`HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`), source type, provenance, and foreign references
  - `matter_activity` append-only audit trail table tracking all document additions, removals, relationship reviews, consistency checks, note edits, and action item lifecycles
  - Drizzle migration generated and applied cleanly
- [x] AI Safety, Schemas & Prompts (`src/lib/ai/`):
  - Rule 9 added to `SYSTEM_SAFETY_DIRECTIVE`: strictly prohibiting legal strategy advice, litigation decisions, or instructions on whether to sue/settle/sign
  - Strict type definitions for `MatterActionItem`, `MatterReadinessReport`, `MatterSnapshotMetrics`, `CounselQuestionItem`, `MatterBriefResponse`, and `MatterActivityItem`
  - Prompt builders `buildCounselQuestionPrompt` and `buildMatterBriefPrompt` with neutral framing and anti-adjudication instructions
- [x] Service Layer Implementation (`src/lib/matter/service.ts`):
  - Action items CRUD: `createActionItem`, `getActionItems`, `updateActionItem`, `deleteActionItem`
  - Intelligent automatic action item generator `generateActionItems` synthesizing tasks from cross-document consistency findings, unverified relationships, and attention areas, with deduplication against existing items
  - Objective matter readiness evaluator `getMatterReadiness` calculating metrics and deriving workflow states (`READY_FOR_REVIEW`, `ITEMS_TO_VERIFY`, `INFORMATION_GAPS`, `QUESTIONS_FOR_COUNSEL`, `DOCUMENTS_TO_COLLECT`, `FOLLOW_UP_ITEMS`) with ZERO artificial win rates
  - Non-adjudicative counsel question generator `generateCounselQuestions` framing inquiries as neutral reconciliation questions
  - Executive consultation dossier generator `generateMatterBrief` and `getMatterBrief` persisted in `preparations` table with idempotent caching
  - Activity audit logging integrated across all matter actions
  - `queryMatter` enhanced to link matching preparation action items
- [x] REST API Routes (7 new endpoints):
  - `GET /api/matters/[matterId]/action-items`
  - `POST /api/matters/[matterId]/action-items`
  - `PATCH /api/matters/[matterId]/action-items/[itemId]`
  - `DELETE /api/matters/[matterId]/action-items/[itemId]`
  - `POST /api/matters/[matterId]/action-items/generate`
  - `GET /api/matters/[matterId]/readiness`
  - `POST /api/matters/[matterId]/counsel-questions/generate`
  - `GET /api/matters/[matterId]/brief`
  - `POST /api/matters/[matterId]/brief`
  - `GET /api/matters/[matterId]/activity`
- [x] Executive Obsidian & Gold UI (`src/components/matter/MatterWorkspace.tsx`):
  - Dedicated "Action Plan" tab with status/priority filtering, inline completion toggles, jump-to-document buttons, and "+ Add Action Item" modal
  - "Overview" tab enhanced with objective Readiness State Badges, 11-dimension Snapshot Metrics grid, Recommendations Box, and chronological Activity Audit Feed
  - "Questions for Counsel" tab with dynamic question generation, rationale boxes, source grounding, jump-to-page viewer links, and "+ Add to Action Plan" conversion
  - "Lawyer Consultation Dossier" tab with comprehensive brief synthesis, member document summary, discrepancy highlights, counsel questions, checklist, and print/PDF export
  - "Ask My Matter" tab enhanced with interactive Related Action Item chips
- [x] Comprehensive Testing & Verification:
  - 21 new tests across 6 dedicated test files:
    - `tests/unit/matter-action-items.test.ts` (5 tests)
    - `tests/unit/matter-action-generation.test.ts` (2 tests)
    - `tests/unit/matter-readiness.test.ts` (2 tests)
    - `tests/unit/matter-counsel-questions.test.ts` (1 test)
    - `tests/unit/matter-brief.test.ts` (1 test)
    - `tests/unit/matter-actions-api.test.ts` (10 tests)
  - 211 / 211 Vitest tests passing across all 32 test files (100% pass rate)
  - 0 TypeScript errors (`npm run type-check`)
  - 0 ESLint errors & 0 warnings (`npm run lint`)
  - Clean Next.js 16.3.5 Turbopack production build (`npm run build`)

**Verification Commands:**
```bash
npm run type-check  # 0 TypeScript errors
npm run lint        # 0 ESLint errors & 0 warnings
npm test            # 211/211 Vitest tests pass across 32 test files
npm run build       # Next.js static & dynamic production build succeeds
```

**Dependencies:** Phase 8

---

## Phase 10: Evidence Intelligence, Source Map & Traceable Legal Record ✅ COMPLETE

**Goal:** Provide end-to-end evidence intelligence, complete bidirectional source mapping, and unshakeable traceability across every assertion, finding, question, action item, and brief section in LexiGuide AI.

**Deliverables Completed:**
- [x] AI Safety Directives & Rule 10 (`src/lib/ai/safety.ts`):
  - Added Rule 10 (Evidence Traceability) to `SYSTEM_SAFETY_DIRECTIVE`
  - Added `EVIDENCE_TYPES`, `VERIFICATION_STATUSES`, `CONFIDENCE_CATEGORIES` constants and types
  - Added matter activity types: `EVIDENCE_REVIEWED`, `EVIDENCE_LEDGER_VIEWED`, `CITATION_VERIFICATION_RUN`
- [x] CitationValidator Extension (`src/lib/evidence/validator.ts`):
  - Extended `CitationValidationResult` with structured verification metadata (`exactMatch`, `normalizedMatch`, `wrongPage`, `substringMatch`, `verificationStatus`, `confidenceCategory`, `sourcePage`, `matchedText`)
  - 100% backward compatible with existing Phase 1–9 callers
  - Preserved unit test coverage across existing validator test suites
- [x] Unified Source Reference Abstraction (`src/lib/evidence/source-reference.ts`):
  - Defined `UnifiedSourceReference`, `EvidenceReference`, and consumer tracking (`usedBy`)
  - Implemented factory functions: `createDocumentSourceReference`, `createConsistencySourceReference`, `createUserProvidedSourceReference`
- [x] SQLite Schema & Migration (`src/lib/db/`):
  - Created `matter_evidence` table in `src/lib/db/schema.ts`
  - Generated and executed Drizzle migration `0008_slow_shotgun.sql`
- [x] Matter Service Layer Implementation (`src/lib/matter/service.ts`):
  - Enriched `getActionItems` with `whyThisExists`, `isUserCreated`, `relatedDocumentTitle`, and `evidenceChain`
  - Added `syncMatterEvidence(matterId)`: extracts and idempotently synchronizes evidence items across member document citations, consistency findings, relationships, and user notes
  - Added `getMatterEvidenceLedger(matterId, filters)`: provides searchable, filterable evidence ledger with multi-attribute querying
  - Added `getMatterSourceMap(matterId)`: constructs complete 4-tier Source Map hierarchy (Documents → Pages → Evidence → UsedBy) with comprehensive coverage metrics
  - Added `getDocumentPageEvidence(matterId, docId, pageNumber)`: retrieves evidence specifically anchored to a single document page with multi-tenant access control
- [x] REST API Routes (3 new endpoints):
  - `GET /api/matters/[matterId]/evidence`: filtered Evidence Ledger retrieval
  - `GET /api/matters/[matterId]/source-map`: hierarchical Source Map and coverage metrics
  - `GET /api/matters/[matterId]/evidence/pages/[docId]/[pageNumber]`: page-level evidence inspection
- [x] Executive Obsidian & Gold Workspace UI (`src/components/matter/`):
  - Added `'sourceMap'` tab to `MatterWorkspace.tsx` with toggleable Visual Hierarchy & Searchable Ledger views
  - Built Evidence Coverage Metrics header: total docs, verified coverage, unlinked evidence, citation coverage across findings, questions, and action items
  - Interactive Document Source Tree: expandable documents, page cards with verified badges, and quick-launch slide-over page viewer
  - Searchable & Filterable Evidence Ledger: filter by classification (`DOCUMENT_FACT`, `USER_PROVIDED`, etc.), verification status (`VERIFIED`, `NEEDS_REVIEW`, `UNVERIFIED`), and real-time text query
  - Action Plan enhancement: visible `whyThisExists` badge, document link badges, and direct "View Evidence" jump buttons
  - Counsel Questions & Brief Dossier provenance: tagged factual points and source document indicators
- [x] Comprehensive Testing & Verification:
  - 5 new test files (21 new tests):
    - `tests/unit/source-reference.test.ts` (3 tests)
    - `tests/unit/matter-evidence.test.ts` (4 tests)
    - `tests/unit/matter-source-map.test.ts` (2 tests)
    - `tests/unit/matter-traceability.test.ts` (3 tests)
    - `tests/unit/matter-security-isolation.test.ts` (1 test)
    - `tests/unit/anti-adjudication-safety.test.ts` (3 tests)
  - 232 / 232 Vitest tests passing across all 38 test files (100% pass rate)
  - 0 TypeScript errors (`npm run type-check`)
  - 0 ESLint errors & 0 warnings (`npm run lint`)
  - Clean Next.js 16.3.5 Turbopack production build (`npm run build`)

**Verification Commands:**
```bash
npm run type-check  # 0 TypeScript errors
npm run lint        # 0 ESLint errors & 0 warnings
npm test            # 232/232 Vitest tests pass across 38 test files
npm run build       # Clean Next.js 16.3.5 Turbopack production build
```

**Dependencies:** Phase 9


