# Implementation status — 2026-09-26

This file supersedes the historical phase claims in README, `steps.md`, and `architecture.md`.

## Trust model and data flow

- Production requires `APP_SESSION_SECRET` (32+ characters). Missing or placeholder values return 503 for private routes. Passwords use salted scrypt hashes. Login creates a random, signed, HttpOnly, SameSite=Strict 12-hour token whose hash is stored in SQLite for server-side validation and revocation.
- Landing, demo, sign-in, sign-up, and general Legal Navigator content are public. Documents, comparisons, matters, preparation briefs, contextual legal information, and their APIs require an account. Ownership is checked in domain services as well as at the API boundary. The evaluator login is an explicitly shared sample workspace kept enabled for submission review.
- The original PDF stays in local storage. Processing extracts text locally. AI features send extracted text, user questions, and relevant matter context to the configured Gemini API. Check the data-handling terms for the Gemini account used before uploading sensitive client material. Existing files uploaded to Gemini by older app versions may still be subject to its retention policy; the new code does not upload originals.
- The source registry links to official sites for further reading. It does not retrieve or verify a specific statute or guidance passage. General topic explanations are educational background, not current jurisdiction-specific legal conclusions.
- A verified quote means text was found on the stated page. It does not establish that a summary or interpretation follows from it. Important conclusions require human review.

## Changes from the review

1. Added individual account authentication, signed and revocable sessions, login and API throttling, same-origin checks for state-changing API calls, sign-out, and owner-scoped data services.
2. Removed unused original-PDF upload to Gemini Files API. Corrected the demo's training and hallucination guarantees.
3. Added upload body and PDF page/text limits; empty scanned PDFs now fail clearly. The PDF viewer worker is bundled locally.
4. Replaced invented offline legal findings with literal source excerpts and explicit unavailable states. Interpretation findings retain an interpretation label even when their quote matches. Unverified citations are flagged for review.
5. Comparisons require verified source evidence from the correct version(s). Matter Q&A verifies that model citations belong to the matter and match source pages, and abstains when none do. Consistency findings require both source quotes on their claimed pages and financial terms of the same name.
6. Forced reanalysis replaces only its own citations in one transaction. Evidence ledger GETs compute without provider calls or database rewrites; explicit sync persists atomically.
7. Tests use an in-memory SQLite database. Database migration failure stops startup. The Compose port and health check match the container port. Security headers now include CSP, frame, referrer, MIME, and permissions controls. Modal focus uses the native dialog; navigation no longer nests buttons in links. The font is a local system stack.
8. Added single-document question answering with page retrieval, a small prompt budget, quote validation, and abstention when cited support is absent. Offline mode returns source excerpts rather than an invented answer.
9. Reconciled the local development database against stored PDFs. It contained 2,025 document records but only one PDF; 2,024 missing-file records and 1,095 linked test matters were removed after backing up `data` and `uploads` to `data/backups/before-stale-cleanup-2026-09-18`. The surviving historical stress-test PDF is labeled as a sample. Missing files are now marked unavailable in document lists, excluded from compare and preparation selectors, and served as 404 responses. The viewer handles failed PDF requests without a runtime overlay.
10. Follow-up score review: consolidated matter-list counts, deferred brief/evidence tab requests, reused readiness consistency metrics, indexed repeated SQLite lookups, and reduced health checks to `SELECT 1`. Production now rejects missing access credentials, sign-in bodies are bounded while streaming, and only named public assets bypass the proxy. See [score improvement review](./score-improvement-review.md) for evidence and limits.
11. Final audit: isolated matter and preparation brief records, blocked foreign matter references in action items and preparations, made replacement writes atomic, grounded counsel questions and matter brief evidence labels, removed an unvalidated summary model call, and reduced Source Map fetches and retained PDF bytes. See [final pre-submission audit](./final-pre-submission-audit.md).
12. Submission hardening: removed the production open-access bypass, enforced authentication inside every private route, required canonical-origin plus application-header checks for mutations, moved unsafe route error handling into one helper, and added a complete protected-route inventory test.
13. Added a per-request nonce CSP without `script-src 'unsafe-inline'`. Because Next.js applies the nonce while rendering, the root layout is explicitly dynamic. Inline React style attributes retain a documented `style-src-attr 'unsafe-inline'` exception until they are migrated to CSS.
14. Expensive generation now coalesces identical concurrent requests in one process. Matter brief assembly reuses existing data without a second Gemini question-generation call, source-map page metadata is batch loaded, evidence synchronization batches page reads, and tab data is cached and abortable.
15. AI responses are accepted only as exact, size-bounded JSON. Recursive output guards reject excessive depth, node counts, long strings, prototype-pollution keys, and invalid stored artifact shapes before the data reaches the UI.
16. The Matter workspace now implements keyboard-operable tabs, associated tab panels, programmatic progress, native modal focus management, semantic source controls, accessible errors, and an Escape-aware document viewer panel. A global recovery page covers unexpected rendering failures.
17. Added a CI verification workflow and a single `npm run verify` gate for TypeScript, ESLint, Vitest, and the production build. See [final submission readiness](./final-submission-readiness.md) for the current evidence and operational limits.
18. Added strict Zod contracts for every structured Gemini response. Their JSON Schema constrains provider output, and the same schema validates field types, enums, bounds, and unknown fields before domain reconciliation or persistence.
19. Split the Matter service into focused capability modules behind its existing facade. Split the Matter workspace into a shell, orchestration hook, and thirteen focused panels without changing the page contract.
20. Removed the copied public PDF worker. React-PDF now imports the exact worker from `pdfjs-dist`, and Next.js emits it as a versioned local build asset. Resource limits and measured verification evidence are recorded in [performance and resource budget](./performance-and-resource-budget.md).

