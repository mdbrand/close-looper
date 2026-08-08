CREATE TABLE `contact_inquiries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(200) NOT NULL,
  `email` varchar(320) NOT NULL,
  `companyName` varchar(200),
  `subject` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `status` enum('new','read','closed') NOT NULL DEFAULT 'new',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `contact_inquiries_id` PRIMARY KEY(`id`)
);
