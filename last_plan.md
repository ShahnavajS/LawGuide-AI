# LawGuide AI — Final Score Recovery Plan

> **Implementation status (2026-09-21):** The prioritized security, efficiency, accessibility, testing, and code-quality work from this plan has been implemented. Current verification evidence and remaining operational limits are recorded in [`docs/final-submission-readiness.md`](./docs/final-submission-readiness.md). Historical measurements below are retained to explain the score change that motivated the plan.

**Date:** 2026-09-19  
**Scope:** Explain the score movement, identify evidence-backed weaknesses in the current repository, and define the safest implementation order for improving Code Quality, Security, Efficiency, and Accessibility while preserving Testing and Problem Statement Alignment.

## 1. Executive conclusion

The new score is not evidence that the previous work was broadly unsuccessful. The category movement is internally consistent with the code history:

- The efficiency work was recognized: **75 → 85**. The repository contains real improvements to query counts, indexes, hidden-tab loading, PDF cleanup, cache bounds, and redundant AI work.
- The last commit then introduced a severe security regression: **`ALLOW_OPEN_ACCESS=true` disables authentication for the whole production application**, including file download, upload, delete, matter, preparation, and Gemini-backed endpoints. That change is only two lines, has no test, and has no deployment documentation. This is the strongest explanation for **Security 90 → 80**.
- The prior audit added useful safety and integrity checks, but the application still concentrates major responsibilities in two very large modules and repeats request handling across 56 route methods. Those observable issues provide a plausible explanation for **Code Quality 95 → 90**.
- Accessibility has browser-level defects in the matter workspace: incomplete tab semantics and keyboard behavior, hand-built modal overlays, clickable non-interactive cards, and missing focus management. There is no browser accessibility suite. These are credible reasons for **Accessibility 100 → 95**, although no recent commit proves a single direct cause.
- Testing and problem alignment remained **100**, which should be protected. The next pass should add evidence for currently untested risks instead of increasing test count for its own sake.

The evaluator supplied scores without comments or a published weighting formula. Therefore, the causal conclusions below are ranked by confidence; they are not presented as facts about the evaluator's hidden implementation. No repository change can guarantee an external 100/100 score.

## 2. Score comparison

| Category | Previous | Current | Change | Evidence-based interpretation |
| --- | ---: | ---: | ---: | --- |
| Code Quality | 95 | 90 | -5 | Remaining monoliths, repeated route plumbing, partial runtime validation, swallowed client errors, and a large audit delta likely weakened maintainability signals. |
| Security | 90 | 80 | -10 | The final commit added a global production authentication bypass. Proxy remains the sole access-control boundary. |
| Efficiency | 75 | 85 | +10 | Query, request, cache, PDF resource, index, and AI-call reductions were real and retained. |
| Testing | 100 | 100 | 0 | 307 tests still pass. Current tests are strong for services and regressions but do not include browser E2E or accessibility tests. |
| Accessibility | 100 | 95 | -5 | Observable ARIA, keyboard, modal, and focus gaps remain in the largest workspace. Attribution to a particular commit is uncertain. |
| Problem Statement Alignment | 100 | 100 | 0 | Understand → Compare → Prepare and the legal-information boundary remain clear. |
| Overall | 93.75 | 92.25 | -1.50 | The evaluator does not appear to use a simple arithmetic mean; do not reverse-engineer or game its weighting. |

### Confidence of the diagnosis

| Conclusion | Confidence | Reason |
| --- | --- | --- |
| Global open access caused a material security penalty | High | Direct two-line diff at `3e22635`; it overrides the preceding fail-closed production behavior. |
| Prior changes caused the efficiency increase | High | The code and audit record show concrete reductions in calls, queries, scans, and retained resources. |
| Large modules and duplicated boundaries contributed to the code-quality reduction | Medium | The defects are real, but the evaluator gave no textual feedback. |
| Matter workspace accessibility gaps contributed to the five-point drop | Medium | The gaps are directly observable; the exact evaluator checks are unknown. |
| Raw line growth alone caused the quality drop | Low | 5,255 of the 6,344 added lines in the audit commit are generated Drizzle snapshots and should not be treated as handwritten complexity. |

## 3. Repository baseline verified for this plan

The following checks were run against commit `3e22635` while preparing this plan:

| Gate | Current result |
| --- | --- |
| Vitest | **307/307 tests passed; 47/47 files passed** |
| TypeScript | **PASS** — `tsc --noEmit` |
| ESLint | **PASS** — `eslint` |
| Next.js production build | **PASS** — Next.js 16.3.5; 22 static pages generated |
| Production dependency audit | **0 reported vulnerabilities** — `npm audit --omit=dev` |
| Full dependency audit | **4 moderate** development-only findings through `drizzle-kit@0.31.10 → @esbuild-kit → esbuild@0.18.20`; 0 high and 0 critical |
| Browser E2E | Not configured |
| Automated browser accessibility | Not configured |
| Live Gemini contract evaluation | Not configured |
| Docker smoke test | Previously unavailable; not re-run for this planning pass |

