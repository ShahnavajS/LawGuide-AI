# LexiGuide AI — Data Model Reference (historical phase reference)

> Current schema and trust boundaries are maintained in the code and [implementation-status.md](./implementation-status.md). Legacy columns such as `gemini_file_uri` remain for migration compatibility; the current code does not upload original PDFs to Gemini.

## Entity Relationship Diagram

```
Document 1──* Analysis
Document 1──* ChatMessage
Document 1──* Citation
Document 1──* Comparison (as baseDocument or targetDocument)
Analysis 1──* Citation
```

---

## Table Definitions

### `documents`

Stores document registration and storage references. Raw binaries are isolated in physical storage, never stored in SQLite.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | Generated prefixed UUID (`doc_<uuid>`) |
| `title` | TEXT | NOT NULL | Human-readable title derived from filename |
| `original_filename` | TEXT | NOT NULL | Sanitized user filename (metadata only) |
| `mime_type` | TEXT | NOT NULL | MIME type (e.g. `application/pdf`) |
| `file_size` | INTEGER | NOT NULL | Size in bytes (Max 20 MB) |
| `storage_path` | TEXT | NOT NULL | Isolated relative storage key (`<docId>/document.pdf`) |
| `page_count` | INTEGER | NULLABLE | Total pages (computed in Phase 3) |
| `document_type` | TEXT | NULLABLE | Legal category (null until Phase 3/4) |
| `status` | TEXT | NOT NULL, DEFAULT `'UPLOADED'` | `'UPLOADED'`, `'PENDING'`, `'PROCESSING'`, `'READY'`, `'FAILED'` |
| `processing_error` | TEXT | NULLABLE | Safe user-facing error message upon processing failure |
| `gemini_file_uri` | TEXT | NULLABLE | Server-side reference for Gemini Files API |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `document_pages` (Phase 3 Implemented)

Stores extracted page-level text preserving strict page boundaries for downstream citation validation.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | Generated prefixed UUID (`page_<uuid>`) |
| `document_id` | TEXT | FK → `documents.id` ON DELETE CASCADE | Target document foreign key |
| `page_number` | INTEGER | NOT NULL | 1-indexed natural page number |
| `text` | TEXT | NOT NULL | Faithful extracted text preserving source punctuation |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `analyses`

Stores structured GenAI breakdowns, clause extractions, and obligations.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`analysis_<uuid>`) |
| `document_id` | TEXT | FK → `documents.id` ON DELETE CASCADE | Target document |
| `summary` | TEXT | NULLABLE | Plain-language executive summary |
| `document_type` | TEXT | NULLABLE | Classified type (e.g. NDA, Lease, Employment) |
| `governing_law` | TEXT | NULLABLE | Jurisdiction / governing law |
| `key_clauses_json` | TEXT | NULLABLE | Serialized array of clauses |
| `obligations_json` | TEXT | NULLABLE | Serialized party obligations |
| `risks_json` | TEXT | NULLABLE | Serialized risk & attention items |
| `analysis_data_json` | TEXT | NULLABLE | Full validated LegalXRayAnalysis JSON dossier |
| `status` | TEXT | NOT NULL, DEFAULT `'PENDING'` | `'PENDING'`, `'COMPLETED'`, `'FAILED'` |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `citations`

Anchors every AI assertion directly to source excerpts.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`cit_<uuid>`) |
| `document_id` | TEXT | FK → `documents.id` ON DELETE CASCADE | Source document |
| `analysis_id` | TEXT | FK → `analyses.id` ON DELETE CASCADE, NULLABLE | Related analysis |
| `comparison_id` | TEXT | FK → `comparisons.id` ON DELETE CASCADE, NULLABLE | Related comparison |
| `source_type` | TEXT | NOT NULL, DEFAULT `'DOCUMENT_FACT'` | `DOCUMENT_FACT`, `AI_INTERPRETATION`, `GENERAL_INFO`, `NEEDS_REVIEW` |
| `page_number` | INTEGER | NULLABLE | Document page number |
| `section_reference` | TEXT | NULLABLE | Section / clause number (e.g. § 4.2) |
| `quoted_text` | TEXT | NOT NULL | Exact quote from document |
| `surrounding_context`| TEXT | NULLABLE | Paragraph context for verification |
| `confidence_score` | REAL | NOT NULL, DEFAULT 1.0 | Validation confidence (0.0 – 1.0) |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `chat_messages`

