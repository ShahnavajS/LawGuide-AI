CREATE INDEX `analyses_document_id_idx` ON `analyses` (`document_id`);--> statement-breakpoint
CREATE INDEX `document_pages_document_page_idx` ON `document_pages` (`document_id`,`page_number`);--> statement-breakpoint
CREATE INDEX `document_relationships_matter_id_idx` ON `document_relationships` (`matter_id`);--> statement-breakpoint
CREATE INDEX `documents_created_at_idx` ON `documents` (`created_at`);--> statement-breakpoint
CREATE INDEX `matter_action_items_matter_created_at_idx` ON `matter_action_items` (`matter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `matter_activity_matter_created_at_idx` ON `matter_activity` (`matter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `matter_documents_matter_order_idx` ON `matter_documents` (`matter_id`,`display_order`,`added_at`);--> statement-breakpoint
CREATE INDEX `matter_documents_document_id_idx` ON `matter_documents` (`document_id`);--> statement-breakpoint
CREATE INDEX `matter_evidence_matter_id_idx` ON `matter_evidence` (`matter_id`);--> statement-breakpoint
CREATE INDEX `matter_notes_matter_created_at_idx` ON `matter_notes` (`matter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `matters_status_updated_at_idx` ON `matters` (`status`,`updated_at`);