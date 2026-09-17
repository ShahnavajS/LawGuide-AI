# LexiGuide AI — System Architecture

## High-Level Architecture Diagram

```
                    ┌───────────────────────────┐
                    │      USER (Browser)        │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │    Next.js 15 Frontend     │
                    │  (App Router + React 19)   │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │   Landing Page       │  │
                    │  │   Dashboard          │  │
                    │  │   Analysis View      │  │
                    │  │   Compare View       │  │
                    │  │   Prepare View       │  │
                    │  │   PDF Viewer         │  │
                    │  └─────────────────────┘  │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    Next.js API Layer       │
                    │  (API Routes + Server      │
                    │   Actions)                 │
                    │                           │
                    │  /api/documents/upload     │
                    │  /api/documents/[docId]    │
                    │  /api/analyze/xray         │
                    │  /api/analyze/ask          │
                    │  /api/compare              │
                    │  /api/prepare              │
                    └───┬───────┬───────┬───────┘
                        │       │       │
              ┌─────────▼──┐  ┌▼──────┐ ┌▼──────────┐
              │  Document   │  │  AI    │ │  Evidence  │
              │  Processing │  │  Orch. │ │  Service   │
              │  Service    │  │ Service│ │            │
              └──────┬──────┘  └───┬───┘ └────┬──────┘
                     │             │           │
              ┌──────▼──────┐  ┌──▼────────┐  │
              │  Filesystem  │  │  Gemini   │  │
              │  Storage     │  │  2.0 Flash│  │
              │  (/uploads)  │  │  + Files  │  │
              └──────────────┘  │  API      │  │
                                └───────────┘  │
              ┌────────────────────────────────▼┐
              │         SQLite Database          │
              │  (Documents, Analyses, Citations │
              │   ChatMessages, Comparisons)     │
              └──────────────────────────────────┘
```

## Component Architecture

### Frontend Components

```
App Layout
├── Header
│   ├── Logo + Brand
│   ├── Navigation (Dashboard | Analyze | Compare | Prepare)
│   └── Theme Toggle
│
├── Landing Page
│   ├── Hero Section (tagline + CTA)
│   ├── Feature Cards (4 pillars)
│   └── Footer (disclaimer)
│
├── Dashboard
│   ├── DocumentUpload (drag-drop + browse)
│   ├── DocumentList
│   │   └── DocumentCard (name, size, date, status, actions)
│   └── EmptyState
│
├── Analysis Workspace (Two-Pane)
│   ├── Left Panel
│   │   ├── LegalXRay (accordion sections)
│   │   │   ├── SummaryPanel
│   │   │   ├── ClauseCard (with AttentionBadge + CitationLink)
│   │   │   └── AttentionItems
│   │   ├── ChatPanel
│   │   │   ├── ChatMessage (user/assistant)
│   │   │   ├── CitationInline
│   │   │   └── ChatInput
│   │   └── TabSwitcher (X-Ray | Q&A | Prepare)
│   │
│   └── Right Panel
│       └── DocumentViewer
│           ├── PDFRenderer (react-pdf)
│           ├── PageNavigation
│           ├── ZoomControls
│           └── HighlightOverlay
│
├── Compare View
│   ├── CompareUpload (two document slots)
│   ├── CompareView
│   │   ├── DiffCard (added/removed/modified)
│   │   └── DualDocumentViewer
│   └── CompareSummary
│
└── Prepare View
    ├── LawyerBrief
    ├── QuestionsList (checkable)
    ├── ChecklistView
    └── ExportButton
```

### Service Architecture

