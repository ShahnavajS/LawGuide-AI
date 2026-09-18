# Final Pre-Submission Audit Report — 2026-09-19

LexiGuide AI remains a **shared private workspace** for understanding legal documents, comparing versions, and preparing questions for counsel. This report records the repository review and local verification before the second submission. It is not a security certification or an external evaluation score.

## 1. Repository baseline

Before this audit's changes, the existing optimization pass had **293 tests across 44 files passing**, TypeScript and ESLint passing, and a passing Next.js production build. The dependency audit found **four moderate advisories**, all through development-only `drizzle-kit` → `esbuild`; the production dependency audit found zero. The earlier score-improvement work and its measured SQLite microbenchmark are documented in [score-improvement-review.md](./score-improvement-review.md).

Architecture inspected: Next.js 16.3.5 and React 19 UI/API, Drizzle ORM and local SQLite, private filesystem PDF storage, local PDF.js extraction, and optional Gemini requests using extracted text. The app has one password-protected workspace, not user accounts or tenant ownership. No E2E configuration or automated accessibility browser test exists in the repository.

## 2. Findings, fixes, and verification

| Area | Problem observed | Fix | Verification |
| --- | --- | --- | --- |
| Code quality / integrity | Replacing document pages or a consultation brief could delete the previous record before a later write failed. Matter brief regeneration returned a new ID while retaining the old row ID. | Wrapped replacement writes in SQLite transactions. Matter brief row and returned ID now agree. | Injected SQLite failures preserve the previous page set and both brief types; targeted and full tests pass. |
| Security / matter boundary | An action item or preparation request could link a document, comparison, or relationship from another matter. | Validate matter membership before writes or cache reads. Require both comparison documents to be members; separate brief kinds at the database level. | A/B matter tests reject foreign IDs and verify valid links and cached briefs. |
| Security / API input | Null or malformed JSON and truncated multipart bodies sometimes became 500 responses. Client action items could claim AI-generated provenance. | Return 400 for malformed requests, bound preparation notes and purpose, and assign client-created provenance server-side. | API contract tests cover null, malformed, truncated, and spoofed inputs. |
| Security / secrets | Provider exceptions could include document text in logs or error messages. Backup output under the repository could be committed or copied into a Docker build; `.env` could enter the build context. | Use generic provider failure messages; ignore backup directories and `.env*` in the appropriate contexts. | Confidential-string redaction test and configuration review. |
| Security / readiness | Health could report 200 with missing production authentication secrets. | Return degraded 503 when the required auth configuration is invalid; document the local development exception. | Health and config tests. |
| Efficiency / source map | Opening Source Map fetched the same evidence twice; assembly repeatedly scanned all evidence per document and page and selected full page text just to calculate `hasText`. | One response now includes ledger items; group by document/page once and select `length(trim(text))`. | Source Map regression tests; code-path request count changed from two to one for this tab. No browser timing claim. |
| Efficiency / database | Pairwise comparison lookup scanned the comparisons table without a matching index. | Added `(base_document_id, target_document_id)` index in migration `0010`; added `(matter_id, brief_kind)` in `0011` for the two brief types. | In-memory `EXPLAIN QUERY PLAN`: pair lookup changed from `SCAN comparisons` to a covering index search. Migrations applied in in-memory test setup. |
| Efficiency / resources | PDF.js loading tasks were not explicitly destroyed after extraction; document-viewer byte cache could retain every opened PDF. | Always destroy the loading task and cap the browser byte cache at three PDFs. | Processor tests and code review; no memory benchmark performed. PDF.js documents `destroy()` for releasing task resources. |
| Efficiency / AI cost | Matter brief sent a Gemini request and treated its unvalidated free-form response as the summary. | Use a deterministic summary from already computed matter counts; remove the unused prompt and model call. | Matter brief tests; exact model-call savings are one call per newly generated or forced matter brief when Gemini was configured. |
| AI / evidence | Counsel question generation accepted model-supplied source IDs, titles, and quotes without fully reconciling them to the matter. Matter brief dates could be displayed as verified facts despite failed citation validation. | Limit model references to member documents, validate page/quote, use stored titles, reject unsupported questions, and preserve `NEEDS_REVIEW` plus quoted source text in the brief UI. | Foreign-document and fabricated-quote tests; unverified-date matter brief test. |
| Privacy / tests | A backup test copied the real workspace SQLite file despite the test suite's in-memory claim. | Test SQLite backup using the in-memory connection and a temporary snapshot. | Deployment-readiness test passes without reading or copying the real workspace DB. |
| Documentation / deployment | Setup and deployment instructions overstated migration and backup behavior. | Clarified checked-in migrations, production credential requirements, SQLite journal mode, shared access, and the need to pause writes when backing up DB plus PDFs. Docker build prunes development dependencies. | Static configuration review and production Next build; container verification remains unavailable here. |

### Brief-kind migration

Migration `0011` adds `preparations.brief_kind`, defaults existing document preparations to `PREPARATION`, and marks existing matter briefs whose legacy purpose starts `Matter Counsel Brief:` as `MATTER`. The two services now filter by kind so generating either brief does not overwrite the other. Legacy rows with a nonstandard purpose are outside this backfill rule and should be reviewed if they exist.

## 3. Efficiency improvements

