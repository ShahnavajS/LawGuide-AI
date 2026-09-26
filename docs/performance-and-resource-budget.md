# Performance and resource budget

**Verified:** 2026-09-26  
**Scope:** single Node.js process, local SQLite, local filesystem storage

LawGuide AI is intentionally sized for a private, single-instance legal document workspace. This document records the limits and optimizations that keep expensive PDF, database, browser, and AI work bounded. It distinguishes verified behavior from measurements that still require a deployed browser environment.

## Runtime budgets

| Resource | Enforced budget | Enforcement point |
| --- | ---: | --- |
| Uploaded PDF | 20 MiB | `src/lib/document/validation.ts` |
| Extracted PDF pages | 100 | `src/lib/document/processor.ts` |
| Extracted PDF text | 500,000 characters | `src/lib/document/processor.ts` |
| Authentication form | 16 KiB, enforced while streaming | `src/lib/auth/http.ts` |
| Structured AI value | 5,000 nodes, depth 12, 20,000 characters per string | `src/lib/ai/validate-output.ts` |
| Persisted JSON artifact | 5,000,000 UTF-8 bytes before parsing | `src/lib/ai/validate-output.ts` |
| AI collection sizes | 5 to 200 items depending on the contract | `src/lib/ai/runtime-schemas.ts` |
| Browser PDF byte cache | 3 documents, least-recently-used order | `src/components/document/DocumentViewerImpl.tsx` |
| File existence checks | 32 concurrent filesystem operations per batch | `src/lib/document/service.ts` |

These are rejection budgets, not target payload sizes. They prevent a single document or model response from consuming unbounded memory while preserving the challenge's normal document workflows.

## Work avoided or shared

- Analysis, comparison, preparation, counsel-question generation, and matter brief generation return current persisted results unless regeneration is explicitly requested.
- Identical expensive operations share one in-flight promise per process through `runSingleFlight`; failed and completed operations are removed from the map.
- Opening a Matter tab performs reads. Provider-backed generation requires an explicit user action.
- Matter brief assembly reuses already loaded matter data and deterministic questions instead of hiding a second provider request.
- Source Map returns its evidence ledger in the same response. Evidence and page metadata are grouped in memory after bounded database reads.
- The Matter workspace aborts obsolete tab requests and remembers successfully loaded tabs, which prevents repeated requests while navigating between panels.
- The PDF viewer shares each in-flight file request and keeps at most three completed byte arrays. A rejected request is evicted so retry remains possible.
- The server PDF processor always destroys the PDF.js loading task in a `finally` block.

## Database access

The schema includes indexes for owner-scoped document and matter listings, document pages, comparison pairs, matter documents, relationships, notes, action items, activities, evidence, sessions, and cached preparation sources. Migrations `0009` through `0012` contain the current index chain.

SQLite is synchronous by design in this application. Independent higher-level reads run concurrently where they include asynchronous work, but database queries are kept small and indexed rather than wrapped in artificial concurrency. Replacement writes for pages, evidence, and briefs use transactions so a failed regeneration cannot leave a half-written artifact.

## AI response efficiency and integrity

Each structured Gemini workflow now uses one Zod contract for two boundaries:

1. its JSON Schema is supplied to Gemini as `responseJsonSchema`; and
2. the returned value is bounded and parsed with the same field-level schema before domain logic or persistence.

The schemas reject unknown fields, invalid enums and types, oversized collections, and oversized strings. Citation reconciliation still runs after schema validation because a structurally valid citation can refer to the wrong document or quote.

## Build and verification evidence

Local verification on 2026-09-26 produced:

| Check | Result |
| --- | --- |
| Vitest | 321 tests across 52 files passed in 37.54 seconds |
| TypeScript | `tsc --noEmit` passed |
| ESLint | Passed after the refactor with no application errors |
| Next.js production build | Compiled in 3.4 seconds; TypeScript phase completed in 5.2 seconds |
| PDF worker | Emitted by Turbopack as a versioned local asset, 1,265,413 bytes |

Build time and test duration are environment-specific diagnostics. They are recorded for reproducibility and are not presented as end-user latency measurements.

## Maintainability and scaling envelope

The former 3,600-line Matter service is now a 13-line compatibility facade over six focused capabilities; the largest capability is under 1,000 lines. The former 3,000-line Matter workspace is now a 527-line shell, a 743-line orchestration hook, and thirteen panels; the largest panel is 616 lines. This reduces change scope and client rendering complexity without changing the route or service APIs.

The current rate limiter, request coalescing, SQLite connection, and filesystem are process-local. A multi-instance deployment must move sessions/data/storage as appropriate and use a shared rate limiter and distributed operation lock. No claim of horizontal scalability is made for the current configuration.

## Measurements still owned by deployment

The final deployment should record Core Web Vitals, route payloads, browser request counts, PDF-viewer heap behavior, and live Gemini latency/token use on non-sensitive fixtures. Browser smoke and accessibility testing remain separate from the deterministic repository gate because results depend on the deployed host, browser, and configured model.