```
lib/
├── ai/
│   ├── gemini.ts          → Gemini client singleton
│   ├── prompts.ts         → All system prompts (typed)
│   ├── schemas.ts         → Structured output schemas
│   └── safety.ts          → Spotlighting + sanitization
│
├── document/
│   ├── service.ts         → Document service coordinating storage, DB, and validation
│   ├── validation.ts      → Strict PDF format, magic bytes (%PDF-), and size verification
│   ├── storage.ts         → LocalStorageService with isolated directory structure & traversal protection
│   ├── processor.ts       → Future PDF extraction and parsing pipeline
│   └── types.ts           → Document domain models, DTOs, and lifecycle states
│
├── comparison/
│   ├── service.ts         → Semantic comparison orchestration, dual citation validation, caching
│   └── alignment.ts       → Deterministic clause alignment & semantic delta detection
│
├── preparation/
│   └── service.ts         → Preparation synthesis, question deduplication, checklist persistence
│
├── db/
│   ├── index.ts           → better-sqlite3 connection with auto-migrations
│   ├── schema.ts          → Drizzle table definitions (documents, analyses, citations, comparisons, preparations)
│   └── migrations/        → SQL migration files
│
├── evidence/
│   ├── citation.ts        → Citation builder + formatter
│   └── validator.ts       → Validate citations vs. document
│
└── utils/
    ├── errors.ts          → Error classes + handlers
    ├── constants.ts       → App-wide constants
    └── helpers.ts         → Pure utility functions
```

### Preparation Data Flow (Phase 6)
```
User selects Analyzed Document / Completed Comparison
    ↓
User enters Consultation Purpose + User Notes
    ↓
POST /api/preparations
    ↓
PreparationService validates source readiness
    ↓
Loads verified Legal X-Ray findings + Comparison deltas
    ↓
Synthesizes with SYSTEM_PREPARATION_ANALYST_PROMPT (or deterministic offline fallback)
    ↓
CitationValidator re-verifies claims against document_pages.text
    ↓
Deduplicates questions across X-Ray, comparison, and user concerns
    ↓
Persists brief to preparations table & validated citations to citations table
    ↓
Returns PreparationBrief to PreparationWorkspace
    ↓
Interactive Checklist tracking & Native @media print export
```

## Data Flow

### Document Upload Flow
```
User selects PDF
    ↓
Client validates file type + size
    ↓
POST /api/documents/upload (multipart/form-data)
    ↓
Server validates MIME type
    ↓
Generate UUID → create /uploads/{uuid}/
    ↓
Save file to filesystem
    ↓
INSERT into documents table (status: "uploaded")
    ↓
Upload to Gemini Files API (async)
    ↓
UPDATE document (status: "ready", geminiFileUri)
    ↓
Return document metadata to client
```

### Legal X-Ray Flow
```
User clicks "Analyze" on a document
    ↓
POST /api/analyze/xray { documentId }
    ↓
Check for existing analysis (cache hit → return)
    ↓
Retrieve Gemini file URI from database
    ↓
Build system prompt + structured output schema
    ↓
Send to Gemini 2.0 Flash with file reference
    ↓
Parse structured JSON response
    ↓
Validate citations (page numbers within range)
    ↓
INSERT into analyses table
    ↓
INSERT citations into citations table
    ↓
Return structured analysis to client
    ↓
Render Legal X-Ray dashboard with citation links
```

### Q&A Flow
```
User types question in chat
    ↓
POST /api/analyze/ask { documentId, question }
    ↓
Retrieve Gemini file URI
    ↓
Build Q&A prompt (document-grounded, safety-guarded)
    ↓
Stream response from Gemini
    ↓
Parse inline citations from response
    ↓
INSERT chat message into chat_messages table
    ↓
Stream formatted response to client
    ↓
Render with clickable citation links
```

## Security Layers

```
Layer 1: Input Validation
├── File type whitelist (PDF only)
├── File size limit (20MB)
├── Filename sanitization
└── Content-Type verification

Layer 2: Prompt Safety
├── XML delimiter spotlighting
├── Instruction/data separation
├── System prompt immutability
└── Injection pattern detection

Layer 3: Output Validation
├── Citation page number range check
├── Confidence level assignment
├── Evidence label enforcement
└── Legal safety language check

Layer 4: Data Isolation
├── Session-scoped document access
├── No cross-document leakage
├── Secure file paths
└── No sensitive data in logs
```

---

## Phase 3 Architecture: Document Processing & PDF Viewer