Document-grounded Q&A conversation history.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `document_id` | TEXT | FK → `documents.id` ON DELETE CASCADE | Associated document |
| `role` | TEXT | NOT NULL | `'user'` or `'assistant'` |
| `content` | TEXT | NOT NULL | Message body |
| `classification` | TEXT | NULLABLE | Evidence tier |
| `citations_json` | TEXT | NULLABLE | Serialized citations array |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `comparisons`

Tracks semantic differences and evidence between two document revisions.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`comp_<uuid>`) |
| `base_document_id` | TEXT | FK → `documents.id` ON DELETE CASCADE | Original version |
| `target_document_id`| TEXT | FK → `documents.id` ON DELETE CASCADE | Revised version |
| `summary` | TEXT | NULLABLE | Plain-language diff overview |
| `differences_json` | TEXT | NULLABLE | Serialized clause differences |
| `comparison_data_json` | TEXT | NULLABLE | Full validated ComparisonResult dossier |
| `processing_error` | TEXT | NULLABLE | Error message on failure |
| `status` | TEXT | NOT NULL, DEFAULT `'PENDING'` | `'PENDING'`, `'PROCESSING'`, `'COMPLETED'`, `'FAILED'` |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NULLABLE | ISO 8601 timestamp |

### `preparations` (Phase 6 Implemented)

Stores structured attorney consultation briefs, prioritized questions, and actionable preparation checklists.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`prep_<uuid>`) |
| `document_id` | TEXT | FK → `documents.id` ON DELETE CASCADE, NULLABLE | Primary analyzed document |
| `comparison_id` | TEXT | FK → `comparisons.id` ON DELETE CASCADE, NULLABLE | Associated document comparison |
| `purpose` | TEXT | NULLABLE | User-provided consultation objective |
| `user_notes_json` | TEXT | NULLABLE | Serialized array of user notes (`USER_PROVIDED`) |
| `checklist_state_json` | TEXT | NULLABLE | Serialized map of checklist item IDs to completed boolean |
| `preparation_data_json` | TEXT | NULLABLE | Full validated `PreparationBrief` JSON dossier |
| `status` | TEXT | NOT NULL, DEFAULT `'PENDING'` | `'PENDING'`, `'PROCESSING'`, `'COMPLETED'`, `'FAILED'` |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `legal_information_cache` (Phase 7 Implemented)

Caches educational legal topic dossiers, registered source metadata, and concept explanations across server restarts.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`cache_<uuid>`) |
| `cache_key` | TEXT | NOT NULL, UNIQUE | Composite key (`${topic}:${jurisdiction}:${documentId}`) |
| `topic` | TEXT | NOT NULL | Canonical taxonomy topic ID |
| `jurisdiction_json` | TEXT | NULLABLE | Serialized `JurisdictionInfo` provenance |
| `response_json` | TEXT | NOT NULL | Serialized `LegalInformationDossier` JSON |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `expires_at` | TEXT | NOT NULL | Cache expiration ISO timestamp (24h TTL) |

### `matters` (Phase 8 Implemented)

Groups related legal contracts, amendments, notices, and supporting documents under a unified legal matter.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`matter_<uuid>`) |
| `title` | TEXT | NOT NULL | Matter title |
| `description` | TEXT | NULLABLE | Background and context |
| `jurisdiction` | TEXT | NULLABLE | Declared governing jurisdiction |
| `jurisdiction_provenance` | TEXT | NOT NULL, DEFAULT `'NOT_ESTABLISHED'` | `'DOCUMENT_EXPLICIT'`, `'USER_PROVIDED'`, `'NOT_ESTABLISHED'` |
| `status` | TEXT | NOT NULL, DEFAULT `'ACTIVE'` | `'ACTIVE'` or `'ARCHIVED'` |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `matter_documents` (Phase 8 Implemented)

