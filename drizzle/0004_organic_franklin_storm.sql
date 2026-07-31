ALTER TABLE `email_drafts` ADD `deliveryStatus` enum('pending','delivered','bounced','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `retryCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `lastRetryAt` timestamp;--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `nextRetryAt` timestamp;