### 1. Server-Side Document Processing Pipeline
- **Engine**: `pdfjs-dist` (Node.js legacy build) orchestrated via `PdfDocumentProcessor implements DocumentProcessor`.
- **Page-Aware Text Extraction**: Each page is extracted individually preserving:
  - Natural page number (1-indexed)
  - Raw extracted text tokens and punctuation (no destructive normalization)
  - Ordering and page boundaries
- **Scanned/Empty Page Handling**: When a page contains image-only or scanned content, it is recorded honestly (`text: ""`, `hasText: false`) without hallucinating text or failing.
- **Database Persistence**: Extracted pages are inserted into SQLite `document_pages` with foreign key cascade to `documents.id`.

### 2. Processing Lifecycle & Idempotency
- **State Machine**:
  ```
  UPLOADED  ──►  PROCESSING  ──►  READY
                     │
                     ▼
                   FAILED (Safe Error + Original PDF Retained)
                     │
                     ▼
                   Retry ──► PROCESSING ──► READY
  ```
- **Idempotency Guarantee**: If `processDocument()` is invoked on a document that is already `READY`, it returns immediately without re-parsing or duplicating database records.
- **Data Consistency on Retry**: Previous page records for the document are pruned before re-inserting freshly extracted pages.
- **Physical File Preservation**: Processing failure sets `status = 'FAILED'` and records a safe `processingError`, but never deletes the uploaded PDF file.

### 3. Gemini Files API Ingestion
- Uploads the validated local PDF buffer to Google GenAI Files API via `geminiService.uploadFile()`.
- Stores the server-side URI in `documents.gemini_file_uri`.
- Graceful offline fallback: If the API key is not configured or an external network error occurs, local page extraction succeeds and transitions the document to `READY`.

### 4. Interactive PDF Viewer Architecture
- **Component**: `DocumentViewer.tsx` (Client component using `react-pdf`).
- **Features**: Page navigation, current page indicator (`Page X of Y`), jump-to-page input, zoom controls (0.6x to 2.5x), keyboard navigation (Arrow keys, PageUp/PageDown, +/-), responsive layout, and accessible loading/error states.
- **Security**: The viewer retrieves document buffers through the protected API endpoint `GET /api/documents/[docId]/file`, preventing arbitrary path traversal.

### 5. Current Limitations
- Supports digital text PDFs. Scanned/rasterized PDFs with no embedded text are marked `hasText: false` (OCR deferred to future phase).
- Multi-column complex layout reflow is preserved in standard reading order.

---

## Phase 4 Architecture: Legal X-Ray & Evidence Verification

### 1. Legal X-Ray Engine Overview
The Legal X-Ray engine transforms unstructured legal documents into an executive legal dossier categorized into 7 domains:
1. **Document Overview**: Type, summary, governing law, jurisdiction, purpose.
2. **Contracting Parties**: Entities, designated roles, addresses, representation capacity.
3. **Key Dates**: Effective dates, execution dates, renewal terms, milestones, termination windows.
4. **Obligations & Rights**: Affirmative covenants, restrictions, deadlines, entitlements, termination rights.
5. **Financial Terms**: Compensation, payment schedules, currency, interest, penalties, caps.
6. **Material Clauses & Review Attention**: High/Medium/Low/Informational clauses with plain-language explanations.
7. **Human Preparation Brief**: Structured, grounded questions designed for legal counsel review.

### 2. Anti-Fabrication & Evidence Verification Pipeline
```
[LLM Structured Output]
         │
         ▼
[Citation Extraction]
         │
         ▼
[CitationValidator.validateCitation()]
         │
         ├── Check 1: Exact Text Match on Target Page (confidence = 1.0)
         │
         ├── Check 2: Whitespace-Normalized Match on Target Page (confidence = 0.95)
         │
         ├── Check 3: Wrong-Page Detection (Searches all other pages, confidence = 0.6)
         │
         ├── Check 4: Substring/Partial Match (confidence = 0.5)
         │
         └── Fallback: Unverified (confidence = 0.0)
                     │
                     ▼
       [Classification Reconciliation]
    DOCUMENT_FACT ──► NEEDS_REVIEW + Advisory Note
```