Relevant repository measurements:

- `src` contains approximately **30,476 lines across 155 TypeScript, TSX, and CSS files**.
- `src/lib/matter/service.ts` is **3,515 lines**.
- `src/components/matter/MatterWorkspace.tsx` is **3,068 lines**.
- `src/components/matter/MatterWorkspace.module.css` is **1,602 lines**.
- `src/components/preparation/PreparationWorkspace.tsx` is **1,115 lines**.
- The App Router exposes **56 route-handler methods**.
- No `server-only` boundary is currently declared in `src`.
- No `.github` CI workflow is present.
- `ALLOW_OPEN_ACCESS` appears only in two implementation lines. It is absent from tests and deployment documentation.

## 4. What changed between submissions

The audit commit `111cdfa` changed 52 files with 6,344 insertions and 481 deletions. It did several valuable things:

- closed cross-matter reference paths;
- made replacement writes transactional;
- reduced Source Map requests and scans;
- removed one unvalidated Gemini call from matter-brief generation;
- added PDF resource cleanup and a bounded viewer cache;
- improved evidence reconciliation;
- added migrations and regression tests.

The change was also broad. It touched the largest service and component, several routes, AI prompts, database schema, deployment files, and 14 test areas at once. Generated migration metadata accounts for most added lines, but the handwritten changes still increased the review surface.

Eleven minutes later, commit `3e22635` changed two conditions:

```text
production credentials required
→ production credentials required unless ALLOW_OPEN_ACCESS=true

authentication required in production
→ authentication required unless ALLOW_OPEN_ACCESS=true
```

Because `src/proxy.ts` returns immediately when authentication is not required, that flag bypasses authentication, mutation-origin checks, and standard API rate limiting. Heavy endpoint rate limiting then falls back to the shared `local-user` identity. The public demo page is already static, so exposing every workspace and API route was unnecessary.

## 5. Current strengths to preserve

The next implementation must keep these behaviors intact:

1. **Legal scope:** understand documents, compare terms, prepare users for counsel, and provide general legal information without personalized legal advice.
2. **Evidence boundaries:** document facts, AI interpretations, needs-review items, general information, and user-provided information remain visibly distinct.
3. **Private storage:** PDFs remain outside `public`; file paths are generated and validated.
4. **Upload protections:** size, MIME type, extension, PDF signature, page count, and extracted-text limits remain enforced.
5. **Matter isolation:** foreign document, relationship, comparison, action, and preparation references remain rejected.
6. **Transactional replacement:** failed page or brief replacement preserves the prior record.
7. **Current efficiency wins:** grouped matter counts, bounded filesystem concurrency, targeted indexes, one Source Map request, PDF cleanup, viewer cache cap, and constant-work health query.
8. **Current quality gates:** all 307 tests, TypeScript, ESLint, and production build remain green after every implementation slice.

## 6. Root-cause analysis and required fixes

### 6.1 Security — highest priority

#### S1. Global production authentication bypass — critical

**Observed:** `ALLOW_OPEN_ACCESS=true` makes `auth.required` false. `proxy.ts` then allows every page and API request before performing session checks, CSRF checks, or standard rate limiting.

**Impact:** Anyone who can reach the deployment can list, upload, read, download, analyze, compare, mutate, and delete legal documents and can consume the Gemini budget.

**Fix:** Remove the global bypass. Use an explicit public allowlist:

- public pages: `/`, `/demo`, `/login`;
- public APIs: `/api/health`, `/api/auth/login`;
- framework and static assets: exact required `_next`, favicon, PDF worker, and declared image paths;
- every other page and API: authenticated.

The current demo is static and should remain database-free, file-free, and provider-free. If a fully interactive public demo is later required, build it as a separate immutable fixture-backed namespace with no access to private storage, the workspace database, mutations, or Gemini. Do not reopen the production workspace.

**Acceptance evidence:**

- production refuses to start or reports unhealthy when credentials are missing or weak;
- `/` and `/demo` work without a cookie;
- every protected API returns 401 without a valid session, including direct route-handler invocation that bypasses Proxy;
- no environment flag can make private APIs public;
- file download, delete, upload, analyze, compare, matter, and preparation routes are in the unauthorized route matrix.

#### S2. Proxy is the only authorization boundary — high

**Observed:** Route handlers and services assume Proxy already authenticated the request. Next.js documents Proxy as an optimistic filter and recommends secure checks close to the data source.