## Setup

Run `npm ci`, copy `.env.example` to `.env.local`, configure a real Gemini API key if desired, then `npm run dev`. Development uses a local-only signing fallback; production requires a strong `APP_SESSION_SECRET` and exact `APP_ORIGIN`. The no-key path presents local source excerpts and cannot generate a full plain-language legal analysis. Keep only non-sensitive sample data in the shared evaluator account.

For Docker Compose, put a session secret in `.env`, configure `GEMINI_API_KEY` as needed, and run `docker compose up --build`. The app is exposed at host port 3000 and listens on 8080 in the container. Persist `data` and `uploads`, back up both together, and protect backups as legal documents. Docker itself was unavailable for a container smoke test in this environment.

## Verification

- `tsc --noEmit`: passed.
- Vitest: the latest full run passed **321 tests across 52 files**, including protected-route coverage, browser Fetch Metadata and mutation-origin enforcement, two-account ownership, session enforcement, isolation, single-flight behavior, rollback, evidence, strict AI schemas, malformed input, migration, and privacy regressions. Protected route tests use signed database-backed sessions. Tests use an in-memory SQLite database and do not write the workspace SQLite file.
- Next.js 16.3.5 production build: passed without a font fetch.
- Route-boundary tests: all private API route files are inventoried, and representative upload, delete, file, analysis, comparison, matter, and preparation handlers return 401 without a session.
- ESLint: passed on 2026-09-21 after the final implementation edits.
- Full npm audit: four moderate development-tool advisories with no high or critical findings; production dependency audit (`--omit=dev`): zero vulnerabilities.
- Browser smoke testing is intentionally left to the submission owner for the final deployed configuration.

## Remaining before claiming production readiness

- The evaluator account is shared by design and must never hold sensitive documents. Account activity is not yet attributed to individual audit-log events beyond ownership.
- Model JSON is provider-constrained and field-validated, and citations are reconciled to owned source pages. Schema validity and quote presence do not prove that an interpretation follows from the quote. A graded set of legal-answer, abstention, and prompt-injection fixtures is still needed.
- PDF page/text caps protect common resource use; there is no strict CPU/decompression deadline or OCR path for scanned documents. Proxy body buffering is bounded to 21 MB, but an upstream reverse proxy should also enforce a request-size limit.
- Browser keyboard and screen-reader audits, live-model contract tests, and Docker container tests remain. WCAG conformance has not been independently measured.
- Rate limiting and duplicate-generation coalescing are process-local. A multi-instance deployment needs a shared store and distributed lock.
- A nonce CSP makes pages dynamically rendered, which trades static caching for stronger script controls. `style-src-attr 'unsafe-inline'` remains for existing React style attributes.
- The demo is a feature walkthrough, not a pre-analyzed interactive sample. Legal information links are navigational until official passages can be retrieved and versioned.
