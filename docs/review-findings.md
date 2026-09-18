# LexiGuide AI: end-to-end review

> Audit snapshot from 2026-09-17. Implemented changes and current limitations are in [implementation-status.md](./implementation-status.md).

Reviewed 2026-09-17 against the PromptWars legal-information challenge. This is a code and documentation review, not a live legal-accuracy certification. The independent product baseline is in [independent-research.md](./independent-research.md).

## Executive assessment

**Challenge fit:** strong breadth. The project supports PDF intake, plain-language analysis, clause and obligation extraction, comparison, legal concept browsing, multi-document matters, and consultation preparation. It visibly says that it does not replace legal advice. The main gap is **trustworthiness of evidence and the privacy boundary**: some outputs are labeled verified when only a quotation was located, or when no check occurred. The deployment model is safe only if access to the entire application is limited to one trusted user or group. Any visitor who can reach it can access the shared legal workspace.

## System traced end to end during the 2026-09-17 audit

The table below records the pre-remediation behavior. It is retained as an audit trail; see [implementation-status.md](./implementation-status.md) for the current behavior.

| Stage | Current path | Behavior |
| --- | --- | --- |
| Intake | DocumentUpload → POST /api/documents/upload → DocumentService | Accepts PDF only, checks extension/MIME/size/header after request parsing, writes uploads/<generated-id>/document.pdf, records metadata in SQLite. |
| Processing | POST /api/documents/[docId]/process → PdfDocumentProcessor | Extracts page text with pdfjs, stores pages, optionally uploads the **entire original PDF** to Gemini Files API, marks document ready. Empty/scanned pages get no OCR. |
| Understand | POST /api/documents/[docId]/analyze → AnalysisService | Sends all extracted pages to Gemini, or creates a deterministic template analysis offline. Checks whether model quotes occur on the cited page, stores JSON and citations. |
| Compare | POST /api/comparisons → ComparisonService | Sends both full extracted documents to Gemini; on failure uses clause alignment fallback. Checks supplied base and target quotations. |
| Legal concepts | /legal-info → LegalInformationService | Uses a static taxonomy and source **homepages**. Gemini can generate a concept answer from source titles/URLs and document quotes; actual statutory text is not retrieved. |
| Matters | /matters/[matterId] → MatterService | Organizes documents, derives relationships/consistency/timeline, offers search, Q&A, action items, source map, questions, and brief. |
| Prepare | /prepare → PreparationService | Builds a consultation brief and checklist from analysis/comparison or matter data. |
| Persistence | SQLite + local filesystem | Single shared database and storage root; no user identity or ownership fields. |
| Deployment | Next.js, Dockerfile, Compose | Dockerfile listens on 8080; Compose publishes and checks container port 3000. |

## Challenge alignment

| Direction | Assessment |
| --- | --- |
| Simplify documents | Implemented, but unsupported facts can appear in summaries and fallback prose. |
| Compare versions | Implemented, but required evidence is optional at runtime. |
| Highlight duties and risks | Implemented; heuristics can mistake unrelated terms for conflicts. |
| Answer from supplied documents | Partial: matter Q&A exists; direct single-document Q&A described in README is absent. Model matter citations are not server-verified. |
| Next steps and professional preparation | Implemented as neutral questions, action items, and briefs; some fallback text assumes provisions exist. |
| Information rather than advice | Prompts and disclaimers exist. A small prohibited-phrase regex is applied only in selected paths, not all generated fields. |

## Judge rubric assessment

| Criterion | What is working | What prevents a strong score |
| --- | --- | --- |
| Code quality | Typed modules, a database schema, route/service boundaries, and a passing lint/type check. | MatterService and MatterWorkspace are very large; business rules, AI, persistence, and source-map assembly are mixed; documentation contradicts code. |
| Security | PDFs use generated storage paths and basic file checks; server credentials stay off the client; errors are usually sanitized. | No access control for reachable visitors, unnecessary provider upload, spoofable rate-limit identity, unbounded parsing/model input, and missing checks on several expensive routes. |
| Efficiency | SQLite and deterministic fallbacks make a small local demo inexpensive. | GET routes can call Gemini and rewrite evidence; entire documents are repeatedly sent to the model; analysis/retrieval lack input and cost budgets. |
| Testing | 278 tests passed at audit time, plus TypeScript and lint. | Tests used the app database, focused on offline behavior, and omitted real-user authorization, live-model contract validation, browser accessibility, and graded legal-answer accuracy. |
| Accessibility | Semantic headings, labels, keyboard upload, focus CSS, reduced-motion styles, and some live regions are present. | Modal focus is incomplete, nested controls are invalid, and WCAG conformance has not been verified with users or tools. |

## Findings by priority

### P0 — reachable visitors can access every legal document