**Impact:** A matcher regression, route exception, direct handler test, or future internal call can bypass the only gate.

**Fix:** Add a server-only request boundary, for example:

```text
Proxy
  → quick signature/expiry check and redirect
Route handler wrapper
  → required authenticated session, CSRF, rate tier, request ID
Service/repository
  → resource membership and data invariants
```

Create one small `withApiSecurity` or `requireWorkspaceRequest` helper and apply it to every protected route. Keep resource-level membership checks in services. Mark database, environment, auth, provider, storage, and service entry modules with `import 'server-only'` where valid.

**Acceptance evidence:** an automated inventory test enumerates route files and verifies that only health and login are public; integration tests call representative route handlers without running Proxy and still receive 401/403.

#### S3. Sessions are deterministic and not revocable — high

**Observed:** a session is `v1.expiry.HMAC(expiry + password digest)`. Two successful logins in the same second receive the same token. Logout only deletes the browser cookie. The same token also becomes the rate-limit identity for all users who logged in during that second.

**Fix:** Introduce a versioned random session identifier generated from at least 128 bits of cryptographic randomness. Store only its hash, creation time, last-seen time, and expiry in SQLite. Sign the browser token. Rotate the ID at login, revoke it at logout, reject expired or revoked records at the route boundary, and prune expired records during login/startup rather than on every request. Keep the shared-password product model; do not add a full identity provider solely for the challenge.

**Acceptance evidence:** concurrent logins receive distinct tokens; logout invalidates the server-side session; expired and altered tokens fail; session values never appear in logs; standard and heavy rate limits are isolated per session.

#### S4. Mutation request-origin protection accepts missing `Origin` — high

**Observed:** unsafe API methods are checked only when `Origin` exists. `SameSite=Strict` is useful defense in depth but OWASP does not treat it as a complete CSRF defense.

**Fix:** Centralize mutation protection in the route wrapper:

1. reject `Sec-Fetch-Site: cross-site`;
2. compare `Origin`, then `Referer` fallback, against a configured canonical `APP_ORIGIN`;
3. require a session-bound CSRF token or custom header for browser JSON mutations;
4. use a shared client `apiFetch` helper so individual components cannot forget the header;
5. keep login and logout form handling deliberately covered.

Do not trust a caller-controlled `Host` or forwarding header unless deployment documentation explicitly defines a trusted reverse proxy that overwrites it.

**Acceptance evidence:** same-origin mutations pass; foreign, missing-source, bad-token, and cross-site requests fail; safe GET/HEAD behavior is unchanged.

#### S5. Production CSP permits inline scripts — medium/high

**Observed:** production uses `script-src 'self' 'unsafe-inline'`; styles also allow all inline styles.

**Fix:** Implement a production nonce CSP using the Next.js 16.3.5 guidance already installed in `node_modules`. Generate a nonce per request, forward it to rendering, and remove `unsafe-inline` from `script-src`. Retain `unsafe-eval` only in development. Move recurring inline style objects into CSS modules; if migration must be staged, separate `style-src-elem` from `style-src-attr` and document the remaining exception. Measure the dynamic-rendering cost caused by nonces before rollout.

**Acceptance evidence:** production response header has no `script-src 'unsafe-inline'`; the production build and browser smoke tests load the app and PDF worker without CSP errors; no external script origin is added.

#### S6. Rate limiting identities and concurrency are incomplete — medium

**Observed:** login throttling is global, standard API throttling uses the session token, and unauthenticated heavy routes can use the shared `local-user` key under open access. The in-memory limiter is per process and does not prevent duplicate concurrent generations.

**Fix:**

- remove unauthenticated heavy workflows with S1;
- use the new random session ID fingerprint as the authenticated key;
- retain a global login ceiling but add a second per-client bucket only when a trusted proxy identity is configured;
- add an in-flight lock keyed by `session + operation + resource` for analysis, comparison, question generation, and brief generation;
- return consistent `Retry-After` and rate-limit metadata;
- clearly document that the in-memory limiter is single-instance protection. Do not add Redis for this project.

#### S7. Structured AI output validation is shallow — high for legal data integrity

**Observed:** Gemini receives a textual schema description and `application/json`, then `parseOrRepairJson` may repair truncated JSON. `assertModelCollections` checks only container shape and some citations. Many stored JSON records are later loaded with unchecked TypeScript casts.

**Fix:** Create strict, bounded runtime schemas for every model result and persisted AI artifact. Pass the corresponding JSON Schema through Gemini's structured-output option where supported, then validate again in application code. Reject unknown fields where practical, enforce enum, string, array, and numeric bounds, reconcile document/page/quote references, and downgrade unsupported claims. A truncated response must be retried or safely rejected; it must not be repaired into apparently complete legal data.

