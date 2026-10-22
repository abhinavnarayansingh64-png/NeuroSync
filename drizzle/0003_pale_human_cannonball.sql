CREATE TABLE `jobAssignments` (
	`id` varchar(48) NOT NULL,
	`jobId` varchar(48) NOT NULL,
	`receiverId` varchar(48) NOT NULL,
	`shardIndex` int NOT NULL,
	`shardCount` int NOT NULL,
	`status` enum('reserved','queued','running','completed','failed','released') NOT NULL DEFAULT 'reserved',
	`checkpointKey` varchar(512),
	`lastHeartbeatAt` timestamp,
	`failureReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobAssignments_job_receiver_unique` UNIQUE(`jobId`,`receiverId`)
);
--> statement-breakpoint
CREATE TABLE `receiverHeartbeats` (
	`id` varchar(48) NOT NULL,
	`receiverId` varchar(48) NOT NULL,
	`reportedAvailability` enum('available','busy','offline','maintenance') NOT NULL,
	`capabilities` json,
	`clientTimestamp` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receiverHeartbeats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userMemberships` (
	`id` varchar(48) NOT NULL,
	`userId` int NOT NULL,
	`plan` enum('free','premium') NOT NULL DEFAULT 'free',
	`entitlementSource` varchar(40) NOT NULL DEFAULT 'workspace',
	`stripeCustomerId` varchar(160),
	`stripeSubscriptionId` varchar(160),
	`trialEndsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userMemberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `userMemberships_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `receivers` ADD `deviceFingerprint` varchar(160);--> statement-breakpoint
ALTER TABLE `receivers` ADD `activeJobId` varchar(48);--> statement-breakpoint
ALTER TABLE `receivers` ADD `reservationExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `receivers` ADD `lastHeartbeatAt` timestamp;--> statement-breakpoint
ALTER TABLE `trainingJobs` ADD `trainingMode` enum('single','distributed') DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE `trainingJobs` ADD `synchronizationStrategy` enum('per_step','adaptive');--> statement-breakpoint
ALTER TABLE `receivers` ADD CONSTRAINT `receivers_owner_fingerprint_unique` UNIQUE(`ownerId`,`deviceFingerprint`);--> statement-breakpoint
CREATE INDEX `jobAssignments_receiver_status_idx` ON `jobAssignments` (`receiverId`,`status`);--> statement-breakpoint
CREATE INDEX `jobAssignments_job_idx` ON `jobAssignments` (`jobId`);--> statement-breakpoint
CREATE INDEX `receiverHeartbeats_receiver_created_idx` ON `receiverHeartbeats` (`receiverId`,`createdAt`);