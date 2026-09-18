ALTER TABLE `preparations` ADD `brief_kind` text DEFAULT 'PREPARATION' NOT NULL;--> statement-breakpoint
UPDATE `preparations` SET `brief_kind` = 'MATTER' WHERE `matter_id` IS NOT NULL AND `document_id` IS NULL AND `comparison_id` IS NULL AND `purpose` LIKE 'Matter Counsel Brief:%';--> statement-breakpoint
CREATE INDEX `preparations_matter_kind_idx` ON `preparations` (`matter_id`,`brief_kind`);
