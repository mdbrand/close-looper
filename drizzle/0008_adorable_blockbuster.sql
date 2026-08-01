ALTER TABLE `email_drafts` MODIFY COLUMN `status` enum('pending','approved','sending','sent','skipped','failed') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `sendStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `sendError` text;--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `gmailThreadId` varchar(200);--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `gmailRfcMessageId` varchar(500);--> statement-breakpoint
UPDATE `email_drafts` d
INNER JOIN (
  SELECT `trackingId` FROM `email_drafts` GROUP BY `trackingId` HAVING COUNT(*) > 1
) duplicates ON duplicates.`trackingId` = d.`trackingId`
SET d.`trackingId` = CONCAT(LEFT(d.`trackingId`, 47), '-', LPAD(d.`id`, 16, '0'));--> statement-breakpoint
DELETE duplicate_entry FROM `suppression_list` duplicate_entry
INNER JOIN `suppression_list` keeper
  ON duplicate_entry.`userId` = keeper.`userId`
  AND LOWER(duplicate_entry.`email`) = LOWER(keeper.`email`)
  AND duplicate_entry.`id` > keeper.`id`;--> statement-breakpoint
ALTER TABLE `email_drafts` ADD CONSTRAINT `email_drafts_tracking_id_unique` UNIQUE(`trackingId`);--> statement-breakpoint
ALTER TABLE `sequence_steps` ADD CONSTRAINT `sequence_steps_sequence_step_unique` UNIQUE(`sequenceId`,`stepNumber`);--> statement-breakpoint
ALTER TABLE `suppression_list` ADD CONSTRAINT `suppression_list_user_email_unique` UNIQUE(`userId`,`email`);--> statement-breakpoint
CREATE INDEX `enrollments_user_contact_status_idx` ON `contact_sequence_enrollments` (`userId`,`contactId`,`status`);--> statement-breakpoint
CREATE INDEX `enrollments_status_due_idx` ON `contact_sequence_enrollments` (`status`,`nextSendAt`);--> statement-breakpoint
CREATE INDEX `email_drafts_user_status_schedule_idx` ON `email_drafts` (`userId`,`status`,`scheduledSendAt`);--> statement-breakpoint
CREATE INDEX `email_drafts_user_thread_idx` ON `email_drafts` (`userId`,`gmailThreadId`);
