CREATE TABLE `preparations` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text,
	`comparison_id` text,
	`purpose` text,
	`user_notes_json` text,
	`checklist_state_json` text,
	`preparation_data_json` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comparison_id`) REFERENCES `comparisons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `citations` ADD `preparation_id` text REFERENCES preparations(id);