CREATE TABLE `baseModels` (
	`id` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`provider` varchar(120) NOT NULL,
	`sizeLabel` varchar(40) NOT NULL,
	`contextWindow` int,
	`description` text,
	`tags` json,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `baseModels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobEvents` (
	`id` varchar(48) NOT NULL,
	`jobId` varchar(48) NOT NULL,
	`status` varchar(40),
	`type` varchar(64) NOT NULL,
	`message` text,
	`payload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(48) NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(48),
	`type` enum('info','success','warning','error') NOT NULL DEFAULT 'info',
	`title` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `providerExecutions` (
	`id` varchar(48) NOT NULL,
	`jobId` varchar(48) NOT NULL,
	`provider` varchar(40) NOT NULL,
	`providerJobId` varchar(160),
	`endpointId` varchar(160),
	`callbackTokenHash` varchar(128) NOT NULL,
	`lastProviderStatus` varchar(80),
	`lastPayload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `providerExecutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `providerExecutions_jobId_unique` UNIQUE(`jobId`),
	CONSTRAINT `providerExecutions_provider_job_unique` UNIQUE(`provider`,`providerJobId`)
);
--> statement-breakpoint
CREATE TABLE `receivers` (
	`id` varchar(48) NOT NULL,
	`ownerId` int,
	`name` varchar(140) NOT NULL,
	`location` varchar(140),
	`gpu` varchar(120) NOT NULL,
	`vramGb` int NOT NULL,
	`pricePerHour` decimal(10,2) NOT NULL,
	`availability` enum('available','busy','offline','maintenance') NOT NULL DEFAULT 'available',
	`capabilities` json,
	`isDirectoryVisible` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receivers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settlementRecords` (
	`id` varchar(48) NOT NULL,
	`jobId` varchar(48) NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`status` enum('pending','authorized','settled','refunded','failed') NOT NULL DEFAULT 'pending',
	`externalReference` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settlementRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `settlementRecords_jobId_unique` UNIQUE(`jobId`)
);
--> statement-breakpoint
CREATE TABLE `trainedModels` (
	`id` varchar(48) NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(48) NOT NULL,
	`name` varchar(180) NOT NULL,
	`baseModel` varchar(180) NOT NULL,
	`method` varchar(40) NOT NULL,
	`sizeBytes` int NOT NULL,
	`artifactKey` varchar(512),
	`artifactUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainedModels_id` PRIMARY KEY(`id`),
	CONSTRAINT `trainedModels_jobId_unique` UNIQUE(`jobId`)
);
--> statement-breakpoint
CREATE TABLE `trainingJobs` (
	`id` varchar(48) NOT NULL,
	`displayId` varchar(48) NOT NULL,
	`userId` int NOT NULL,
	`receiverId` varchar(48) NOT NULL,
	`baseModelId` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`status` enum('draft','awaiting_payment','queued','provisioning','loading_dataset','running','paused','cancelling','completed','failed','cancelled') NOT NULL DEFAULT 'awaiting_payment',
	`provider` varchar(40) NOT NULL DEFAULT 'runpod',
	`config` json NOT NULL,
	`metrics` json,
	`datasetName` varchar(255),
	`datasetKey` varchar(512),
	`datasetUrl` text,
	`estimatedCost` decimal(12,2),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trainingJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `trainingJobs_displayId_unique` UNIQUE(`displayId`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workspaceRole` enum('unassigned','sender','receiver','both') NOT NULL DEFAULT 'unassigned',
	`organization` varchar(160),
	`notificationPreferences` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `jobEvents_job_created_idx` ON `jobEvents` (`jobId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`userId`,`readAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `receivers_ownerId_idx` ON `receivers` (`ownerId`);--> statement-breakpoint
CREATE INDEX `receivers_availability_idx` ON `receivers` (`availability`);--> statement-breakpoint
CREATE INDEX `settlementRecords_user_status_idx` ON `settlementRecords` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `trainedModels_user_created_idx` ON `trainedModels` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `trainingJobs_user_status_idx` ON `trainingJobs` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `trainingJobs_receiver_status_idx` ON `trainingJobs` (`receiverId`,`status`);