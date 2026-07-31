CREATE TABLE `import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`filename` varchar(500),
	`contactCount` int NOT NULL DEFAULT 0,
	`contactIds` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`)
);