Use one schema source. A small proof of concept may justify adding Zod 4 because the Gemini JavaScript guidance supports Zod/JSON Schema and it would replace substantial hand-written validation. Add it only if the proof reduces code and passes dependency review. Otherwise implement narrow explicit validators around existing domain types.

**Acceptance evidence:** malformed, truncated, oversized, extra-field, invalid-enum, foreign-document, wrong-page, and unsupported-quote fixtures cannot reach persistence; valid fixtures retain all current functionality.

### 6.2 Efficiency — preserve the gain and address the remaining hot paths

#### E1. Opening a tab triggers a write and possible Gemini call — high

**Observed:** selecting the Questions tab automatically POSTs to `/counsel-questions/generate` when local state is empty.

**Impact:** navigation has a hidden cost, may write an activity record, can consume AI quota, and can repeat after remounts or failed responses.

**Fix:** Make tab selection read-only. A GET should return cached/deterministic questions and staleness metadata. Only an explicit **Generate** or **Regenerate** action may call Gemini. Disable the button while one request is active and use an idempotency key or in-flight operation lock.

**Acceptance evidence:** opening the tab causes zero provider calls and zero writes; one explicit click causes at most one provider call.

#### E2. Matter brief generation invokes question generation — high

**Observed:** `generateMatterBrief()` calls `generateCounselQuestions()`. A brief request can therefore perform another independent AI workflow and activity write.

**Fix:** Load an existing current question artifact or use the deterministic question synthesizer for the brief. If the user explicitly wants AI-generated questions, generate them first and pass the result into one brief orchestration context. Never hide a second provider call inside brief assembly.

**Acceptance evidence:** provider-call spies prove the maximum call count for each user action; brief generation does not write a second unrelated activity.

#### E3. Source Map still performs repeated service work and N page queries — high

**Observed:** `getMatterSourceMap()` calls `syncMatterEvidence(false)`, then independently loads consistency, actions, relationships, and notes. It also loads document-page metadata inside a loop, one query per document.

**Fix:** Add a request-scoped `MatterSnapshot` loader that batches the raw data needed by a single operation. Pass that snapshot into evidence, consistency, relationship, question, and coverage calculations. Fetch page metadata for all member documents with one chunked `IN` query and group it in memory.

This is request-scoped deduplication, not a global cache. Legal data must not leak across requests or remain stale after mutations.

**Acceptance evidence:** query-count tests show page query count does not grow linearly with document count; Source Map remains one HTTP request; all evidence counts match the current fixtures.

#### E4. Evidence citation checks query pages one at a time — high

**Observed:** `syncMatterEvidence()` caches a page after the first lookup, but the first lookup still performs one SQL query for each unique cited page.

**Fix:** Collect the cited `(documentId, pageNumber)` keys first, load required pages in bounded batches, and validate against an in-memory map. Reuse the same page map when Source Map or page evidence is built in the same request.

**Acceptance evidence:** 1, 10, and 100 citations produce a bounded number of queries; wrong-page and normalized-match behavior remains identical.

#### E5. Tab fetches refire, race, and silently fail — medium

**Observed:** revisiting tabs refetches data; most fetches lack `AbortController`; eight paths swallow errors with `.catch(() => {})`.

**Fix:** Extract a small `useMatterResource` helper with `idle/loading/success/error`, abort on dependency change/unmount, and retain loaded data until a relevant mutation invalidates it. Surface a compact retry state. Keep the cache inside the workspace component unless measurement demonstrates a need for a library.

**Acceptance evidence:** rapid tab switching cannot apply stale results; revisiting an unchanged tab does not issue another request; failed requests are announced and retryable.

#### E6. Large collections have no consistent pagination — medium

**Observed:** documents, matters, notes, actions, relationships, and some evidence responses can grow without a uniform cursor/limit contract.

**Fix:** Add bounded `limit` plus stable cursor pagination to collections that can realistically grow. Preserve separate totals only where the UI needs them. Do not paginate small bounded taxonomies or single-resource payloads.

**Acceptance evidence:** contract tests cover default, max, invalid cursor, deterministic ordering, and no duplicate/missing records across pages.

#### E7. Performance claims need end-to-end measurements — high

Before further optimization, add a reproducible, non-production benchmark fixture with 1/10/100 documents and representative page counts. Record:

- requests per user journey;
- SQL statements per service operation;
- provider calls and retries per action;
- route duration and response bytes;
- browser JavaScript bundle size;
- heap behavior when opening more than three PDFs;
- Lighthouse and Core Web Vitals in a production build.

Use medians and p95 over documented runs. Label results as microbenchmark, integration benchmark, or browser benchmark. Do not claim production improvement from a local microbenchmark.