The schema has no user/owner fields (src/lib/db/schema.ts). GET /api/documents, GET /api/documents/[docId]/file, and DELETE /api/documents/[docId] have no identity or ownership checks. Matter IDs establish membership inside a matter, not ownership by a person. The “multi-tenant security” test checks whether a document belongs to a matter, not whether one user can access another user's matter. **Impact:** anyone with network access to the app can list, download, analyze, and delete documents and notes. This is acceptable only for a strictly private single-user install with network controls. Before any public deployment, add authenticated users and owner-scoped queries on every route, or gate the whole app behind reliable access control. Test with two users and direct ID requests.

### P0 — privacy statement conflicts with provider flow

DocumentService.processDocument uploads the complete PDF to Gemini Files API when a key exists (src/lib/document/service.ts:291-313), but geminiFileUri is never used elsewhere outside that service/schema. Deleting the document (src/lib/document/service.ts:165-189) only deletes local file/DB state; it does not request provider file deletion. The demo says the document is “never used to train AI models” (src/app/demo/page.tsx:20), which the app cannot guarantee for every Gemini account/billing mode. Google's [current API terms](https://ai.google.dev/gemini-api/terms) distinguish paid and unpaid data use, and [Files API guidance](https://ai.google.dev/gemini-api/docs/files) describes automatic and manual deletion. **Action:** remove the unused original-file upload; explain that extracted text is sent for analysis; disclose provider/account handling; replace the absolute training claim. If file uploads are later needed, retain the provider file name and delete it when the user deletes the document.

### P1 — quotation matching does not establish answer truth

CitationValidator checks that quotedText appears in a page (src/lib/evidence/validator.ts), but never checks whether a claim follows from that quote. AnalysisService marks findings DOCUMENT_FACT when their quote matches (src/lib/analysis/service.ts:266-421). Its offline fallback can claim termination, confidentiality, mutual duties, and rights when those clauses are absent (src/lib/analysis/service.ts:471-567). ComparisonService validates evidence only when supplied; it does not enforce both sides for MODIFIED or the required side for ADDED/REMOVED (src/lib/comparison/service.ts:317-409). MatterService.queryMatter returns model citations directly (src/lib/matter/service.ts:1487-1521). **Action:** enforce a runtime output schema and evidence requirements by finding type, check passage relevance, and omit or downgrade unsupported claims. Add answerable/unanswerable and mismatched-claim fixtures. Never advertise a quote match as proof that the interpretation is correct.

### P1 — source map can mark unchecked evidence verified

checkConsistency compares earlier AI fields, including the first financial term from each document, rather than matching the same type of term (src/lib/matter/service.ts:962-1204). Its governing-law case writes the model's governing-law string as a quote and assumes page 1 (:1090-1117). syncMatterEvidence labels consistency quotes DOCUMENT_FACT and VERIFIED without calling CitationValidator (:3039-3085). createConsistencySourceReference likewise defaults to verified/high confidence (src/lib/evidence/source-reference.ts:120-147). **Action:** carry validated source references from initial extraction; recheck derived evidence; keep unchecked comparisons in NEEDS_REVIEW; never synthesize a page or quote.

### P1 — legal-information answers are linked to source homepages, not legal passages

The source registry holds general portal URLs (src/lib/legal-info/sources.ts); LegalInformationService sends Gemini titles and URLs, then returns the generated prose beside those sources (src/lib/legal-info/service.ts:479-536). It does not fetch or verify the provision supporting each legal claim. The document jurisdiction is taken from an AI overview field rather than a separately verified governing-law passage (:400-456). **Action:** treat the registry as navigation only until official page-level source text, date, jurisdiction, and claim-to-source checks exist. Label general explanations as background and avoid implying that listed portals substantiate each sentence.

### P1 — forced reanalysis removes citations owned by other outputs

AnalysisService deletes **every** citation with the document ID (src/lib/analysis/service.ts:434), while comparisons and preparations share that table/document ID (src/lib/db/schema.ts:83-110). Reanalysis can erase their citation rows while their JSON remains. Replacement is not transactional. **Action:** delete only citations belonging to old analysis IDs and commit analysis plus citation replacement in one transaction. Add a regression test retaining comparison/preparation citations.

### P1 — ordinary reads trigger AI calls and database rewrites

getMatterEvidenceLedger and getMatterSourceMap call syncMatterEvidence (src/lib/matter/service.ts:3228,3265). That method calls generateCounselQuestions, which invokes Gemini when configured and writes an activity row (:2956, :2558-2650); it deletes and reinserts all matter evidence (:3167-3197). Source-map generation calls counsel generation again (:3330). The UI fetches ledger and map together. **Impact:** GET requests consume quota, mutate records, rotate generated IDs, and can race. **Action:** make GET read-only; refresh explicitly on a bounded POST or versioned change, write in one transaction, and cache questions per matter version.

### P1 — upload and model costs lack reliable limits

