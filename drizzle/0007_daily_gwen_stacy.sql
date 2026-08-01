CREATE TABLE `ai_usage_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`model` varchar(100),
	`promptTokens` int NOT NULL DEFAULT 0,
	`completionTokens` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_usage_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_sequence_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contactId` int NOT NULL,
	`sequenceId` int NOT NULL,
	`currentStepNumber` int NOT NULL DEFAULT 1,
	`status` enum('active','paused','completed','cancelled') NOT NULL DEFAULT 'active',
	`enrolledAt` timestamp NOT NULL DEFAULT (now()),
	`nextSendAt` timestamp,
	`completedAt` timestamp,
	`pausedAt` timestamp,
	`pauseReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_sequence_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`createdByUserId` int,
	`usedByUserId` int,
	`usedAt` timestamp,
	`maxUses` int NOT NULL DEFAULT 1,
	`useCount` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invite_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `invite_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerUserId` int NOT NULL,
	`referralCode` varchar(32) NOT NULL,
	`referredEmail` varchar(320),
	`referredUserId` int,
	`status` enum('pending','signed_up','paid','credited') NOT NULL DEFAULT 'pending',
	`creditApplied` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	`creditedAt` timestamp,
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_referralCode_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE `sender_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`senderFirstName` varchar(100),
	`senderLastName` varchar(100),
	`companyName` varchar(300),
	`industry` varchar(200),
	`city` varchar(200),
	`serviceArea` varchar(300),
	`mainService` text,
	`shortCompanyDescription` text,
	`peopleNormallyHelped` text,
	`mainProblemSolved` text,
	`idealReferral` text,
	`businessValues` text,
	`clientSuccessStory` text,
	`helpfulTip` text,
	`helpfulResource` text,
	`communityInvolvement` text,
	`personalBusinessLesson` text,
	`phone` varchar(30),
	`website` varchar(500),
	`linkedinUrl` varchar(500),
	`mailingAddress` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sender_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sequence_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sequenceId` int NOT NULL,
	`stepNumber` int NOT NULL,
	`internalName` varchar(200) NOT NULL,
	`relationshipObjective` text NOT NULL,
	`desiredRecipientThought` text,
	`emailGuidance` text NOT NULL,
	`suggestedClosing` text,
	`primaryCallToAction` text,
	`emailTemplate` text,
	`subjectTemplate` varchar(500),
	`minimumWordCount` int NOT NULL DEFAULT 75,
	`maximumWordCount` int NOT NULL DEFAULT 150,
	`delayMonths` int NOT NULL DEFAULT 1,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sequence_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(300) NOT NULL,
	`description` text,
	`relationshipTier` enum('cold','warm','hot') NOT NULL DEFAULT 'cold',
	`totalSteps` int NOT NULL DEFAULT 0,
	`isDefault` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppression_list` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`reason` enum('unsubscribed','bounced','blocked') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `suppression_list_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`phone` varchar(30),
	`companyName` varchar(200),
	`website` varchar(300),
	`industry` varchar(100),
	`successMetric` varchar(200),
	`referralCode` varchar(32),
	`freeMonthsEarned` int NOT NULL DEFAULT 0,
	`freeMonthsUsed` int NOT NULL DEFAULT 0,
	`subscriptionStatus` enum('trial','active','cancelled','past_due') NOT NULL DEFAULT 'trial',
	`inviteCodeUsed` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `user_profiles_referralCode_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE `waitlist_signups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100),
	`email` varchar(320) NOT NULL,
	`phone` varchar(30),
	`companyName` varchar(200),
	`website` varchar(300),
	`industry` varchar(100),
	`successMetric` varchar(200),
	`inviteCode` varchar(32),
	`referredByCode` varchar(32),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waitlist_signups_id` PRIMARY KEY(`id`),
	CONSTRAINT `waitlist_signups_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `signatureId` int;--> statement-breakpoint
ALTER TABLE `contacts` ADD `relationshipTier` enum('cold','warm','hot') DEFAULT 'warm' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `loopType` enum('relationship_sequence','flexible_touchpoints','manual','none') DEFAULT 'flexible_touchpoints' NOT NULL;--> statement-breakpoint
ALTER TABLE `contacts` ADD `contactSource` varchar(100);--> statement-breakpoint
ALTER TABLE `contacts` ADD `sourceName` varchar(200);--> statement-breakpoint
ALTER TABLE `contacts` ADD `sourceLocation` varchar(300);--> statement-breakpoint
ALTER TABLE `contacts` ADD `sourceUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `contacts` ADD `dateFoundOrMet` varchar(20);--> statement-breakpoint
ALTER TABLE `contacts` ADD `permissionNote` text;--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `sequenceStepId` int;--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `sequenceEnrollmentId` int;--> statement-breakpoint
ALTER TABLE `email_drafts` ADD `generationSource` enum('relationship_sequence','flexible_touchpoint','manual') DEFAULT 'flexible_touchpoint' NOT NULL;--> statement-breakpoint
ALTER TABLE `email_signatures` ADD `sendCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `email_signatures` ADD `replyCount` int DEFAULT 0 NOT NULL;