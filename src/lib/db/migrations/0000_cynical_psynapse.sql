CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`summary` text,
	`document_type` text,
	`governing_law` text,
	`key_clauses_json` text,
	`obligations_json` text,
	`risks_json` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`classification` text,
	`citations_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `citations` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`analysis_id` text,
	`source_type` text DEFAULT 'DOCUMENT_FACT' NOT NULL,
	`page_number` integer,
	`section_reference` text,
	`quoted_text` text NOT NULL,
	`surrounding_context` text,
	`confidence_score` real DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `comparisons` (
	`id` text PRIMARY KEY NOT NULL,
	`base_document_id` text NOT NULL,
	`target_document_id` text NOT NULL,
	`summary` text,
	`differences_json` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`base_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`storage_path` text NOT NULL,
	`page_count` integer,
	`document_type` text,
	`status` text DEFAULT 'UPLOADED' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
