CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
INSERT INTO `users` (`id`,`name`,`email`,`password_hash`,`is_demo`,`is_active`,`created_at`,`updated_at`)
VALUES ('usr_evaluator_demo','Evaluator Demo','evaluator@lexiguide.demo','demo-hash-created-at-first-login',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_sessions_user_id_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires_at_idx` ON `user_sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `comparisons` ADD `user_id` text DEFAULT '__unowned__' NOT NULL;--> statement-breakpoint
UPDATE `comparisons` SET `user_id` = 'usr_evaluator_demo' WHERE `user_id` = '__unowned__';--> statement-breakpoint
CREATE INDEX `comparisons_user_pair_idx` ON `comparisons` (`user_id`,`base_document_id`,`target_document_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `user_id` text DEFAULT '__unowned__' NOT NULL;--> statement-breakpoint
UPDATE `documents` SET `user_id` = 'usr_evaluator_demo' WHERE `user_id` = '__unowned__';--> statement-breakpoint
CREATE INDEX `documents_user_created_at_idx` ON `documents` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `matters` ADD `user_id` text DEFAULT '__unowned__' NOT NULL;--> statement-breakpoint
UPDATE `matters` SET `user_id` = 'usr_evaluator_demo' WHERE `user_id` = '__unowned__';--> statement-breakpoint
CREATE INDEX `matters_user_status_updated_at_idx` ON `matters` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `preparations` ADD `user_id` text DEFAULT '__unowned__' NOT NULL;--> statement-breakpoint
UPDATE `preparations` SET `user_id` = 'usr_evaluator_demo' WHERE `user_id` = '__unowned__';--> statement-breakpoint
CREATE INDEX `preparations_user_source_idx` ON `preparations` (`user_id`,`document_id`,`comparison_id`,`matter_id`);
