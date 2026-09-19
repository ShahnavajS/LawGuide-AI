# Efficiency, security, and code quality review — 2026-09-18

The external score is a useful signal, but its rubric and test corpus are unavailable. These changes address observable costs and a production access-control defect. They do not establish a new numeric score.

## Evidence and changes

| Area | Observed behavior | Change | Expected effect |
| --- | --- | --- | --- |
| Matter list | One list query plus two count queries for every matter (`2N + 1` queries). | One grouped query with left joins and conditional distinct count. | One query, including correct zero counts for empty matters. |
| Matter workspace | Opening the overview requested matter details plus six more endpoints. Brief and evidence responses were unused until their tabs opened. | Load the brief and the source map/evidence ledger on their respective tabs. | Four initial requests instead of seven, with the same tab data available on demand. |
| Document list | `Promise.all` queued one filesystem existence check for every document at once. | Check in batches of 32, preserving order and missing-file status. | Bounded concurrent filesystem work on large workspaces. |
| Readiness | `getMatter()` calculated consistency findings, then readiness calculated them again. | Reuse the count already present in matter metrics. | One fewer pairwise document comparison per readiness request. |
| SQLite lookups | Child foreign keys and frequent matter/document filters had no secondary indexes. | Added 11 targeted indexes through Drizzle migration `0009`. | Fewer full scans for lists, page lookups, matter data, and cascade checks as data grows. Indexes add some write and storage cost. |
| Health check | `COUNT(*)` scanned the documents table merely to test database access. | Use `SELECT 1`. | Constant work per health request. |
| Production access | Missing credentials made `required` false, allowing the proxy to pass production requests. | Require the gate in production, reject missing/placeholder credentials with 503, and retain the documented unconfigured local development mode. | Production fails closed. |
| Sign-in body | `Content-Length` was checked, but a request without that header could still be fully parsed. | Read at most 4 KB from the request stream before decoding the browser form. | Chunked or undeclared sign-in bodies cannot consume the route's full 21 MB proxy allowance. |
| Public route exceptions | Any `.svg`, `.png`, or `.ico` path bypassed the proxy, including an API path with that suffix. | Limit exceptions to actual public assets. | No extension-based API bypass. |
| Lint | The generated, minified PDF worker created thousands of irrelevant diagnostics. | Exclude that generated file from ESLint. | Application lint output is actionable. |

## Research basis

- [SQLite query plan guidance](https://sqlite.org/eqp.html) explains how to inspect full scans versus indexed searches. [SQLite foreign key guidance](https://sqlite.org/foreignkeys.html) recommends indexes on child keys for efficient parent deletes and updates.
- [Drizzle index declarations](https://orm.drizzle.team/docs/indexes-constraints) are the source for schema-defined indexes and generated migrations.
- [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication) recommends authorization close to data access and treats Proxy checks as optimistic. The current account implementation follows that split: Proxy performs a signed-token precheck, protected handlers validate the database session, and domain services scope top-level records to the authenticated owner.
- [OWASP's file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) supports the existing extension, MIME, signature, size, generated-name, and private-storage checks. The PDF parser and worker remain a dependency to keep patched; the [PDF.js advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j) lists 6.2.108 as patched, and this project uses 6.3.289.

## Verification and limits

- In-memory migration and application tests: 293 tests across 44 files passed after the changes. Added regression coverage for production missing secrets, development access, API suffix protection, sign-in body limits, and matter counts.
- ESLint, TypeScript, and a Next.js production build passed. The migration SQL was reviewed before running tests.
- The checked-in PDF worker SHA-256 hash matches the worker in the installed `pdfjs-dist` 6.3.289 package.
- A small, one-off in-memory SQLite benchmark with 1,000 matters and two documents each measured median raw SQL times of 5.12 ms for the old 2,001-query count path and 1.85 ms for the grouped query (five runs, warmed connection). This is a directional microbenchmark, not an end-to-end browser measurement. The initial request count is determined from the changed code; browser timing was not run.
- Individual account ownership and revocable sessions are implemented and covered by two-account isolation tests. The current CSP permits inline scripts required by Next.js rendering. No external evaluator score can be guaranteed by repository changes alone.
