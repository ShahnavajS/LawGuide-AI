ALTER TABLE `citations` ADD `comparison_id` text REFERENCES comparisons(id);--> statement-breakpoint
ALTER TABLE `comparisons` ADD `comparison_data_json` text;--> statement-breakpoint
ALTER TABLE `comparisons` ADD `processing_error` text;--> statement-breakpoint
ALTER TABLE `comparisons` ADD `updated_at` text;