The upload route parses multipart data and copies file.arrayBuffer before the 20 MB service check (src/app/api/documents/upload/route.ts:7-29). The PDF parser has no page/extraction-time/decompression budget (src/lib/document/processor.ts:56-103). Analysis/comparison prompts include all pages (src/lib/ai/prompts.ts:45-56,105-129). The in-memory limiter trusts client-supplied x-forwarded-for (src/lib/security/rate-limiter.ts:145-155); upload, processing, preparation, legal-info Q&A, and relationship refresh do not call it. **Action:** enforce body/page/text/token/time/concurrency budgets and a trusted proxy identity; cover all expensive routes. Follow [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

### P1 — Docker container and Compose disagree on the port

Dockerfile sets PORT=8080 and health-checks 8080 (Dockerfile:43,68-72). The audit found that Compose and the runbook mapped 3000:3000; the remediation aligned them to 3000:8080. A container smoke test remains unavailable because the local Docker engine is not running.

### P2 — modal focus and nested controls need accessibility fixes

The shared Modal declares aria-modal and closes on Escape, but does not move focus inside, keep Tab within, make the background inert, or restore focus (src/components/ui/Modal/Modal.tsx). This falls short of the [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Header nests a button inside a link (src/components/layout/Header.tsx:75-80,119-123), creating invalid interactive nesting. Fix those and run keyboard/screen-reader checks across upload, comparison, tabs, viewer, and print. No browser accessibility test or measured WCAG audit is in the suite.

### P2 — PDF viewing depends on third-party JavaScript

The PDF viewer loads its worker JavaScript from unpkg at runtime (src/components/document/DocumentViewerImpl.tsx:12). This adds an external availability and supply-chain dependency to viewing private documents. Bundle the matching worker locally and test the viewer offline.

### P2 — public documentation and demo overstate confidence

The demo is a walkthrough, not the pre-analyzed interactive example promised by the runbook. It claims “No hallucinations” and “never used to train AI models.” README/steps cite 232 tests, while this review ran 278. Architecture docs still depict Next.js 15, Gemini 2.0, and nonexistent API endpoints. Tech stack docs call prompted JSON parsing “JSON Mode” with schema enforcement, but GeminiService.generateStructured<T> only parses JSON and casts it to T (src/lib/ai/gemini.ts:73-93). next.config.ts sets several headers but no Content Security Policy despite the README claim. Correct these statements before judging.

### P2 — maintainability and test isolation

MatterService exceeds 3,400 physical lines and MatterWorkspace exceeds 3,000. Large methods mix DB access, legal heuristics, AI prompting, verification, and presentation. Split by user journey after adding regression tests for the risks above. vitest.config.mts has no isolated test database; the service defaults to ./data/lexiguide.db. This review's test run updated existing database files. Tests mostly use offline fallbacks, so they do not validate live-model schemas, citation entailment, user authorization, or browser accessibility.

## Verification

| Check | Result | Limit |
| --- | --- | --- |
| Vitest with explicit Node 24 executable | **41 files, 278 tests passed at audit time** | The audit run wrote to data/lexiguide.db and WAL files. The current test setup uses `DATABASE_URL=:memory:`; see `implementation-status.md`. |
| TypeScript tsc --noEmit | Passed | Types do not validate model JSON at runtime. |
| ESLint | Passed | Static lint does not test security or accessibility. |
| Next production build | Blocked by an Inter fetch from Google Fonts in this restricted environment | An online build may succeed. A local font would avoid build-time network dependency. |
| Supplied GitHub example | Exact URL could not be retrieved | No claim is made about its contents; other repository ideas are in independent research. |

## Recommended next steps

1. Decide private single-user versus public multi-user deployment, enforce that boundary, remove unused provider upload, and correct data-handling claims.
2. Define one runtime-validated evidence contract; require the correct citations, verify passages and claim support, and abstain on absent answers.
3. Make analysis replacement transactional and matter reads side-effect free. Add trustworthy resource budgets and rate limits.
4. Isolate test DB/storage; add two-user access tests, a gold set of legal document cases, malicious/scanned PDF tests, and browser keyboard checks. Fix and smoke-test Docker.
5. Split the matter service and UI at existing journey boundaries; update public docs and give judges a real safe sample scenario.
6. Then add direct single-document cited Q&A, feedback on findings, and optional OCR with scan-quality notices.

### High-value product ideas after the trust work

- **“What is missing?” panel:** identify absent signatures, missing exhibits, undefined terms, blank dates, or documents cited but not uploaded. Show each as a check to perform, not a legal conclusion.
- **Challenge a finding:** let the user mark an AI statement incorrect, see its exact source passage, and regenerate only that finding while preserving an audit trail.
- **Lawyer handoff with evidence gaps:** export a short packet with verified facts, open questions, source pages, and items the user still needs to collect. Label user notes separately from document facts.
- **Jurisdiction-specific learning only with page-level source text:** replace generic source homepages with versioned, dated official passages before claiming a legal rule applies.

## Research basis

The evidence priority follows the [NIST GenAI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) and [Stanford's legal RAG evaluation](https://arxiv.org/abs/2405.20362): retrieval reduced but did not eliminate errors in the systems studied. File and retrieval controls follow [OWASP RAG guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html). Accessibility targets follow [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and the WAI dialog pattern. These sources inform recommendations; they do not certify this app.
