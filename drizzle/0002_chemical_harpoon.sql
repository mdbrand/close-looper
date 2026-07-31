CREATE TABLE `feedback_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ruleType` varchar(50) NOT NULL,
	`pattern` text NOT NULL,
	`replacement` text NOT NULL,
	`confidence` int NOT NULL DEFAULT 50,
	`appliedCount` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feedback_rules_id` PRIMARY KEY(`id`)
);
