CREATE TABLE `legal_information_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`cache_key` text NOT NULL,
	`topic` text NOT NULL,
	`jurisdiction_json` text,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_information_cache_cache_key_unique` ON `legal_information_cache` (`cache_key`);