#### E8. SQLite planner maintenance — low/medium

After the query plan work is measured, run `PRAGMA optimize=0x10002` when the long-lived connection opens and `PRAGMA optimize` after migrations or on a conservative schedule. Verify relevant queries with `EXPLAIN QUERY PLAN`. Do not add indexes without demonstrating a scan or sort they remove; indexes increase write and storage cost.

### 6.3 Code Quality — reduce coupling without a rewrite

#### Q1. Split `MatterService` by capability behind a stable facade

`MatterService` mixes CRUD, SQL assembly, evidence extraction, consistency, search, AI generation, readiness, activity, and brief creation.

Refactor in this order:

1. extract pure parsers, normalizers, and evidence grouping functions;
2. extract a `MatterRepository` for batched raw reads and transactions;
3. extract `MatterEvidenceService` for validation and Source Map assembly;
4. extract `MatterCounselService` for questions, actions, readiness, and brief assembly;
5. keep `MatterService` as a thin compatibility facade until routes and tests migrate.

Each extraction must be behavior-preserving and land with characterization tests. Do not split files merely to meet a line target, and do not replace SQLite or Drizzle.

#### Q2. Split `MatterWorkspace` by user-visible tab

Move tab panels into focused components with typed props and hooks:

- overview/documents;
- timeline;
- relationships/consistency;
- Source Map/evidence;
- notes/search;
- action plan/questions;
- prepare/brief;
- document viewer drawer.

Keep orchestration, invalidation, and selected-tab state at the workspace level. Co-locate each panel's CSS where practical. This makes browser tests and accessibility fixes reviewable.

#### Q3. Centralize route plumbing and validation

The route tree repeats JSON parsing, error mapping, response formatting, auth assumptions, and body casts.

Create small helpers for:

- authenticated route execution;
- bounded JSON/form body reading;
- runtime input validation;
- normalized success/error envelopes;
- request IDs and redacted structured logging;
- rate tier and CSRF enforcement.

Avoid a framework inside the framework. The helper should be small enough to read in one screen and should preserve normal Next.js `Request`/`Response` types.

#### Q4. Define error policy instead of swallowing failures

For every `catch`, select one explicit policy:

- recover with a documented deterministic fallback;
- surface a user-facing retry state;
- translate to a safe API error;
- log a redacted operational event;
- rethrow to a route or error boundary.

Replace `alert`/`confirm` in core workspace flows with the existing accessible UI patterns and an `aria-live` status region. Add `app/global-error.tsx` and route-level error UI if absent.

#### Q5. Make server/client boundaries explicit

Add `server-only` imports to configuration, DB, repositories, storage, auth, and Gemini modules. Review every `'use client'` boundary and keep browser bundles limited to interactive UI. Never pass full database or provider objects to client components.

#### Q6. Consolidate configuration and limits

Move duplicated limits and timeouts into named, scoped constants: upload bytes, PDF pages/text, JSON body sizes, AI timeouts/tokens, pagination maxima, and cache capacity. Keep security limits on the server. Document why each exists.

#### Q7. Treat generated migrations correctly

Retain Drizzle snapshots required by the migration chain. Exclude generated snapshots and the PDF worker from handwritten complexity metrics and code-review noise, but continue validating migration order and schema equivalence. Do not delete generated metadata merely to reduce line count.

### 6.4 Accessibility — restore and prove the missing five points

#### A1. Implement the complete tabs pattern

The matter workspace has a `tablist` and `tab` roles but lacks associated IDs, `aria-controls`, `tabpanel`, roving `tabIndex`, and Left/Right/Home/End behavior.

Implement the WAI-ARIA tabs pattern:

- one active tab in the normal tab order;
- arrow keys move focus within the tab list;
- Enter/Space activates when loading is not instant;
- every tab points to its panel;
- every panel points back to its tab;
- focus does not trigger expensive generation.

Because some panels fetch data, manual activation is safer than automatic activation.

#### A2. Replace hand-built overlays with the existing native `Modal`

The Add Document and Add Action overlays are plain `div` structures. Migrate them to the existing native `<dialog>` component, add associated labels and descriptions, ensure Escape closes, focus starts in a useful place, focus remains inside, and focus returns to the trigger. Use `htmlFor` and stable control IDs for every visible label.

#### A3. Fix clickable non-interactive elements

Source Map document cards use `div onClick` without keyboard semantics. Render them as buttons or links. Audit the whole UI for click handlers on `div`/`span`, nested interactive elements, and icon-only buttons without names.

#### A4. Define the document viewer drawer's interaction model

Choose one semantic behavior:

- a nonmodal complementary region that does not obscure or disable the page; or
- a modal drawer with dialog semantics, focus containment, Escape, inert background, and focus restoration.

