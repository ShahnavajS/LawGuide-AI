# Implementation status — 2026-09-19

This file supersedes the historical phase claims in README, `steps.md`, and `architecture.md`.

## Trust model and data flow

- Production requires `APP_SESSION_SECRET` (32+ characters). Missing or placeholder values return 503 for private routes. Passwords use salted scrypt hashes. Login creates a random, signed, HttpOnly, SameSite=Strict 12-hour token whose hash is stored in SQLite for server-side validation and revocation.
- Landing, demo, sign-in, sign-up, and general Legal Navigator content are public. Documents, comparisons, matters, preparation briefs, contextual legal information, and their APIs require an account. Ownership is checked in domain services as well as at the API boundary. The evaluator login is an explicitly shared sample workspace and is disabled by default in production.
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

## Setup

Run `npm ci`, copy `.env.example` to `.env.local`, configure a real Gemini API key if desired, then `npm run dev`. Development uses a local-only signing fallback; production requires a strong `APP_SESSION_SECRET`. The no-key path presents local source excerpts and cannot generate a full plain-language legal analysis. Enable `EVALUATOR_DEMO_ENABLED` only for a judging or demonstration environment and store sample data in that account.

For Docker Compose, put a session secret in `.env`, configure `GEMINI_API_KEY` as needed, and run `docker compose up --build`. The app is exposed at host port 3000 and listens on 8080 in the container. Persist `data` and `uploads`, back up both together, and protect backups as legal documents. Docker itself was unavailable for a container smoke test in this environment.

## Verification

- `tsc --noEmit`: passed.
- Vitest: the latest full run passed **308 tests across 48 files**, including two-account ownership, session enforcement, isolation, rollback, evidence, malformed-input, migration, and privacy regressions. Tests use an in-memory SQLite database and do not write the workspace SQLite file.
- Next.js 16.3.5 production build: passed without a font fetch.
- HTTP smoke check: unauthenticated `/api/documents` returned 401; login returned a signed cookie and authenticated API access succeeded.
- ESLint: passed on 2026-09-19 after the final implementation edits.
- Full npm audit: four moderate development-tool advisories; production dependency audit (`--omit=dev`): zero vulnerabilities.
- Browser check: Documents displayed one labeled sample, its eight-page PDF opened, and the reported stale document URL showed a Document Not Found page. The valid PDF API returned 200 and the stale URL returned 404.

## Remaining before claiming production readiness

- The evaluator account is shared by design and must never hold sensitive documents. Account activity is not yet attributed to individual audit-log events beyond ownership.
- Model JSON is parsed and partially guarded, but there is no full runtime schema for every AI output. Claim-to-quote entailment is not automatically proven. A graded set of legal-answer, abstention, and prompt-injection fixtures is needed.
- PDF page/text caps protect common resource use; there is no strict CPU/decompression deadline or OCR path for scanned documents. Proxy body buffering is bounded to 21 MB, but an upstream reverse proxy should also enforce a request-size limit.
- Browser keyboard and screen-reader audits, live-model contract tests, and Docker container tests remain. WCAG conformance has not been measured.
- `MatterService` and `MatterWorkspace` remain large modules and should be split along existing journeys with regression coverage.
- The demo is a feature walkthrough, not a pre-analyzed interactive sample. Legal information links are navigational until official passages can be retrieved and versioned.
