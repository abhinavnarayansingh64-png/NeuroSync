import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workspaceRole: mysqlEnum("workspaceRole", ["unassigned", "sender", "receiver", "both"])
    .default("unassigned")
    .notNull(),
  organization: varchar("organization", { length: 160 }),
  preferences: json("preferences"),
  notificationPreferences: json("notificationPreferences"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("userProfiles_userId_unique").on(table.userId)]);

export const receivers = mysqlTable("receivers", {
  id: varchar("id", { length: 48 }).primaryKey(),
  ownerId: int("ownerId"),
  deviceFingerprint: varchar("deviceFingerprint", { length: 160 }),
  name: varchar("name", { length: 140 }).notNull(),
  location: varchar("location", { length: 140 }),
  gpu: varchar("gpu", { length: 120 }).notNull(),
  vramGb: int("vramGb").notNull(),
  pricePerHour: decimal("pricePerHour", { precision: 10, scale: 2 }).notNull(),
  availability: mysqlEnum("availability", ["available", "busy", "offline", "maintenance"])
    .default("available")
    .notNull(),
  capabilities: json("capabilities"),
  isDirectoryVisible: boolean("isDirectoryVisible").default(false).notNull(),
  activeJobId: varchar("activeJobId", { length: 48 }),
  reservationExpiresAt: timestamp("reservationExpiresAt"),
  lastHeartbeatAt: timestamp("lastHeartbeatAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("receivers_ownerId_idx").on(table.ownerId),
  index("receivers_availability_idx").on(table.availability),
  uniqueIndex("receivers_owner_fingerprint_unique").on(table.ownerId, table.deviceFingerprint),
]);

export const receiverHeartbeats = mysqlTable("receiverHeartbeats", {
  id: varchar("id", { length: 48 }).primaryKey(),
  receiverId: varchar("receiverId", { length: 48 }).notNull(),
  reportedAvailability: mysqlEnum("reportedAvailability", ["available", "busy", "offline", "maintenance"]).notNull(),
  capabilities: json("capabilities"),
  clientTimestamp: timestamp("clientTimestamp"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("receiverHeartbeats_receiver_created_idx").on(table.receiverId, table.createdAt)]);

export const userMemberships = mysqlTable("userMemberships", {
  id: varchar("id", { length: 48 }).primaryKey(),
  userId: int("userId").notNull(),
  plan: mysqlEnum("plan", ["free", "premium"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "trialing", "past_due", "cancelled"]).default("active").notNull(),
  entitlementSource: varchar("entitlementSource", { length: 40 }).default("workspace").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 160 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 160 }),
  trialEndsAt: timestamp("trialEndsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("userMemberships_userId_unique").on(table.userId)]);

export const baseModels = mysqlTable("baseModels", {
  id: varchar("id", { length: 80 }).primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  provider: varchar("provider", { length: 120 }).notNull(),
  sizeLabel: varchar("sizeLabel", { length: 40 }).notNull(),
  contextWindow: int("contextWindow"),
  description: text("description"),
  tags: json("tags"),
  baseFeeInr: int("baseFeeInr").default(0).notNull(),
  hourlyRateInr: decimal("hourlyRateInr", { precision: 10, scale: 2 }).default("0.00").notNull(),
  throughputMbPerHour: decimal("throughputMbPerHour", { precision: 10, scale: 2 }).default("4.00").notNull(),
  metadata: json("metadata"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const trainingJobs = mysqlTable("trainingJobs", {
  id: varchar("id", { length: 48 }).primaryKey(),
  displayId: varchar("displayId", { length: 48 }).notNull(),
  userId: int("userId").notNull(),
  receiverId: varchar("receiverId", { length: 48 }).notNull(),
  baseModelId: varchar("baseModelId", { length: 80 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  status: mysqlEnum("status", [
    "draft", "awaiting_payment", "awaiting_receiver", "queued", "provisioning", "loading_dataset", "running", "paused", "cancelling", "completed", "failed", "cancelled",
  ]).default("awaiting_payment").notNull(),
  provider: varchar("provider", { length: 40 }).default("runpod").notNull(),
  trainingMode: mysqlEnum("trainingMode", ["single", "distributed"]).default("single").notNull(),
  synchronizationStrategy: mysqlEnum("synchronizationStrategy", ["per_step", "adaptive"]),
  config: json("config").notNull(),
  metrics: json("metrics"),
  datasetName: varchar("datasetName", { length: 255 }),
  datasetKey: varchar("datasetKey", { length: 512 }),
  datasetUrl: text("datasetUrl"),
  estimatedCost: decimal("estimatedCost", { precision: 12, scale: 2 }),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("trainingJobs_displayId_unique").on(table.displayId),
  index("trainingJobs_user_status_idx").on(table.userId, table.status),
  index("trainingJobs_receiver_status_idx").on(table.receiverId, table.status),
]);

export const jobAssignments = mysqlTable("jobAssignments", {
  id: varchar("id", { length: 48 }).primaryKey(),
  jobId: varchar("jobId", { length: 48 }).notNull(),
  receiverId: varchar("receiverId", { length: 48 }).notNull(),
  shardIndex: int("shardIndex").notNull(),
  shardCount: int("shardCount").notNull(),
  status: mysqlEnum("status", ["reserved", "awaiting_acceptance", "queued", "running", "completed", "failed", "released"]).default("reserved").notNull(),
  checkpointKey: varchar("checkpointKey", { length: 512 }),
  acceptedAt: timestamp("acceptedAt"),
  datasetDownloadStartedAt: timestamp("datasetDownloadStartedAt"),
  datasetDownloadCompletedAt: timestamp("datasetDownloadCompletedAt"),
  lastHeartbeatAt: timestamp("lastHeartbeatAt"),
  failureReason: text("failureReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("jobAssignments_job_receiver_unique").on(table.jobId, table.receiverId),
  index("jobAssignments_receiver_status_idx").on(table.receiverId, table.status),
  index("jobAssignments_job_idx").on(table.jobId),
]);

export const jobEvents = mysqlTable("jobEvents", {
  id: varchar("id", { length: 48 }).primaryKey(),
  jobId: varchar("jobId", { length: 48 }).notNull(),
  status: varchar("status", { length: 40 }),
  type: varchar("type", { length: 64 }).notNull(),
  message: text("message"),
  payload: json("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("jobEvents_job_created_idx").on(table.jobId, table.createdAt)]);

export const trainedModels = mysqlTable("trainedModels", {
  id: varchar("id", { length: 48 }).primaryKey(),
  userId: int("userId").notNull(),
  jobId: varchar("jobId", { length: 48 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  baseModel: varchar("baseModel", { length: 180 }).notNull(),
  method: varchar("method", { length: 40 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  artifactKey: varchar("artifactKey", { length: 512 }),
  artifactUrl: text("artifactUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("trainedModels_jobId_unique").on(table.jobId), index("trainedModels_user_created_idx").on(table.userId, table.createdAt)]);

export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 48 }).primaryKey(),
  userId: int("userId").notNull(),
  jobId: varchar("jobId", { length: 48 }),
  type: mysqlEnum("type", ["info", "success", "warning", "error"]).default("info").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("notifications_user_read_idx").on(table.userId, table.readAt, table.createdAt)]);

export const settlementRecords = mysqlTable("settlementRecords", {
  id: varchar("id", { length: 48 }).primaryKey(),
  jobId: varchar("jobId", { length: 48 }).notNull(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  status: mysqlEnum("status", ["pending", "authorized", "settled", "refunded", "failed"]).default("pending").notNull(),
  externalReference: varchar("externalReference", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("settlementRecords_jobId_unique").on(table.jobId), index("settlementRecords_user_status_idx").on(table.userId, table.status)]);

export const providerExecutions = mysqlTable("providerExecutions", {
  id: varchar("id", { length: 48 }).primaryKey(),
  jobId: varchar("jobId", { length: 48 }).notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  providerJobId: varchar("providerJobId", { length: 160 }),
  endpointId: varchar("endpointId", { length: 160 }),
  callbackTokenHash: varchar("callbackTokenHash", { length: 128 }).notNull(),
  lastProviderStatus: varchar("lastProviderStatus", { length: 80 }),
  lastPayload: json("lastPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("providerExecutions_jobId_unique").on(table.jobId),
  uniqueIndex("providerExecutions_provider_job_unique").on(table.provider, table.providerJobId),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
