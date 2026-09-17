CREATE TABLE `document_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`matter_id` text NOT NULL,
	`source_document_id` text NOT NULL,
	`target_document_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`description` text NOT NULL,
	`source_page` integer,
	`source_quote` text,
	`target_page` integer,
	`target_quote` text,
	`confidence` real DEFAULT 1 NOT NULL,
	`classification` text DEFAULT 'NEEDS_REVIEW' NOT NULL,
	`status` text DEFAULT 'SUGGESTED' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`matter_id`) REFERENCES `matters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matter_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`matter_id` text NOT NULL,
	`document_id` text NOT NULL,
	`role` text DEFAULT 'SUPPORTING_DOCUMENT' NOT NULL,
	`role_suggestion` text,
	`role_confirmed` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`added_at` text NOT NULL,
	FOREIGN KEY (`matter_id`) REFERENCES `matters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matter_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`matter_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`classification` text DEFAULT 'USER_PROVIDED' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`matter_id`) REFERENCES `matters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matters` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`jurisdiction` text,
	`jurisdiction_provenance` text DEFAULT 'NOT_ESTABLISHED' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `preparations` ADD `matter_id` text REFERENCES matters(id);