- **Integrity Rule**: The AI must never invent facts. Unverified citations are downgraded from `DOCUMENT_FACT` to `NEEDS_REVIEW`.
- **Database Persistence**: Stored in `analyses` (`analysis_data_json`) and individual validated citations in `citations`.

### 3. Interactive Viewer Bidirectional Communication
- Clicking any citation badge or citation seal (`📄 Page X · Section Y`) in `LegalXRay.tsx` triggers a state change in the parent workspace (`/analyze/[docId]`).
- The target page number flows down as the `activePage` prop to `DocumentViewer.tsx`.
- `DocumentViewer` synchronizes page state during render (following React 19 standards, avoiding cascading `setState` in effects) and smoothly scrolls the user to the verified source quote.

### 4. Executive Obsidian & Gold Design Architecture
- **Aesthetic Principles**: Dark obsidian backdrop (`#0b0d10`), hairline gold borders (`rgba(200, 162, 86, 0.25)`), pill tab counters, and interactive citation seals.
- **Evidence Health Bar**: Dynamic progress bar calculating the verified citation ratio across all extracted findings.

---

## Phase 5 Architecture: Semantic Document Comparison & Dual Evidence Verification

### 1. Document Version Comparison Pipeline
```
         BASE DOCUMENT                                TARGET DOCUMENT
               │                                             │
               ▼                                             ▼
       Stored Page Text                              Stored Page Text
               │                                             │
               ▼                                             ▼
        Clause Extraction                             Clause Extraction
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      ▼
                           CLAUSE ALIGNMENT ENGINE
                 (Section Numbers, Headings, Normalized Tokens)
                                      │
                                      ▼
                        SEMANTIC CHANGE DETECTION
                  (Notice periods, monetary amounts, indemnities)
                                      │
                                      ▼
                         AI REASONING & SUMMARY
                 (Neutral language, practical implications)
                                      │
                                      ▼
                     DUAL-CITATION ANTI-FABRICATION
                  Base Citations ──► CitationValidator vs Base Pages
                  Target Citations ──► CitationValidator vs Target Pages
                                      │
                                      ▼
                     RECONCILIATION & DOWNGRADING
                   Unverified ──► NEEDS_REVIEW + Note
                                      │
                                      ▼
                       SQLITE DATABASE & DUAL VIEW UI
```

### 2. Clause Alignment Strategy (Not Raw Text Diff)
- Legal documents change due to formatting, page breaks, numbering, and whitespace artifacts.
- The alignment operates at the **DOCUMENT → SECTION → CLAUSE → SEMANTIC CHANGE** level:
  - **Normalization**: Collapses harmless linebreaks and multiple spaces without stripping legal words, numbers, or qualifiers.
  - **Hierarchy Alignment**: Matches by exact section numbering (e.g. `11.2` == `11.2`), title similarity, and text overlap.
  - **Change Categorization**:
    - `UNCHANGED`: Matching clause with no substantive difference.
    - `MODIFIED`: Matching clause with substantive revisions.
    - `ADDED`: New section present only in Target document.
    - `REMOVED`: Section omitted from Target document.
  - **Field Delta Extraction**: Tracks concrete changes (e.g. `notice_period`: `30 days` → `60 days`).

### 3. Dual-Citation Verification
- Every `MODIFIED` clause must provide two independent citations: `baseEvidence` and `targetEvidence`.
- `baseEvidence` is verified against Base document pages.
- `targetEvidence` is verified against Target document pages.
- Unverified citations are downgraded from `DOCUMENT_FACT` to `NEEDS_REVIEW`.

### 4. Interactive Dual Viewer Architecture
- `ComparisonWorkspace.tsx` manages independent `baseActivePage` and `targetActivePage` states.
- Clicking a Base citation seal commands the Base viewer to scroll to that page.
- Clicking a Target citation seal commands the Target viewer to scroll to that page.
- Supports side-by-side view, base-only view, and target-only view.

---

## Phase 7: Legal Information Navigator Architecture