Do not mix the two. Announce loading, page count, errors, and page changes without moving focus unexpectedly.

#### A5. Make status and progress programmatic

Give readiness/coverage bars accessible values and labels. Use `role=status`/`aria-live` for uploads, analysis, generation, saved states, and errors. Do not communicate verified/needs-review state through color alone.

#### A6. Test reflow, focus, contrast, and target size

Audit at 200% and 400% zoom and at 320 CSS pixels. Increase very small critical legal text where it harms readability. Verify visible focus contrast, text contrast, touch target spacing, sticky controls, and horizontal overflow. A small font is not automatically a WCAG failure; record actual contrast and reflow evidence.

#### A7. Add browser accessibility evidence

Add a focused Playwright suite with `@axe-core/playwright` for landing, login, dashboard, analyze, compare, matter, prepare, and legal information at representative desktop and mobile widths. Include keyboard assertions for tabs, dialogs, viewer controls, menus, and destructive actions.

Automated checks do not prove conformance. Complete and record a manual keyboard pass plus NVDA on Windows or VoiceOver on macOS for the main Understand → Compare → Prepare path.

### 6.5 Testing — protect the 100 with better layers

Keep the current unit and integration suite. Add only tests that close identified risks:

1. **Security route matrix:** unauthenticated/authenticated/malformed-session checks for all protected route groups.
2. **Session lifecycle:** uniqueness, rotation, expiry, revocation, cookie attributes, and redacted logs.
3. **CSRF/fetch metadata:** same-origin success and foreign/missing-source failure.
4. **Open-demo isolation:** public demo cannot read or mutate workspace state and performs no provider calls.
5. **Query budgets:** Source Map, evidence validation, matter list, readiness, and search at several dataset sizes.
6. **Provider-call budgets:** navigation versus explicit generate/regenerate behavior.
7. **Browser E2E:** upload a fixture, view, analyze with deterministic provider stub, compare, add to matter, prepare brief, and log out.
8. **Browser accessibility:** axe plus deterministic keyboard/focus assertions.
9. **AI contract fixtures:** strict schema, citation reconciliation, prompt injection, abstention, unsupported legal advice, unknown jurisdiction, and malformed output.
10. **Deployment smoke:** production build/start, health, public demo, protected API, login, logout, persistent data path, and PDF worker.

Do not put live Gemini calls in the normal deterministic CI job. Provide an opt-in `eval:gemini` command that records model/version, prompt version, fixture ID, latency, token usage when available, schema pass rate, citation page-match rate, unsupported-claim rate, abstention rate, and prohibited-advice failures. Set acceptance thresholds before running it.

### 6.6 Problem alignment — keep the 100

Do not add unrelated chat, drafting, litigation prediction, legal strategy, or autonomous action features. Every change must support one of:

- **Understand:** explain and trace document language;
- **Compare:** show what differs with dual evidence;
- **Prepare:** organize facts, gaps, documents, and neutral questions for a legal professional.

The public demo must continue to state that it uses fictional data. User-facing copy must keep the distinction between source verification and legal correctness. AI output must not decide enforceability, controlling documents, legal rights, likely outcomes, or recommended legal strategy.

## 7. Ordered implementation plan

The sequence matters. Security recovery must land before performance or refactoring work.

### Phase 0 — Capture baseline and prevent accidental regression

**Changes**

- Preserve the evaluator screenshot and the two score tables in project documentation.
- Add `npm run verify` for type-check, lint, unit/integration tests, and build.
- Add a Node 22 CI workflow using `npm ci`; keep production audit as a gate for high/critical runtime findings.
- Record the four development-only advisories accurately. Do not apply npm's suggested incompatible Drizzle downgrade merely to obtain a green full audit.

**Exit gate**

- Current 307 tests, TypeScript, lint, and build pass in CI.
- No application behavior changes in this phase.

### Phase 1 — Close the security regression

**Changes**

1. Remove `ALLOW_OPEN_ACCESS` from configuration and auth logic.
2. Add an explicit public route allowlist for landing, static demo, login, health, and assets.
3. Add route-level authenticated session enforcement to every protected API.
4. Introduce random, hashed, revocable sessions and update rate-limit identity.
5. Centralize CSRF/fetch-metadata checks.
6. Add `server-only` boundaries.
7. Add the complete unauthorized route matrix and session/CSRF tests.
8. Update README, `.env.example`, deployment guide, and threat model.

**Exit gate**

- No private file, metadata, AI, or mutation route is reachable without a current session.
- Demo remains publicly reviewable and isolated.
- All prior gates pass.

### Phase 2 — Restore browser accessibility and simplify the largest component

**Changes**

