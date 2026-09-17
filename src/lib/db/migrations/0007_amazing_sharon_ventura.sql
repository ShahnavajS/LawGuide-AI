CREATE TABLE `matter_action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`matter_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`source_type` text NOT NULL,
	`source_reference` text,
	`related_document_id` text,
	`related_comparison_id` text,
	`related_relationship_id` text,
	`related_consistency_finding_id` text,
	`user_provided` integer DEFAULT false NOT NULL,
	`due_date` text,
	`due_date_provenance` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`matter_id`) REFERENCES `matters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`related_comparison_id`) REFERENCES `comparisons`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`related_relationship_id`) REFERENCES `document_relationships`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `matter_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`matter_id` text NOT NULL,
	`action_type` text NOT NULL,
	`description` text NOT NULL,
	`metadata_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`matter_id`) REFERENCES `matters`(`id`) ON UPDATE no action ON DELETE cascade
);