```
                    ┌─────────────────────────────────────────┐
                    │      LEGAL INFORMATION NAVIGATOR        │
                    │   (/legal-info & LegalInfoModal)        │
                    └────────────────────┬────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  [MODE 1: MY DOCUMENT]      [MODE 2: GENERAL LEGAL INFO]    [MODE 3: PREPARE FOR COUNSEL]
  Answers strictly from       Educational explanation from    Prioritized questions &
  uploaded document text      registered authoritative        preparation tasks for
  (DOCUMENT_FACT verified)    sources (PRIMARY/SECONDARY)     licensed legal counsel
        │                                │                                │
        ├────────────────────────────────┼────────────────────────────────┘
        ▼                                ▼
┌───────────────────────────┐    ┌───────────────────────────────┐
│ JURISDICTION ENGINE       │    │ CONTROLLED TAXONOMY (29)      │
│ - DOCUMENT_JURISDICTION   │    │ - TERMINATION, INDEMNITY,     │
│ - USER_PROVIDED           │    │   ARBITRATION, NOTICE, etc.   │
│ - JURISDICTION_UNSET      │    │ - Categorized plain-language  │
│ (Strict Non-Inference)    │    │   commercial definitions      │
└─────────────┬─────────────┘    └───────────────┬───────────────┘
              │                                  │
              └─────────────────┬────────────────┘
                                ▼
                 ┌─────────────────────────────┐
                 │  LegalInformationService    │
                 │  - Topic Resolution         │
                 │  - CitationValidator Anchor │
                 │  - Offline Fallback Engine  │
                 │  - Anti-UPL Guardrails      │
                 └──────────────┬──────────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
┌───────────────────────────┐               ┌───────────────────────────┐
│ AUTHORITATIVE SOURCES     │               │ SQLITE CACHE              │
│ - PRIMARY (India Code,    │               │ (legal_information_cache) │
│   SCI, NALSA, MCA, UK)    │               │ - 24-hour TTL             │
│ - SECONDARY (Cornell LII) │               │ - Fast repeat retrieval   │
│ - Strict HTTPS allowlist  │               └───────────────────────────┘
└───────────────────────────┘
```

### 1. Three Explicit Modes
Every response and interface in the Legal Information Navigator clearly indicates which mode is active:
- `MODE 1 — MY DOCUMENT`: Grounded strictly in uploaded document text with page citations (`DOCUMENT_FACT`).
- `MODE 2 — GENERAL LEGAL INFORMATION`: Explains general concepts using authoritative legal-information sources (`PRIMARY` / `SECONDARY`).
- `MODE 3 — PREPARE FOR COUNSEL`: Generates neutral, prioritized questions and preparation tasks for consultations with a human attorney.

### 2. Jurisdiction Provenance Engine (Strict Non-Inference)
- `DOCUMENT JURISDICTION`: Derived exclusively from governing law explicitly identified in verified document analysis.
- `USER-PROVIDED JURISDICTION`: Explicitly chosen by user from selector dropdown or input.
- `JURISDICTION NOT ESTABLISHED`: Safe default when neither is present.
- **Rule**: Never inferred from IP, browser location, currency, language, or company address alone.

### 3. Controlled Source Trust Hierarchy & Allowlist Validation
- `PRIMARY`: Official legislation (India Code, UK Legislation), courts (Supreme Court of India), and statutory authorities (NALSA, MCA).
- `SECONDARY`: Established legal research institutions (Cornell Law LII).
- `GENERAL`: Educational explanatory resources.
- Strict security validation: All URLs must use HTTPS, match a strict domain allowlist, and block executable schemes (`javascript:`, `data:`, `file:`) and private/internal IP ranges.

### 4. Controlled Concept Q&A & In-Place Modal
- Users can click `[ 📖 Understand Concept ]` on any clause, obligation, or difference card in Legal X-Ray or Comparison to open `LegalInfoModal` in-place.
- Controlled Q&A endpoint (`POST /api/legal-info/query`) structures responses into three separate sections:
  1. What Your Document States (`DOCUMENT_FACT`)
  2. General Legal Principles (`GENERAL_INFO`)
  3. Questions to Discuss with Counsel (`PREPARE_FOR_COUNSEL`)