1. Add Playwright and axe smoke infrastructure.
2. Implement accessible matter tabs.
3. Replace custom add overlays with native `Modal`.
4. Correct Source Map cards, viewer drawer, labels, status regions, and readiness progress semantics.
5. Extract matter tab panels one at a time while preserving behavior.

**Exit gate**

- Zero serious/critical axe findings on the main flows.
- Keyboard tab/dialog/drawer tests pass.
- Manual keyboard and screen-reader checklist is recorded with exact environment.
- Unit, type, lint, build, and alignment copy checks remain green.

### Phase 3 — Remove hidden AI work and duplicate reads

**Changes**

1. Make the Questions tab read-only until explicit generation.
2. Remove nested question generation from brief generation.
3. Add operation-level provider-call counters in tests.
4. Add `MatterSnapshot` batched reads.
5. Batch document pages and cited-page validation.
6. Add tab request cancellation, loaded state, error UI, and targeted invalidation.
7. Add pagination where measured payload growth justifies it.

**Exit gate**

- Provider-call and SQL-query budgets pass.
- Source Map results and evidence verification remain byte-for-byte or semantically equivalent on fixtures.
- No tab navigation performs a mutation or model call.

### Phase 4 — Strengthen AI contracts and persistence integrity

**Changes**

1. Define bounded runtime schemas for every structured Gemini response.
2. Use Gemini structured outputs from the same schema source.
3. Remove permissive truncated-JSON repair from persisted structured flows.
4. Validate stored artifact JSON on read and supply safe migration/fallback behavior.
5. Add an input fingerprint or evidence revision to cached briefs/questions; show stale state after relevant source changes.
6. Build the opt-in legal AI golden evaluation corpus.

**Exit gate**

- Invalid model data never reaches SQLite.
- Unsupported citations are rejected or marked `NEEDS_REVIEW`.
- Cached outputs cannot appear current after their evidence changes.
- Offline deterministic behavior still works without `GEMINI_API_KEY`.

### Phase 5 — Complete focused code-quality refactoring

**Changes**

1. Extract repository, evidence, and counsel capabilities behind the existing matter facade.
2. Centralize API body validation, security, errors, and logging.
3. Remove obsolete code, stale phase comments, duplicated types, and magic limits exposed by the extraction.
4. Add global error UI and replace silent catches/alerts in core flows.
5. Run dependency and bundle analysis; remove only proven unused dependencies/code.

**Exit gate**

- New modules each have one business responsibility and no circular imports.
- Routes contain transport logic, services contain business rules, repositories contain persistence, and components contain presentation/interactions.
- Generated files are excluded from maintainability metrics but migration tests pass.

### Phase 6 — Production-like evidence and final submission report

**Changes**

- Run the production server and Playwright suite.
- Run Lighthouse in an incognito production session and record environment/results.
- Measure browser request count, bundles, query budgets, response sizes, and PDF heap behavior.
- Run the Docker build/smoke and backup/restore drill when Docker is available.
- Run `npm audit` and `npm audit --omit=dev`; document both.
- Run the optional Gemini evaluation only with a dedicated key and non-sensitive fixtures.
- Review the diff for legal scope, evidence labeling, accessibility, and security regressions.

**Exit gate**

- A final report lists exact commands, results, measurements, unresolved limits, and links to evidence.
- The report does not assign a self-score or claim guaranteed evaluator results.

## 8. Required acceptance matrix

| Area | Required evidence before resubmission |
| --- | --- |
| Code Quality | TypeScript and ESLint pass; route wrapper removes repeated boundary code; large modules are reduced through tested capability extraction; no new `any` or unchecked model casts at boundaries. |
| Security | Global bypass removed; fail-closed production config; route-level auth; revocable random sessions; CSRF tests; strict script CSP; runtime audit clean; ASVS-derived checklist completed. |
| Efficiency | Recorded before/after request, query, provider-call, payload, bundle, and memory evidence; no hidden generation; page/evidence N+1 paths removed. |
| Testing | Existing 307 tests retained; security, performance-budget, browser E2E, and accessibility tests added for real risks; all deterministic gates green. |
| Accessibility | APG-compliant tabs/dialogs; keyboard and focus tests; zero serious/critical axe findings; manual AT evidence; zoom/reflow and contrast recorded. |
| Alignment | Understand → Compare → Prepare path unchanged; disclaimers and classifications present; no adjudication or personalized legal strategy. |
| AI safety | Strict schemas; evidence reconciliation; safe rejection; prompt-injection corpus; stale-artifact marking; opt-in golden evaluation. |

## 9. Implementation risk controls