Associates uploaded legal documents with a matter, assigning specific legal roles without copying files.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`mdoc_<uuid>`) |
| `matter_id` | TEXT | FK → `matters.id` ON DELETE CASCADE | Parent matter |
| `document_id` | TEXT | FK → `documents.id` ON DELETE CASCADE | Linked document |
| `role` | TEXT | NOT NULL, DEFAULT `'SUPPORTING_DOCUMENT'` | Legal role (`PRIMARY_AGREEMENT`, `AMENDMENT`, etc.) |
| `role_suggestion` | TEXT | NULLABLE | Suggested role from heuristic scan |
| `role_confirmed` | INTEGER | NOT NULL, DEFAULT `0` | Boolean flag indicating explicit confirmation |
| `display_order` | INTEGER | NOT NULL, DEFAULT `0` | Sequence order in workspace |
| `added_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `document_relationships` (Phase 8 Implemented)

Stores verified and suggested cross-document relationships (amendments, references, incorporations).

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`drel_<uuid>`) |
| `matter_id` | TEXT | FK → `matters.id` ON DELETE CASCADE | Parent matter |
| `source_document_id` | TEXT | FK → `documents.id` ON DELETE CASCADE | Referring document |
| `target_document_id` | TEXT | FK → `documents.id` ON DELETE CASCADE | Referenced document |
| `relationship_type` | TEXT | NOT NULL | Relationship type (`REFERENCES`, `AMENDS`, etc.) |
| `description` | TEXT | NOT NULL | Plain-language description |
| `source_page` | INTEGER | NULLABLE | Source page number |
| `source_quote` | TEXT | NULLABLE | Exact text quote in source document |
| `target_page` | INTEGER | NULLABLE | Target page number |
| `target_quote` | TEXT | NULLABLE | Exact text quote in target document |
| `confidence` | REAL | NOT NULL, DEFAULT `0.8` | Extraction confidence score |
| `classification` | TEXT | NOT NULL, DEFAULT `'DOCUMENT_FACT'` | `'DOCUMENT_FACT'` or `'NEEDS_REVIEW'` |
| `status` | TEXT | NOT NULL, DEFAULT `'SUGGESTED'` | `'SUGGESTED'`, `'CONFIRMED'`, `'REJECTED'` |
| `is_validated` | INTEGER | NOT NULL, DEFAULT `0` | Dual quotation verification boolean |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `matter_notes` (Phase 8 Implemented)

User-provided private notes, consultation goals, and facts associated with a matter (`USER_PROVIDED`).

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`mnote_<uuid>`) |
| `matter_id` | TEXT | FK → `matters.id` ON DELETE CASCADE | Parent matter |
| `title` | TEXT | NOT NULL | Note heading |
| `content` | TEXT | NOT NULL | Note body text |
| `classification` | TEXT | NOT NULL, DEFAULT `'GENERAL_NOTE'` | Classification tag |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `matter_action_items` (Phase 9 Implemented)

Actionable preparation roadmap and verification checklist derived from consistency findings, unverified relationships, attention areas, and user-provided tasks.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`act_<uuid>`) |
| `matter_id` | TEXT | FK → `matters.id` ON DELETE CASCADE | Parent matter |
| `title` | TEXT | NOT NULL | Task title / description |
| `description` | TEXT | NOT NULL | Detailed rationale and instructions |
| `type` | TEXT | NOT NULL | `'REVIEW_DOCUMENT'`, `'REQUEST_DOCUMENT'`, `'VERIFY_FACT'`, `'VERIFY_TERM'`, `'PROVIDE_MISSING_INFORMATION'`, `'COLLECT_DOCUMENT'`, `'REVIEW_TIMELINE'`, `'REVIEW_CONSISTENCY'`, `'RESOLVE_DISCREPANCY'`, `'ASK_COUNSEL'`, `'CONFIRM_USER_CONTEXT'`, `'FOLLOW_UP'`, `'GENERAL_INFORMATION'` |
| `status` | TEXT | NOT NULL, DEFAULT `'OPEN'` | `'OPEN'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'DISMISSED'` |
| `priority` | TEXT | NOT NULL, DEFAULT `'MEDIUM'` | `'HIGH'`, `'MEDIUM'`, `'LOW'`, `'INFORMATIONAL'` |
| `source_type` | TEXT | NOT NULL | `'DOCUMENT'`, `'LEGAL_XRAY'`, `'COMPARISON'`, `'RELATIONSHIP'`, `'CONSISTENCY'`, `'TIMELINE'`, `'MISSING_INFO'`, `'MATTER_WORKSPACE'`, `'USER_NOTE'`, `'USER_CREATED'`, `'MANUAL'` |
| `source_reference` | TEXT | NULLABLE | Document page or record citation |
| `related_document_id` | TEXT | FK → `documents.id` ON DELETE SET NULL | Associated document ID |
| `related_comparison_id` | TEXT | FK → `comparisons.id` ON DELETE SET NULL | Associated comparison ID |
| `related_relationship_id` | TEXT | FK → `document_relationships.id` ON DELETE SET NULL | Associated relationship ID |
| `related_consistency_finding_id` | TEXT | NULLABLE | Associated consistency finding ID |
| `user_provided` | INTEGER | NOT NULL, DEFAULT `0` | Boolean indicating user-created task |
| `due_date` | TEXT | NULLABLE | Explicit due date (YYYY-MM-DD) |
| `due_date_provenance` | TEXT | NULLABLE | `'DOCUMENT_STATED'`, `'USER_PROVIDED'`, `'CALCULATED_EXPLICIT'` |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `matter_activity` (Phase 9 Implemented)

Append-only audit trail logging all lifecycle and intelligence operations on a matter.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`actv_<uuid>`) |
| `matter_id` | TEXT | FK → `matters.id` ON DELETE CASCADE | Parent matter |
| `action_type` | TEXT | NOT NULL | `'DOCUMENT_ATTACHED'`, `'DOCUMENT_DETACHED'`, `'ROLE_UPDATED'`, `'RELATIONSHIPS_SCANNED'`, `'RELATIONSHIP_CONFIRMED'`, `'RELATIONSHIP_REJECTED'`, `'CONSISTENCY_CHECKED'`, `'NOTE_ADDED'`, `'NOTE_DELETED'`, `'ACTION_ITEM_CREATED'`, `'ACTION_ITEM_UPDATED'`, `'ACTION_ITEM_DELETED'`, `'ACTION_ITEM_COMPLETED'`, `'ACTION_ITEMS_GENERATED'`, `'PREPARATION_BRIEF_GENERATED'`, `'EVIDENCE_REVIEWED'`, `'EVIDENCE_LEDGER_VIEWED'`, `'CITATION_VERIFICATION_RUN'` |
| `description` | TEXT | NOT NULL | Human-readable audit log description |
| `metadata_json` | TEXT | NULLABLE | JSON payload with operational details |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |

### `matter_evidence` (Phase 10 Implemented)

Materialized Evidence Intelligence Ledger anchoring every matter finding, counsel question, and action item to underlying documents, pages, and verbatim quotes.

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | TEXT | PRIMARY KEY | UUID (`ev_<uuid>`) |
| `matter_id` | TEXT | FK → `matters.id` ON DELETE CASCADE | Parent matter |
| `evidence_type` | TEXT | NOT NULL | `'DOCUMENT_CITATION'`, `'CONSISTENCY_EVIDENCE'`, `'RELATIONSHIP_EVIDENCE'`, `'USER_PROVIDED'` |
| `document_id` | TEXT | FK → `documents.id` ON DELETE SET NULL, NULLABLE | Member document ID (null for user notes) |
| `page_number` | INTEGER | NULLABLE | 1-indexed page number |
| `quoted_text` | TEXT | NULLABLE | Exact verbatim quote from source document |
| `normalized_quote` | TEXT | NULLABLE | Whitespace-normalized text for resilient substring matching |
| `classification` | TEXT | NOT NULL | `'DOCUMENT_FACT'`, `'AI_INTERPRETATION'`, `'GENERAL_INFO'`, `'NEEDS_REVIEW'`, `'USER_PROVIDED'` |
| `verification_status` | TEXT | NOT NULL | `'VERIFIED'`, `'NEEDS_REVIEW'`, `'UNVERIFIED'`, `'FLAGGED'` |
| `confidence_category` | TEXT | NOT NULL | `'HIGH'`, `'MEDIUM'`, `'LOW'`, `'UNVERIFIED'` |
| `source_reference` | TEXT | NULLABLE | Human-readable source reference (e.g., "Lease.pdf, Page 3") |
| `target_document_id` | TEXT | FK → `documents.id` ON DELETE SET NULL, NULLABLE | Cross-document target document ID |
| `target_page_number` | INTEGER | NULLABLE | Cross-document target page number |
| `target_quote` | TEXT | NULLABLE | Verbatim quote from target document |
| `used_by_json` | TEXT | NOT NULL, DEFAULT `'[]'` | Serialized array of consumer references (finding, question, action item, brief) |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

