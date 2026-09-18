# Independent research baseline

Status: baseline completed before inspecting the current implementation, 2026-09-17.

## Problem to solve

Help a person understand a supplied legal document, find the passages behind an explanation, compare documents, identify practical questions and next steps, and know when to seek qualified legal help. The product provides legal information and document assistance. It must preserve uncertainty, jurisdiction, and source context.

## Blank-slate product design

1. Accept supported documents safely; extract text with page, section, and paragraph positions.
2. Let the user choose a task: plain-language explanation, grounded question answering, comparison, obligations and dates, risk review, or lawyer-preparation checklist.
3. Retrieve relevant passages and return answers with exact document citations. Distinguish extracted facts, interpretation, and general information.
4. Display a source passage on demand and allow the user to challenge or correct an answer.
5. Make jurisdiction, document type, and effective date visible. Avoid unsupported legal conclusions.
6. Keep uploaded material private, provide deletion controls, and explain retention and model-provider handling.

## Minimum useful user journeys

| Journey | Input | Output | Trust requirement |
| --- | --- | --- | --- |
| Understand a contract | One PDF, DOCX, or text document | Plain-language summary and clause cards | Each card opens the supporting passage; missing or unreadable content is disclosed |
| Ask about a document | Document and a question | Short answer with passage references | Abstain when the answer is absent or ambiguous |
| Compare versions | Two documents | Material changes to obligations, dates, money, rights, and dispute terms | Show both source passages and label additions, removals, and changes |
| Prepare for legal help | Document plus user concern | Facts to gather and questions to ask a professional | Suggestions are framed as preparation, not individualized legal advice |

The strongest differentiator is an **evidence ledger**: every generated finding has a source span, a label saying whether it is a document fact or an interpretation, and a visible uncertainty note. A polished answer without a verifiable passage is a product failure in this domain.

## Blank-slate technical stack

- **Web app:** a typed, server-rendered framework with semantic HTML and a small number of screens. Keep document processing and model credentials on the server.
- **Storage:** relational metadata for users, documents, analyses, and source spans; object storage for originals. Start with a single database and ordinary text search for a small corpus. Add a vector index only if retrieval evaluations justify it.
- **Parsing:** PDF and DOCX parsers that preserve page/paragraph anchors; reject empty extraction and explicitly route scanned PDFs to OCR or label them unsupported. Bound file size, page count, extraction time, and decompression cost.
- **AI:** one configurable provider adapter, structured output validated at runtime, bounded retrieved passages, server-side citation verification, and explicit abstention. Use deterministic extraction for dates and amounts when possible, with model interpretation kept separate.
- **Tests:** small fixture documents and adversarial samples for grounding, comparisons, authorization, malformed files, prompt injection, and keyboard use. Measure citation correctness and abstention, not just whether a response is returned.
- **Operations:** secrets in server environment, request limits and cost budgets, data retention and delete path, redacted logs, and basic health checks.

This is a recommended starting architecture, not a claim about the current project. A hackathon version can use local file storage and SQLite if it has one-user scope and explains that boundary; shared deployment requires per-user authorization and durable storage.

## Build steps from a blank project

1. Define scope, jurisdiction posture, supported formats, retention, and success criteria. Create a small gold set of documents with expected answers and exact source spans.
2. Build safe upload, extraction, source viewer, deletion, and parser error states. Verify that every displayed passage maps to the original.
3. Build grounded Q&A with retrieval, structured output, citation checks, and abstention. Test absent-answer and prompt-injection cases.
4. Add clause cards and version comparison using the same passage model. Evaluate omissions and false change claims on sample contracts.
5. Add legal-professional preparation outputs and visible limitations. Make high-stakes or urgent situations route to a human.
6. Complete code review, security checks, accessibility audit, performance checks, and a reproducible demo with a known document set.

## Primary research and design implications

- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) identifies confabulation and information-integrity risks. Inference: model prose needs source verification and calibrated uncertainty.
- [Stanford RegLab's legal RAG evaluation](https://arxiv.org/abs/2405.20362) found hallucinations in tested legal research products even with retrieval. This study concerns those products and tasks, not this app; it rules out claiming that RAG alone makes legal answers reliable.
- [OWASP LLM Top 10 (2025)](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/) highlights prompt injection, sensitive-information disclosure, and improper output handling. [OWASP's RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html) treats retrieved content as untrusted. Inference: uploaded text must never gain instruction authority or trigger unrestricted tools.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) recommends allowlists, content checks, size limits, safe storage, and malware scanning where available. Inference: checking only filename or declared MIME type is inadequate.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) is the accessibility target. Particularly relevant: keyboard operation, visible focus, labels, error identification, contrast, and status announcements for long-running analysis.
- [ABA Formal Opinion 512 announcement](https://www.americanbar.org/news/abanews/aba-news-archives/2024/07/aba-issues-first-ethics-guidance-ai-tools/) highlights confidentiality, competence, and communication for lawyers using GenAI. The app targets consumers too; this supports careful handling of uploaded legal material, not an assertion that ABA rules govern all users.
- [CUAD](https://arxiv.org/abs/2103.06268) is an expert-annotated contract review dataset. Inference: sample clause tasks and error categories can inform evaluation, though real consumer documents and jurisdictions will differ.

## Open-source ideas worth borrowing, without copying architecture

- [OpenContracts](https://github.com/Open-Source-Legal/OpenContracts): source-span annotations and human review of extracted findings. Its full citation graph and multi-service platform are too large for this scope.
- [docassemble](https://github.com/jhpyle/docassemble): guided interviews can gather missing facts and generate a lawyer-preparation checklist. This is a workflow idea, not a need to adopt its full stack.
- [Legal-RAG](https://github.com/spearb0lt/Legal-RAG): inspectable hybrid retrieval and citation verification, especially relevant if the project expands into Indian-law sources. A curated, versioned corpus and jurisdiction controls are prerequisites for legal-source Q&A.
- The supplied [Sreevalli20/promptwar-](https://github.com/Sreevalli20/promptwar-) URL could not be fetched through the available web or repository access on 2026-09-17. No claims about its contents are made.

## Candidate improvements to check against the implementation

1. Evidence ledger and source viewer with exact passage references.
2. Citation validation, abstention, and an evaluation set with answerable and unanswerable questions.
3. Safe upload, tenant isolation, retention, and deletion controls.
4. Meaningful version comparison focused on material obligations rather than a generic text diff.
5. Explicit jurisdiction/effective-date context and a clean handoff to a legal professional.
6. WCAG 2.2 AA-oriented interaction checks and visible failure states.