1. **Small reviewable slices:** one security boundary, tab, service capability, or query path per change.
2. **Characterize before extracting:** add a test for observable behavior before moving complex logic.
3. **Measure before optimizing:** no new cache, index, or dependency without a demonstrated cost.
4. **No broad rewrite:** retain Next.js, SQLite, Drizzle, filesystem storage, PDF.js, and the existing domain model.
5. **No sensitive cache:** do not use public/CDN caching for authenticated legal data; retain `private, no-store` on APIs.
6. **No fake public mode:** public evaluation uses the static fictional demo or supplied credentials, never an unprotected real workspace.
7. **No weakened evidence standard:** a higher citation percentage must not be achieved by accepting partial or fabricated matches.
8. **No score-gaming tests:** tests must execute application behavior, not re-declare constants and assert against the copied values.
9. **No forced dependency downgrade:** the current full-audit warning is development-only; resolve it through a compatible upstream release or a proven safe override, not npm's suggested incompatible `drizzle-kit@0.18.1` downgrade.
10. **Rollback points:** keep migrations additive and reversible where feasible; back up the SQLite database and uploads together before migration testing on real data.

## 10. Likely files and modules affected

| Workstream | Primary locations |
| --- | --- |
| Public/private boundary | `src/proxy.ts`, `src/lib/config/env.ts`, `src/lib/security/workspace-auth.ts`, `.env.example`, deployment docs |
| Route security | `src/app/api/**/route.ts`, new small helper under `src/lib/security` or `src/lib/api` |
| Session storage | `src/lib/db/schema.ts`, additive Drizzle migration, auth login/logout, session tests |
| CSP | `src/proxy.ts`, `src/app/layout.tsx`, `next.config.ts`, CSS modules |
| Rate limits | `src/lib/security/rate-limiter.ts`, heavy API routes, auth tests |
| Runtime AI schemas | `src/lib/ai/gemini.ts`, `src/lib/ai/schemas.ts`, `src/lib/ai/validate-output.ts`, domain services |
| Matter query efficiency | `src/lib/matter/service.ts`, new repository/snapshot module, matter tests |
| Matter UI/accessibility | `src/components/matter/MatterWorkspace.tsx`, module CSS, existing `Modal`, new focused tab panels/hooks |
| Browser tests | `playwright.config.ts`, `tests/e2e`, deterministic fixture/provider setup |
| CI and verification | `package.json`, lockfile, `.github/workflows/verify.yml`, final audit report |

## 11. Research basis

The plan uses current primary guidance:

- [Next.js 16 Authentication](https://nextjs.org/docs/app/guides/authentication) — Proxy is an optimistic filter; secure authorization should be close to the data source in a server-only data-access layer.
- [Next.js Data Security](https://nextjs.org/docs/app/guides/data-security) — server-only modules, minimal data transfer, and authorization at data boundaries.
- [Next.js Production Checklist](https://nextjs.org/docs/app/guides/production-checklist) — route/action authorization, global error UI, production build checks, Lighthouse, Core Web Vitals, and bundle analysis.
- [Next.js Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy) — nonce-based strict CSP and its dynamic-rendering tradeoff.
- [Next.js Playwright Guide](https://nextjs.org/docs/app/guides/testing/playwright) — end-to-end testing against a production-like application.
- [OWASP ASVS 5.0](https://owasp.org/projects/asvs) — a verification framework for authentication, access control, API, file, and frontend controls.
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) — cryptographically random session identifiers, cookie protections, expiration, and invalidation.
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) — CSRF tokens, origin/fetch-metadata validation, and SameSite as defense in depth.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — keyboard operation, focus, contrast, target size, reflow, labels, and status requirements.
- [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — tab/panel associations and keyboard behavior.
- [WAI-ARIA Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — initial focus, contained tab sequence, Escape, labeling, inert background, and focus return.
- [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output) — schema-constrained JSON plus mandatory application-level value validation.
- [Gemini Safety and Factuality Guidance](https://ai.google.dev/gemini-api/docs/safety-guidance) — post-processing, defined safety metrics, manual evaluation, adversarial testing, and per-user abuse limits.
- [SQLite PRAGMA documentation](https://sqlite.org/pragma.html#pragma_optimize) — `PRAGMA optimize` guidance for long-lived connections and after schema changes.
- [SQLite EXPLAIN QUERY PLAN](https://sqlite.org/eqp.html) — evidence for scans, index searches, and query-plan improvements.

## 12. Resubmission decision rule

Resubmit only when all P0/P1 security and accessibility gates pass, the performance improvements have recorded before/after evidence, and all existing 100-point areas remain green. A larger diff or a larger test count is not the goal. The submission should show that the private legal workspace is fail-closed, the public demo is isolated, expensive work happens only after explicit user action, legal AI output is schema- and evidence-validated, and the main journey is demonstrably usable with keyboard and assistive technology.