| Area | Before | Change | After / expected effect | Measurement |
| --- | --- | --- | --- | --- |
| Matter list | `2N + 1` count/list queries | Grouped query from previous pass | One query | Prior in-memory microbenchmark in score-improvement review; no production benchmark |
| Source Map tab | Source map and evidence ledger each requested evidence | Bundle ledger in source-map response | One request instead of two for this tab | Code-path count, no network timing |
| Source Map assembly | Repeated per-page evidence filtering and full page-text selection | Group once; select trimmed text length | Less repeated scanning and smaller DB-to-service transfer | Algorithm/query inspection, no timed benchmark |
| Comparison lookup | Table scan for base/target pair | Composite index | Index search | SQLite `EXPLAIN QUERY PLAN` on in-memory database |
| Matter brief | One additional unvalidated Gemini text call when configured | Deterministic count summary | No summary-only provider call | Invocation path inspection, no cost benchmark |
| PDF lifecycle | Loading task could remain active after extraction | `destroy()` in `finally` | Worker resources released after processing | API contract and code review, no heap measurement |
| Viewer cache | Unbounded retained PDF byte entries | Cap at three recent entries | At most three cached PDF byte arrays per browser module instance | Cache bound inspection, no browser heap measurement |

The prior pass also bounded document-list filesystem checks, delayed hidden matter-tab requests, reused readiness consistency counts, added eleven targeted indexes, and changed health from a table count to `SELECT 1`. These were retained and covered by the complete regression suite.

## 4. Security and AI safety

Authentication is a signed shared-session cookie with production fail-closed configuration, login throttling, same-origin checks for mutations, and a request-size bound. This does **not** create individual ownership: anyone with the workspace password can access all documents and matters. Matter IDs provide grouping, and the new checks prevent accidental or malicious cross-matter links in scoped workflows; they are not tenant isolation.

Document text is treated as untrusted prompt context. Existing prompts constrain legal advice and jurisdiction claims; the citation validator checks whether a quoted excerpt appears on the stated source page. This establishes quote presence, **not** the truth of an AI interpretation. Legal X-Ray and comparison preserve interpretation/review classifications. The counsel-question path now discards foreign or unsupported citations, and the matter brief no longer labels failed citations as verified facts. User-provided context remains labeled separately. Anti-adjudication and abstention tests remained in the passing suite. Full runtime schemas and claim-to-quote entailment checks are still incomplete across all model outputs.

The official [PDF.js loading task API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentLoadingTask.html) describes `destroy()`. The remaining moderate development advisory is the [esbuild development-server advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99); the affected chain is excluded from the pruned runtime image. Do not expose the development server publicly.

## 5. Regression verification

The passing suite covers uploads, extraction, X-Ray, citations, comparison, legal information, preparation, matters, evidence, action plans, auth, errors, and deployment helpers. New tests focus on cross-matter action/preparation links, provenance spoofing, unsupported counsel citations, brief coexistence and rollback, PDF page replacement rollback, malformed upload/JSON, provider error privacy, and health configuration.

The historical Louisiana Purchase sample was checked **read-only** against its stored local PDF and analysis: one READY sample, eight PDF pages, eight stored pages with text, and 51 saved findings. Forty quotes matched their stored page exactly or after normalization; the other eleven were classified `NEEDS_REVIEW`. No new Gemini analysis was run, so this does not validate live-model reproducibility or legal correctness. No user files or database rows were modified during this check.

## 6. Final quality gates

| Gate | Result |
| --- | --- |
| Vitest | **307/307 tests passing, 47/47 files passing** |
| TypeScript | **PASS**, `tsc --noEmit` |
| ESLint | **PASS**, `eslint .` |
| Next.js production build | **PASS**, 22 static pages generated |
| Full npm audit | **4 moderate, 0 high, 0 critical**; development `drizzle-kit`/`esbuild` chain |
| Production npm audit | **0 vulnerabilities**, `npm audit --omit=dev` |
| E2E | No E2E suite configured |
| Docker | Daemon unavailable; no container build or smoke test |

No dependency version changed in this audit. The final gate details are also recorded in [implementation-status.md](./implementation-status.md).

Docker daemon access failed locally, so there was no container build or smoke test. No E2E suite exists. Browser responsive, keyboard, and screen-reader checks were not completed in this environment; TypeScript and component tests cannot establish WCAG conformance. A live Gemini contract/evaluation run was not performed. The production Next build tests compilation and route generation, not external deployment.

## 7. Remaining limitations and submission readiness

- The app is suitable for a controlled shared workspace, with HTTPS and protected persistent `data`, `uploads`, and backups. Public multi-user deployment requires accounts, per-user authorization, and a new review.
- The four moderate development dependency advisories remain. Runtime audit is clean, but the installed development toolchain should stay local and updated when a compatible Drizzle release removes the chain.
- PDF limits bound input size, pages, and text; there is no OCR for scanned PDFs or strict parser CPU deadline. Very large or adversarial PDFs need operational limits and monitoring.
- AI citation validation proves excerpt location, not legal soundness. Some model outputs have partial runtime validation; human review remains necessary for decisions.
- Cached matter outputs may require explicit regeneration after source changes. Browser freshness, assistive technology behavior, Docker runtime, restore drills, and live Gemini behavior remain unverified.
- `MatterService` and `MatterWorkspace` are large modules. Splitting them safely would require a separate scoped refactor and browser regression work; this audit did not rewrite them.

The verified result is a passing local code/test/build pipeline, improved isolation and data integrity, fewer redundant operations, and clearer evidence status. It is ready for a second **code submission** with the above deployment and live-use limits stated plainly. No evaluator score is predicted.
