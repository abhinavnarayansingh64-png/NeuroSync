ALTER TABLE `baseModels` ADD `baseFeeInr` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `baseModels` ADD `baseFeeInr` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `baseModels` ADD `hourlyRateInr` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `baseModels` ADD `throughputMbPerHour` decimal(10,2) DEFAULT '4.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `baseModels` ADD `metadata` json;
