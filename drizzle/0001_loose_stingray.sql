CREATE TABLE `ai_voice_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`voiceSample` text NOT NULL,
	`styleNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_voice_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100),
	`email` varchar(320) NOT NULL,
	`phone` varchar(30),
	`company` varchar(200),
	`industry` varchar(100),
	`relationshipType` enum('referral_partner','customer','prospect','other') NOT NULL DEFAULT 'referral_partner',
	`howWeMet` text,
	`personalNotes` text,
	`linkedinUrl` varchar(500),
	`instagramUrl` varchar(500),
	`facebookUrl` varchar(500),
	`birthday` varchar(10),
	`loopStatus` enum('active','paused','archived') NOT NULL DEFAULT 'active',
	`sendFrequencyWeeks` int NOT NULL DEFAULT 4,
	`tags` text,
	`lastTouchSentAt` timestamp,
	`nextTouchScheduledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contactId` int NOT NULL,
	`touchpointId` int,
	`touchpointName` varchar(200),
	`touchpointCategory` varchar(50),
	`gmailAccountId` int,
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`whyExplanation` varchar(500) NOT NULL,
	`status` enum('pending','approved','sent','skipped','failed') NOT NULL DEFAULT 'pending',
	`scheduledSendAt` timestamp,
	`sentAt` timestamp,
	`gmailMessageId` varchar(200),
	`trackingId` varchar(64) NOT NULL,
	`openCount` int NOT NULL DEFAULT 0,
	`firstOpenedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftId` int NOT NULL,
	`eventType` enum('sent','opened','bounced','replied','unsubscribed') NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`ipAddress` varchar(45),
	`userAgent` text,
	CONSTRAINT `email_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gmail_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gmailAddress` varchar(320) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`tokenExpiry` bigint,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gmail_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `touchpoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`category` enum('federal_holiday','quirky_holiday','industry_specific','personal_milestone') NOT NULL,
	`industryTag` varchar(100),
	`monthDay` varchar(5),
	`specificDate` varchar(10),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `touchpoints_id` PRIMARY KEY(`id`)
);
