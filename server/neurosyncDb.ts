import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import {
  baseModels,
  jobAssignments,
  jobEvents,
  notifications,
  providerExecutions,
  receiverHeartbeats,
  receivers,
  settlementRecords,
  trainedModels,
  trainingJobs,
  userMemberships,
  userProfiles,
} from "../drizzle/schema";
import { getDb } from "./db";

export type JobStatus =
  | "draft" | "awaiting_payment" | "awaiting_receiver" | "queued" | "provisioning" | "loading_dataset"
  | "running" | "paused" | "cancelling" | "completed" | "failed" | "cancelled";

const id = (prefix: string) => `${prefix}_${nanoid(18)}`;

const DEFAULT_BASE_MODELS = [
  { id: "llama-3.2", name: "Llama 3.2", provider: "Meta", sizeLabel: "3B", contextWindow: 128000, description: "Efficient multilingual model well suited for instruction tuning and assistants.", tags: ["multilingual", "instruction"], baseFeeInr: 140, hourlyRateInr: "40.00", throughputMbPerHour: "5.50", metadata: { architecture: "Decoder-only Transformer", license: "Llama 3.2 Community License", recommendedVram: "12 GB", useCases: ["Chat assistants", "Summarization", "Multilingual tasks"], storageSize: "6.4 GB" } },
  { id: "mistral-7b", name: "Mistral 7B", provider: "Mistral AI", sizeLabel: "7B", contextWindow: 32000, description: "High-performance dense model with strong reasoning for its size.", tags: ["reasoning", "code"], baseFeeInr: 260, hourlyRateInr: "55.00", throughputMbPerHour: "3.80", metadata: { architecture: "Decoder-only Transformer (GQA + SWA)", license: "Apache 2.0", recommendedVram: "16 GB", useCases: ["Reasoning", "Code assistance", "General instruction following"], storageSize: "14.5 GB" } },
  { id: "gemma-2b", name: "Gemma 2B", provider: "Google", sizeLabel: "2B", contextWindow: 8000, description: "Lightweight open model designed for fast, low-resource fine-tuning. RTX 4090 24 GB reference run: 10–15 minutes.", tags: ["lightweight", "edge"], baseFeeInr: 120, hourlyRateInr: "35.00", throughputMbPerHour: "6.50", metadata: { architecture: "Decoder-only Transformer", license: "Gemma Terms of Use", recommendedVram: "8 GB", useCases: ["Edge deployment", "Classification", "Lightweight assistants"], storageSize: "4.9 GB", referenceHardware: "RTX 4090 · 24 GB", referenceFineTuneTime: "10–15 min" } },
  { id: "gemma-7b", name: "Gemma 7B", provider: "Google", sizeLabel: "7B", contextWindow: 8000, description: "Capable mid-size open model balancing quality and hardware requirements.", tags: ["instruction", "generation"], baseFeeInr: 240, hourlyRateInr: "55.00", throughputMbPerHour: "3.80", metadata: { architecture: "Decoder-only Transformer", license: "Gemma Terms of Use", recommendedVram: "18 GB", useCases: ["Instruction tuning", "Content generation", "Q&A"], storageSize: "15.6 GB" } },
  { id: "phi-3-mini", name: "Phi-3 Mini", provider: "Microsoft", sizeLabel: "3.8B", contextWindow: 128000, description: "Compact model with strong reasoning trained on high-quality curated data.", tags: ["reasoning", "compact"], baseFeeInr: 160, hourlyRateInr: "42.00", throughputMbPerHour: "5.00", metadata: { architecture: "Decoder-only Transformer", license: "MIT", recommendedVram: "10 GB", useCases: ["Reasoning", "Math", "Compact deployments"], storageSize: "7.6 GB" } },
  { id: "qwen-2.5", name: "Qwen 2.5", provider: "Alibaba", sizeLabel: "7B", contextWindow: 128000, description: "Versatile multilingual model with excellent coding and math capabilities.", tags: ["coding", "multilingual"], baseFeeInr: 280, hourlyRateInr: "58.00", throughputMbPerHour: "3.80", metadata: { architecture: "Decoder-only Transformer", license: "Apache 2.0", recommendedVram: "16 GB", useCases: ["Coding", "Math", "Multilingual generation"], storageSize: "15.1 GB" } },
] as const;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

async function ensureCatalogBootstrap() {
  const db = await requireDb();
  const [storedModel] = await db.select({ id: baseModels.id }).from(baseModels).limit(1);
  if (!storedModel) await db.insert(baseModels).values([...DEFAULT_BASE_MODELS]);
  for (const model of DEFAULT_BASE_MODELS) {
    await db.update(baseModels).set({ baseFeeInr: model.baseFeeInr, hourlyRateInr: model.hourlyRateInr, metadata: model.metadata, description: model.description }).where(eq(baseModels.id, model.id));
  }
}

const HEARTBEAT_TTL_MS = 45_000;
const RESERVATION_TTL_MS = 15 * 60_000;
const priceInBand = (value: number) => Math.max(30, Math.min(60, Math.round(value * 100) / 100));
const TERMINAL_JOB_STATUSES: JobStatus[] = ["completed", "failed", "cancelled"];
const PRE_DISPATCH_JOB_STATUSES: JobStatus[] = ["awaiting_payment", "awaiting_receiver"];

export function shouldReleaseReceiverReservation(input: { activeJobId: string | null; reservationExpiresAt: Date | null }, jobStatus?: JobStatus, now = new Date()) {
  if (!input.activeJobId || !jobStatus || TERMINAL_JOB_STATUSES.includes(jobStatus)) return true;
  const reservationExpired = Boolean(input.reservationExpiresAt && input.reservationExpiresAt.getTime() <= now.getTime());
  return reservationExpired && PRE_DISPATCH_JOB_STATUSES.includes(jobStatus);
}

async function reconcileReceiverCoordinatorState(db: Awaited<ReturnType<typeof requireDb>>, receiver: typeof receivers.$inferSelect) {
  const clearReservation = async () => {
    await db.transaction(async tx => {
      await tx.update(receivers).set({ availability: "available", activeJobId: null, reservationExpiresAt: null })
        .where(and(eq(receivers.id, receiver.id), receiver.activeJobId ? eq(receivers.activeJobId, receiver.activeJobId) : isNull(receivers.activeJobId)));
    });
    const [recovered] = await db.select().from(receivers).where(eq(receivers.id, receiver.id)).limit(1);
    return recovered ?? receiver;
  };

  const expirePreDispatchReservation = async () => {
    if (!receiver.activeJobId) return receiver;
    const now = new Date();
    let released = false;
    await db.transaction(async tx => {
      // Re-read and guard the job inside this transaction. If payment or manual
      // acceptance advanced it to active work, affectedRows is zero and nothing
      // else may release the receiver or its assignment.
      const [liveJob] = await tx.select({ status: trainingJobs.status }).from(trainingJobs)
        .where(eq(trainingJobs.id, receiver.activeJobId!)).limit(1);
      const liveStatus = liveJob?.status as JobStatus | undefined;
      if (!shouldReleaseReceiverReservation(receiver, liveStatus, now) || !liveStatus || !PRE_DISPATCH_JOB_STATUSES.includes(liveStatus)) return;
      const result = await tx.update(trainingJobs).set({ status: "cancelled", completedAt: now })
        .where(and(
          eq(trainingJobs.id, receiver.activeJobId!),
          or(eq(trainingJobs.status, "awaiting_payment"), eq(trainingJobs.status, "awaiting_receiver")),
        ));
      const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
      if (affectedRows !== 1) return;
      await tx.update(jobAssignments).set({ status: "released" }).where(eq(jobAssignments.jobId, receiver.activeJobId!));
      await tx.update(receivers).set({ availability: "available", activeJobId: null, reservationExpiresAt: null })
        .where(and(eq(receivers.id, receiver.id), eq(receivers.activeJobId, receiver.activeJobId!)));
      await tx.insert(jobEvents).values({
        id: id("evt"), jobId: receiver.activeJobId!, type: "job.reservation_expired", status: "cancelled",
        message: "Receiver reservation expired before dispatch; select an available receiver and start a new job.",
      });
      released = true;
    });
    if (!released) return receiver;
    const [recovered] = await db.select().from(receivers).where(eq(receivers.id, receiver.id)).limit(1);
    return recovered ?? receiver;
  };

  // A Busy flag without an assignment is never coordinator-owned. Clear it on the
  // next receiver read or heartbeat instead of allowing an old browser state to latch.
  if (!receiver.activeJobId) {
    return receiver.availability === "busy" ? clearReservation() : receiver;
  }

  const [job] = await db.select({ status: trainingJobs.status }).from(trainingJobs)
    .where(eq(trainingJobs.id, receiver.activeJobId)).limit(1);
  const jobStatus = job?.status as JobStatus | undefined;
  if (!job || TERMINAL_JOB_STATUSES.includes(jobStatus!)) {
    return clearReservation();
  }
  if (shouldReleaseReceiverReservation(receiver, jobStatus)) {
    return expirePreDispatchReservation();
  }
  return receiver;
}

function publicReceiverState(receiver: typeof receivers.$inferSelect, now = new Date()) {
  const expiredReservation = receiver.reservationExpiresAt && receiver.reservationExpiresAt.getTime() < now.getTime();
  const staleHeartbeat = receiver.ownerId && (!receiver.lastHeartbeatAt || now.getTime() - receiver.lastHeartbeatAt.getTime() > HEARTBEAT_TTL_MS);
  const availability = receiver.activeJobId && !expiredReservation
    ? "busy"
    : staleHeartbeat
      ? "offline"
      : receiver.availability;
  const capabilities = receiver.capabilities && typeof receiver.capabilities === "object" ? receiver.capabilities as Record<string, unknown> : {};
  return { ...receiver, availability, isLive: Boolean(receiver.ownerId), lastSeenAt: receiver.lastHeartbeatAt, capabilities: { ...capabilities, activity: availability === "busy" ? "Reserved for a NeuroSync job" : staleHeartbeat ? "Receiver heartbeat expired" : capabilities.activity ?? "Live receiver heartbeat" } };
}

export async function getOrCreateProfile(userId: number) {
  const db = await requireDb();
  const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (existing) return existing;
  await db.insert(userProfiles).values({ userId, workspaceRole: "sender" });
  const [created] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return created!;
}

export async function setWorkspaceRole(userId: number, workspaceRole: "sender" | "receiver" | "both") {
  const db = await requireDb();
  await getOrCreateProfile(userId);
  await db.update(userProfiles).set({ workspaceRole }).where(eq(userProfiles.userId, userId));
  return getOrCreateProfile(userId);
}

export async function updateProfilePreferences(userId: number, preferences: Record<string, unknown>) {
  const db = await requireDb();
  await getOrCreateProfile(userId);
  await db.update(userProfiles).set({ preferences }).where(eq(userProfiles.userId, userId));
  return getOrCreateProfile(userId);
}

export async function listReceiversForUser(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(receivers).where(and(isNotNull(receivers.ownerId), or(eq(receivers.ownerId, userId), eq(receivers.isDirectoryVisible, true)))).orderBy(desc(receivers.updatedAt));
  const reconciled = await Promise.all(rows.map(receiver => reconcileReceiverCoordinatorState(db, receiver)));
  return reconciled.map(receiver => publicReceiverState(receiver));
}

/** Resolves an authenticated user's Electron-managed receiver without treating a browser tab as a hardware source. */
export async function getDesktopReceiverForUser(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(receivers)
    .where(eq(receivers.ownerId, userId))
    .orderBy(desc(receivers.updatedAt));
  const desktopReceiver = rows.find((receiver) => {
    const capabilities = (receiver.capabilities as Record<string, unknown> | null) ?? {};
    return capabilities.reportSource === 'desktop_receiver_native_runtime'
      || Boolean(capabilities.desktopHardwareProfile);
  });
  if (!desktopReceiver) return undefined;
  return publicReceiverState(await reconcileReceiverCoordinatorState(db, desktopReceiver));
}

export async function getMembership(userId: number) {
  const db = await requireDb();
  const [existing] = await db.select().from(userMemberships).where(eq(userMemberships.userId, userId)).limit(1);
  if (existing) return existing;
  const membership = { id: id("member"), userId, plan: "free" as const, entitlementSource: "workspace" };
  await db.insert(userMemberships).values(membership);
  const [created] = await db.select().from(userMemberships).where(eq(userMemberships.userId, userId)).limit(1);
  return created!;
}

export async function activatePremiumTrial(userId: number) {
  const db = await requireDb();
  const existing = await getMembership(userId);
  if (existing.plan === "premium" && ["active", "trialing"].includes(existing.status)) return existing;
  if (existing.stripeSubscriptionId) {
    throw new Error("This workspace has a Stripe subscription. Manage it from Premium & billing instead of starting a trial.");
  }
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60_000);
  await db.update(userMemberships).set({
    plan: "premium",
    status: "trialing",
    entitlementSource: "workspace_trial",
    trialEndsAt,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  }).where(eq(userMemberships.userId, userId));
  return getMembership(userId);
}

export async function cancelPremiumTrial(userId: number) {
  const db = await requireDb();
  const membership = await getMembership(userId);
  if (membership.status !== "trialing" || membership.entitlementSource !== "workspace_trial") {
    throw new Error("Only an active workspace trial can be revoked here. Use Stripe billing management for a paid membership.");
  }
  await db.update(userMemberships).set({
    plan: "free",
    status: "cancelled",
    entitlementSource: "workspace_trial_cancelled",
    trialEndsAt: new Date(),
  }).where(eq(userMemberships.userId, userId));
  return getMembership(userId);
}

export async function setPremiumMembership(input: {
  userId: number;
  status?: "active" | "trialing" | "past_due" | "cancelled";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  entitlementSource?: string;
}) {
  const db = await requireDb();
  await getMembership(input.userId);
  await db.update(userMemberships).set({
    plan: input.status === "cancelled" ? "free" : "premium",
    status: input.status ?? "active",
    entitlementSource: input.entitlementSource ?? "stripe_checkout",
    stripeCustomerId: input.stripeCustomerId ?? undefined,
    stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
  }).where(eq(userMemberships.userId, input.userId));
  return getMembership(input.userId);
}

export async function registerOrUpdateReceiver(input: {
  userId: number; deviceFingerprint: string; name: string; gpu: string; vramGb: number;
  pricePerHour: number; capabilities?: Record<string, unknown>; isDirectoryVisible: boolean;
}) {
  const db = await requireDb();
  const now = new Date();
  const [existing] = await db.select().from(receivers).where(and(eq(receivers.ownerId, input.userId), eq(receivers.deviceFingerprint, input.deviceFingerprint))).limit(1);
  const existingCapabilities = (existing?.capabilities as Record<string, unknown> | null) ?? {};
  const capabilities = { ...existingCapabilities, ...(input.capabilities ?? {}) };
  const browserDetection = input.capabilities?.browserGpuDetection as Record<string, unknown> | undefined;
  const browserModelIsUnavailable = browserDetection?.softwareRenderer === true
    || browserDetection?.exactModelAvailable !== true;
  // Browser capability information belongs in JSON metadata. A fallback renderer
  // such as Microsoft Basic Render Driver must never become canonical hardware.
  const canonicalGpu = browserModelIsUnavailable && !String(input.gpu || '').toLowerCase().includes('nvidia')
    ? 'Physical GPU not exposed'
    : input.gpu;
  const values = {
    name: input.name,
    gpu: canonicalGpu,
    // A browser cannot reliably inspect a host NVIDIA adapter. Zero means
    // explicitly unavailable, not a guessed one-gigabyte device.
    vramGb: Math.max(0, Math.min(512, Math.round(input.vramGb))),
    pricePerHour: priceInBand(input.pricePerHour).toFixed(2),
    capabilities,
    availability: "available" as const,
    isDirectoryVisible: input.isDirectoryVisible,
    lastHeartbeatAt: now,
  };
  if (existing) {
    await db.update(receivers).set(values).where(eq(receivers.id, existing.id));
    const [updated] = await db.select().from(receivers).where(eq(receivers.id, existing.id)).limit(1);
    return publicReceiverState(updated!);
  }
  const receiver = { id: id("receiver"), ownerId: input.userId, deviceFingerprint: input.deviceFingerprint, ...values };
  await db.insert(receivers).values(receiver);
  return publicReceiverState(receiver as typeof receivers.$inferSelect);
}

export async function heartbeatReceiver(input: { userId: number; receiverId: string; availability: "available" | "busy" | "maintenance"; capabilities?: Record<string, unknown>; clientTimestamp?: Date }) {
  const db = await requireDb();
  const [receiver] = await db.select().from(receivers).where(and(eq(receivers.id, input.receiverId), eq(receivers.ownerId, input.userId))).limit(1);
  if (!receiver) return undefined;
  const now = new Date();
  const reconciled = await reconcileReceiverCoordinatorState(db, receiver);
  const resolvedAvailability = reconciled.activeJobId ? "busy" : input.availability;
  const currentCapabilities = (reconciled.capabilities as Record<string, unknown> | null) ?? {};
  const capabilities = { ...currentCapabilities, ...(input.capabilities ?? {}) };
  const telemetry = capabilities.verifiedGpuTelemetry as Record<string, unknown> | null | undefined;
  const verifiedSource = telemetry?.source === "nvidia-smi" || telemetry?.source === "desktop_native_nvidia_smi";
  const verifiedModel = telemetry?.verified === true && verifiedSource && typeof telemetry.model === "string" && telemetry.model.trim();
  const verifiedVram = Number(telemetry?.vramGb);
  // Only an explicitly verified local-agent or Electron-native nvidia-smi
  // report can promote directory hardware. Browser state and disconnected
  // runtime values never overwrite this record with guessed or user-entered GPU data.
  const verifiedHardware = verifiedModel && Number.isFinite(verifiedVram) && verifiedVram > 0
    ? { gpu: telemetry!.model as string, vramGb: Math.min(512, Math.round(verifiedVram)) }
    : {};
  await db.update(receivers).set({ availability: resolvedAvailability, capabilities, lastHeartbeatAt: now, ...verifiedHardware }).where(eq(receivers.id, reconciled.id));
  await db.insert(receiverHeartbeats).values({ id: id("beat"), receiverId: reconciled.id, reportedAvailability: resolvedAvailability, capabilities: input.capabilities, clientTimestamp: input.clientTimestamp });
  const [updated] = await db.select().from(receivers).where(eq(receivers.id, reconciled.id)).limit(1);
  return publicReceiverState(updated!);
}

export async function getReceiverCoordinatorState(userId: number, receiverId: string) {
  const db = await requireDb();
  const [receiver] = await db.select().from(receivers)
    .where(and(eq(receivers.id, receiverId), eq(receivers.ownerId, userId)))
    .limit(1);
  return receiver ? publicReceiverState(await reconcileReceiverCoordinatorState(db, receiver)) : undefined;
}

export async function updateReceiverAcceptanceMode(userId: number, receiverId: string, acceptanceMode: "auto" | "manual") {
  const db = await requireDb();
  const [receiver] = await db.select().from(receivers).where(and(eq(receivers.id, receiverId), eq(receivers.ownerId, userId))).limit(1);
  if (!receiver) throw new Error("Receiver enrollment was not found for this account.");
  const capabilities = { ...((receiver.capabilities as Record<string, unknown>) ?? {}), acceptanceMode };
  await db.update(receivers).set({ capabilities }).where(eq(receivers.id, receiverId));
  const [updated] = await db.select().from(receivers).where(eq(receivers.id, receiverId)).limit(1);
  return publicReceiverState(updated!);
}

export async function retireReceiver(userId: number, receiverId: string) {
  const db = await requireDb();
  const [receiver] = await db.select().from(receivers).where(and(eq(receivers.id, receiverId), eq(receivers.ownerId, userId))).limit(1);
  if (!receiver) throw new Error("Receiver not found for this workspace.");
  if (receiver.activeJobId) throw new Error("A receiver with an active job cannot be retired.");
  await db.delete(receivers).where(eq(receivers.id, receiverId));
  return { receiverId };
}

export async function listReceiverAssignments(jobId: string) {
  const db = await requireDb();
  return db.select().from(jobAssignments).where(eq(jobAssignments.jobId, jobId)).orderBy(jobAssignments.shardIndex);
}

export async function listAssignedJobsForReceiver(userId: number, receiverId: string) {
  const db = await requireDb();
  const [receiver] = await db.select({ id: receivers.id }).from(receivers).where(and(eq(receivers.id, receiverId), eq(receivers.ownerId, userId))).limit(1);
  if (!receiver) return [];
  // Receiver-side polling is a first-class simulation clock. Without this,
  // telemetry only advances when the sender happens to keep a dashboard open.
  const ownerRows = await db.selectDistinct({ userId: trainingJobs.userId })
    .from(jobAssignments)
    .innerJoin(trainingJobs, eq(trainingJobs.id, jobAssignments.jobId))
    .where(eq(jobAssignments.receiverId, receiverId));
  await Promise.all(ownerRows.map(({ userId: ownerId }) => advanceSimulatedJobsForUser(ownerId)));
  return db.select({ assignment: jobAssignments, job: trainingJobs })
    .from(jobAssignments)
    .innerJoin(trainingJobs, eq(trainingJobs.id, jobAssignments.jobId))
    .where(eq(jobAssignments.receiverId, receiverId))
    .orderBy(desc(trainingJobs.updatedAt));
}

type ReceiverPayoutRow = {
  assignment: { shardCount: unknown };
  receiver: { pricePerHour: unknown };
  job: { config: unknown; estimatedCost: unknown; metrics: unknown };
};

// The overview, terminal history, and analytics all consume this one persisted
// pricing calculation. Client code receives results and never recomputes payout.
export function calculateReceiverPayout(row: ReceiverPayoutRow) {
  const pricing = ((row.job.config as Record<string, unknown> | null)?.pricing ?? {}) as Record<string, unknown>;
  const shardCount = Math.max(1, Number(row.assignment.shardCount) || 1);
  const baseFee = Math.max(0, Number(pricing.basePriceInr ?? row.job.estimatedCost ?? 0));
  const estimatedHours = Math.max(0, Number(pricing.estimatedHours ?? 0));
  const senderUsageEstimate = Math.max(0, Number(pricing.finalPaymentInr ?? estimatedHours * Number(row.receiver.pricePerHour)));
  const basePayout = (baseFee * 0.7) / shardCount;
  const usagePayout = (senderUsageEstimate * 0.6) / shardCount;
  const progressFraction = Math.max(0, Math.min(1, Number(((row.job.metrics as Record<string, unknown> | null)?.progress ?? 0)) / 100));
  return { accrued: basePayout + usagePayout * progressFraction, projected: basePayout + usagePayout };
}

export async function getReceiverEarnings(userId: number, receiverId: string) {
  const db = await requireDb();
  const rows = await db.select({
    assignment: jobAssignments,
    receiver: receivers,
    job: trainingJobs,
  }).from(jobAssignments)
    .innerJoin(receivers, eq(receivers.id, jobAssignments.receiverId))
    .innerJoin(trainingJobs, eq(trainingJobs.id, jobAssignments.jobId))
    .where(and(eq(receivers.id, receiverId), eq(receivers.ownerId, userId)));
  const completedRows = rows.filter((row) => row.job.status === "completed");
  const activeRows = rows.filter((row) => ["queued", "provisioning", "loading_dataset", "running", "paused"].includes(row.job.status));
  const totalEarned = completedRows.reduce((sum, row) => sum + calculateReceiverPayout(row).projected, 0);
  const active = activeRows.reduce((summary, row) => {
    const payout = calculateReceiverPayout(row);
    return {
      accrued: summary.accrued + payout.accrued,
      projected: summary.projected + payout.projected,
    };
  }, { accrued: 0, projected: 0 });
  return {
    completedAssignments: completedRows.length,
    activeAssignments: activeRows.length,
    totalEarned: Number(totalEarned.toFixed(2)),
    accruedActiveEarnings: Number(active.accrued.toFixed(2)),
    projectedActiveEarnings: Number(active.projected.toFixed(2)),
  };
}

export async function listReceiverHistory(userId: number, receiverId: string) {
  const db = await requireDb();
  const rows = await db.select({ assignment: jobAssignments, receiver: receivers, job: trainingJobs })
    .from(jobAssignments)
    .innerJoin(receivers, eq(receivers.id, jobAssignments.receiverId))
    .innerJoin(trainingJobs, eq(trainingJobs.id, jobAssignments.jobId))
    .where(and(eq(receivers.id, receiverId), eq(receivers.ownerId, userId)))
    .orderBy(desc(trainingJobs.updatedAt));
  return rows
    .filter((row) => TERMINAL_JOB_STATUSES.includes(row.job.status as JobStatus))
    .map((row) => ({ ...row, payout: calculateReceiverPayout(row) }));
}

export async function getReceiverAnalytics(userId: number, receiverId: string, range: "7d" | "30d" | "all") {
  const db = await requireDb();
  const rows = await db.select({ assignment: jobAssignments, receiver: receivers, job: trainingJobs })
    .from(jobAssignments)
    .innerJoin(receivers, eq(receivers.id, jobAssignments.receiverId))
    .innerJoin(trainingJobs, eq(trainingJobs.id, jobAssignments.jobId))
    .where(and(eq(receivers.id, receiverId), eq(receivers.ownerId, userId)));
  const now = new Date();
  const utcDay = (value: Date) => value.toISOString().slice(0, 10);
  const today = utcDay(now);
  const startOfToday = new Date(`${today}T00:00:00.000Z`);
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  weekStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const terminal = rows.filter((row) => TERMINAL_JOB_STATUSES.includes(row.job.status as JobStatus));
  const completed = terminal.filter((row) => row.job.status === "completed");
  const completionDate = (row: typeof rows[number]) => row.job.completedAt ?? row.job.updatedAt;
  const payout = (row: typeof rows[number]) => calculateReceiverPayout(row).projected;
  const sumSince = (start: Date) => completed.filter((row) => completionDate(row) >= start).reduce((sum, row) => sum + payout(row), 0);
  const lifetime = completed.reduce((sum, row) => sum + payout(row), 0);
  const rangeStart = range === "7d" ? weekStart : range === "30d" ? new Date(now.getTime() - 29 * 86_400_000) : null;
  const values = new Map<string, number>();
  completed.forEach((row) => {
    const completedAt = completionDate(row);
    if (rangeStart && completedAt < rangeStart) return;
    const key = utcDay(completedAt);
    values.set(key, (values.get(key) || 0) + payout(row));
  });
  const elapsedSeconds = completed.reduce((sum, row) => sum + Math.max(0, Number((row.job.metrics as Record<string, unknown> | null)?.elapsedSec ?? 0)), 0);
  const failedJobs = terminal.filter((row) => row.job.status === "failed").length;
  return {
    timezone: "UTC",
    summary: {
      today: Number(sumSince(startOfToday).toFixed(2)),
      week: Number(sumSince(weekStart).toFixed(2)),
      month: Number(sumSince(monthStart).toFixed(2)),
      lifetime: Number(lifetime.toFixed(2)),
    },
    timeline: Array.from(values.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, earnings]) => ({ date, earnings: Number(earnings.toFixed(2)) })),
    stats: {
      totalJobs: rows.length,
      completedJobs: completed.length,
      failedJobs,
      averageJobDurationSec: completed.length ? Math.round(elapsedSeconds / completed.length) : 0,
      totalComputeTimeSec: Math.round(elapsedSeconds),
      averageEarningsPerJob: Number((completed.length ? lifetime / completed.length : 0).toFixed(2)),
      successRate: Number((terminal.length ? (completed.length / terminal.length) * 100 : 0).toFixed(1)),
    },
  };
}

export async function listBaseModels() {
  await ensureCatalogBootstrap();
  const db = await requireDb();
  return db.select().from(baseModels).where(eq(baseModels.isActive, true));
}

export async function getJobForUser(jobId: string, userId: number) {
  const db = await requireDb();
  const [job] = await db.select().from(trainingJobs).where(and(eq(trainingJobs.id, jobId), eq(trainingJobs.userId, userId))).limit(1);
  return job;
}

export async function listJobsForUser(userId: number) {
  const db = await requireDb();
  const jobs = await db.select().from(trainingJobs).where(eq(trainingJobs.userId, userId)).orderBy(desc(trainingJobs.createdAt));
  return Promise.all(jobs.map(async job => {
    const events = await db.select().from(jobEvents).where(eq(jobEvents.jobId, job.id)).orderBy(jobEvents.createdAt);
    const createdAtMs = job.createdAt.getTime();
    const logs = events.map(event => ({
      atSec: Math.max(0, (event.createdAt.getTime() - createdAtMs) / 1000),
      level: event.type.includes("failed") || event.type.includes("cancel") ? "warn" : event.status === "completed" ? "success" : "info",
      message: event.message ?? event.type,
    }));
    return { ...job, logs };
  }));
}

export async function listJobEvents(jobId: string, userId: number) {
  const job = await getJobForUser(jobId, userId);
  if (!job) return undefined;
  const db = await requireDb();
  return db.select().from(jobEvents).where(eq(jobEvents.jobId, jobId)).orderBy(desc(jobEvents.createdAt));
}

export async function createTrainingJob(input: {
  userId: number; name: string; receiverId: string; receiverIds?: string[]; baseModelId: string; config: unknown;
  datasetName?: string; datasetKey?: string; datasetUrl?: string; estimatedCost?: string; provider?: string;
  trainingMode?: "single" | "distributed"; synchronizationStrategy?: "per_step" | "adaptive";
}) {
  const db = await requireDb();
  const jobId = id("job");
  const displayId = `JOB-${nanoid(8).toUpperCase()}`;
  const trainingMode = input.trainingMode ?? "single";
  const receiverIds = Array.from(new Set(trainingMode === "distributed" ? input.receiverIds ?? [] : [input.receiverId]));
  if (!receiverIds.length) throw new Error("Select at least one available receiver.");
  if (trainingMode === "distributed" && receiverIds.length < 2) throw new Error("Distributed training requires at least two available receivers.");
  const submittedConfig = input.config && typeof input.config === "object" && !Array.isArray(input.config)
    ? input.config as Record<string, unknown>
    : {};
  const distributedTopology = trainingMode === "distributed"
    ? {
      version: 1,
      synchronizationStrategy: input.synchronizationStrategy ?? "adaptive",
      partitionPlan: {
        strategy: "balanced_logical_shards",
        shardCount: receiverIds.length,
        description: "The coordinator assigns an equal logical dataset shard to each receiver before dispatch.",
      },
      assignments: receiverIds.map((receiverId, shardIndex) => ({
        receiverId,
        shardIndex,
        shardCount: receiverIds.length,
        checkpointKey: `coordination/${jobId}/shard-${shardIndex}/latest.json`,
      })),
      recoveryPolicy: {
        onWorkerFailure: "pause_and_reassign_from_latest_coordinator_checkpoint",
        checkpointAuthority: "coordinator",
        retryBudget: 1,
      },
    }
    : undefined;
  const job = {
    id: jobId,
    displayId,
    userId: input.userId,
    name: input.name,
    receiverId: input.receiverId,
    baseModelId: input.baseModelId,
    config: distributedTopology ? { ...submittedConfig, distributedTopology } : submittedConfig,
    datasetName: input.datasetName,
    datasetKey: input.datasetKey,
    datasetUrl: input.datasetUrl,
    estimatedCost: input.estimatedCost,
    provider: input.provider ?? "runpod",
    trainingMode,
    synchronizationStrategy: trainingMode === "distributed" ? input.synchronizationStrategy ?? "adaptive" : undefined,
    status: "awaiting_payment" as const,
  };
  const now = new Date();
  const reservationExpiresAt = new Date(now.getTime() + RESERVATION_TTL_MS);
  await db.transaction(async tx => {
    for (const receiverId of receiverIds) {
      const result = await tx.update(receivers).set({
        availability: "busy",
        activeJobId: jobId,
        reservationExpiresAt,
      }).where(and(eq(receivers.id, receiverId), eq(receivers.availability, "available"), isNull(receivers.activeJobId)));
      const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
      if (affectedRows !== 1) throw new Error(`Receiver ${receiverId} is no longer available. Refresh the network directory and select another device.`);
    }
    await tx.insert(trainingJobs).values(job);
    await tx.insert(jobAssignments).values(receiverIds.map((receiverId, shardIndex) => ({
      id: id("assign"), jobId, receiverId, shardIndex, shardCount: receiverIds.length, status: "reserved" as const,
      checkpointKey: trainingMode === "distributed" ? `coordination/${jobId}/shard-${shardIndex}/latest.json` : undefined,
      lastHeartbeatAt: now,
    })));
    await tx.insert(jobEvents).values({
      id: id("evt"), jobId, type: "job.receivers_reserved", status: "awaiting_payment",
      message: `${receiverIds.length} receiver${receiverIds.length === 1 ? "" : "s"} reserved for ${trainingMode === "distributed" ? "distributed" : "single-GPU"} training.`,
      payload: { receiverIds, reservationExpiresAt, synchronizationStrategy: job.synchronizationStrategy, distributedTopology },
    });
  });
  return getJobForUser(jobId, input.userId);
}

/**
 * Records the post-settlement receiver offer. The receiver reservation remains
 * coordinator-owned, but no provider or simulation execution is allowed to
 * begin until every selected receiver has accepted and completed delivery.
 */
export async function offerReceiverJob(jobId: string, userId: number) {
  const db = await requireDb();
  await db.transaction(async tx => {
    const [job] = await tx.select().from(trainingJobs)
      .where(and(eq(trainingJobs.id, jobId), eq(trainingJobs.userId, userId)))
      .limit(1);
    if (!job) throw new Error("Training job not found.");
    if (job.status === "awaiting_receiver") return;
    if (job.status !== "awaiting_payment") {
      throw new Error("This job is not awaiting settlement.");
    }
    const result = await tx.update(trainingJobs).set({ status: "awaiting_receiver" })
      .where(and(eq(trainingJobs.id, jobId), eq(trainingJobs.status, "awaiting_payment")));
    const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
    if (affectedRows !== 1) throw new Error("The job settlement state changed; refresh and try again.");
    await tx.update(jobAssignments).set({ status: "awaiting_acceptance" })
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.status, "reserved")));
    await tx.insert(jobEvents).values({
      id: id("evt"), jobId, type: "job.receiver_offer_created", status: "awaiting_receiver",
      message: "Settlement confirmed. A receiver offer is awaiting explicit acceptance before dataset delivery and dispatch.",
    });
  });
  return getJobForUser(jobId, userId);
}

/**
 * Atomically accepts exactly one receiver offer. Repeated requests are safe:
 * the persisted timestamp proves the offer was already accepted and no new
 * state transition or dispatch can occur.
 */
export async function acceptReceiverJob(input: { userId: number; receiverId: string; jobId: string }) {
  const db = await requireDb();
  let acceptedNow = false;
  await db.transaction(async tx => {
    const [assignmentRow] = await tx.select({ assignment: jobAssignments, job: trainingJobs, receiver: receivers })
      .from(jobAssignments)
      .innerJoin(trainingJobs, eq(trainingJobs.id, jobAssignments.jobId))
      .innerJoin(receivers, eq(receivers.id, jobAssignments.receiverId))
      .where(and(
        eq(jobAssignments.jobId, input.jobId),
        eq(jobAssignments.receiverId, input.receiverId),
        eq(receivers.ownerId, input.userId),
      ))
      .limit(1);
    if (!assignmentRow) throw new Error("The assigned receiver offer was not found.");
    if (!["awaiting_receiver", "loading_dataset"].includes(assignmentRow.job.status)) {
      throw new Error("This receiver offer is no longer available for acceptance.");
    }
    if (assignmentRow.assignment.acceptedAt) return;
    const acceptedAt = new Date();
    const result = await tx.update(jobAssignments).set({ acceptedAt, lastHeartbeatAt: acceptedAt })
      .where(and(
        eq(jobAssignments.id, assignmentRow.assignment.id),
        isNull(jobAssignments.acceptedAt),
        eq(jobAssignments.status, "awaiting_acceptance"),
      ));
    const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
    if (affectedRows !== 1) return;
    acceptedNow = true;
    if (assignmentRow.job.status === "awaiting_receiver") {
      await tx.update(trainingJobs).set({ status: "loading_dataset" })
        .where(and(eq(trainingJobs.id, input.jobId), eq(trainingJobs.status, "awaiting_receiver")));
    }
    await tx.insert(jobEvents).values({
      id: id("evt"), jobId: input.jobId, type: "assignment.accepted", status: "loading_dataset",
      message: "Receiver accepted the offer. Dataset delivery must finish before execution can be dispatched.",
      payload: { receiverId: input.receiverId },
    });
  });
  const assignment = await getReceiverDatasetAssignment(input);
  return { acceptedNow, assignment };
}

export async function getReceiverDatasetAssignment(input: { userId: number; receiverId: string; jobId: string }) {
  const db = await requireDb();
  const [row] = await db.select({ assignment: jobAssignments, job: trainingJobs, receiver: receivers })
    .from(jobAssignments)
    .innerJoin(trainingJobs, eq(trainingJobs.id, jobAssignments.jobId))
    .innerJoin(receivers, eq(receivers.id, jobAssignments.receiverId))
    .where(and(
      eq(jobAssignments.jobId, input.jobId),
      eq(jobAssignments.receiverId, input.receiverId),
      eq(receivers.ownerId, input.userId),
    ))
    .limit(1);
  return row;
}

/** Marks the server-authorized dataset stream as started, never as completed. */
export async function markReceiverDatasetDownloadStarted(input: { userId: number; receiverId: string; jobId: string }) {
  const db = await requireDb();
  let startedNow = false;
  await db.transaction(async tx => {
    const [row] = await tx.select({ assignment: jobAssignments, job: trainingJobs, receiver: receivers })
      .from(jobAssignments)
      .innerJoin(trainingJobs, eq(trainingJobs.id, jobAssignments.jobId))
      .innerJoin(receivers, eq(receivers.id, jobAssignments.receiverId))
      .where(and(
        eq(jobAssignments.jobId, input.jobId),
        eq(jobAssignments.receiverId, input.receiverId),
        eq(receivers.ownerId, input.userId),
      ))
      .limit(1);
    if (!row) throw new Error("The assigned receiver offer was not found.");
    if (!row.assignment.acceptedAt) throw new Error("Accept the receiver offer before requesting the dataset.");
    if (row.assignment.datasetDownloadCompletedAt) return;
    if (!["awaiting_receiver", "loading_dataset"].includes(row.job.status)) {
      throw new Error("Dataset delivery is not available for this job state.");
    }
    if (!row.assignment.datasetDownloadStartedAt) {
      const startedAt = new Date();
      const result = await tx.update(jobAssignments).set({ datasetDownloadStartedAt: startedAt, lastHeartbeatAt: startedAt })
        .where(and(eq(jobAssignments.id, row.assignment.id), isNull(jobAssignments.datasetDownloadStartedAt)));
      const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
      startedNow = affectedRows === 1;
      if (startedNow) {
        await tx.insert(jobEvents).values({
          id: id("evt"), jobId: input.jobId, type: "assignment.dataset_delivery_started", status: "loading_dataset",
          message: "Receiver began an authorized dataset transfer.", payload: { receiverId: input.receiverId },
        });
      }
    }
  });
  return { startedNow, assignment: await getReceiverDatasetAssignment(input) };
}

/**
 * Completes a receiver delivery and promotes the job to the execution queue
 * only when every distributed assignment reports a completed transfer.
 */
export async function markReceiverDatasetDownloadCompleted(input: { userId: number; receiverId: string; jobId: string }) {
  const db = await requireDb();
  let completedNow = false;
  let dispatchReady = false;
  await db.transaction(async tx => {
    const [row] = await tx.select({ assignment: jobAssignments, job: trainingJobs, receiver: receivers })
      .from(jobAssignments)
      .innerJoin(trainingJobs, eq(trainingJobs.id, jobAssignments.jobId))
      .innerJoin(receivers, eq(receivers.id, jobAssignments.receiverId))
      .where(and(
        eq(jobAssignments.jobId, input.jobId),
        eq(jobAssignments.receiverId, input.receiverId),
        eq(receivers.ownerId, input.userId),
      ))
      .limit(1);
    if (!row) throw new Error("The assigned receiver offer was not found.");
    if (!row.assignment.acceptedAt || !row.assignment.datasetDownloadStartedAt) {
      throw new Error("A completed dataset transfer requires an accepted offer and started transfer.");
    }
    if (row.assignment.datasetDownloadCompletedAt) return;
    if (row.job.status !== "loading_dataset") throw new Error("Dataset delivery is no longer active for this job.");
    const completedAt = new Date();
    const result = await tx.update(jobAssignments).set({
      datasetDownloadCompletedAt: completedAt,
      status: "queued",
      lastHeartbeatAt: completedAt,
    }).where(and(eq(jobAssignments.id, row.assignment.id), isNull(jobAssignments.datasetDownloadCompletedAt)));
    const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
    if (affectedRows !== 1) return;
    completedNow = true;
    await tx.insert(jobEvents).values({
      id: id("evt"), jobId: input.jobId, type: "assignment.dataset_delivery_completed", status: "loading_dataset",
      message: "Receiver confirmed full dataset delivery; waiting for all assigned receivers before dispatch.",
      payload: { receiverId: input.receiverId },
    });
    const assignments = await tx.select({ completedAt: jobAssignments.datasetDownloadCompletedAt })
      .from(jobAssignments).where(eq(jobAssignments.jobId, input.jobId));
    const allComplete = assignments.length > 0 && assignments.every(assignment => Boolean(assignment.completedAt));
    if (!allComplete) return;
    const queueResult = await tx.update(trainingJobs).set({ status: "queued" })
      .where(and(eq(trainingJobs.id, input.jobId), eq(trainingJobs.status, "loading_dataset")));
    const queuedRows = Number((queueResult as any)[0]?.affectedRows ?? (queueResult as any).affectedRows ?? 0);
    if (queuedRows !== 1) return;
    dispatchReady = true;
    await tx.insert(jobEvents).values({
      id: id("evt"), jobId: input.jobId, type: "job.dataset_delivery_complete", status: "queued",
      message: "All assigned receivers completed dataset delivery. Execution has entered the dispatch queue.",
    });
  });
  return { completedNow, dispatchReady, assignment: await getReceiverDatasetAssignment(input), job: await getJobForUser(input.jobId, (await getReceiverDatasetAssignment(input))?.job.userId ?? -1) };
}

export async function setJobStatus(input: { jobId: string; userId: number; status: JobStatus; type: string; message: string; metrics?: unknown }) {
  const db = await requireDb();
  const job = await getJobForUser(input.jobId, input.userId);
  if (!job) return undefined;
  const terminal = input.status === "completed" || input.status === "failed" || input.status === "cancelled";
  await db.update(trainingJobs).set({
    status: input.status,
    metrics: input.metrics ?? job.metrics,
    startedAt: input.status === "running" && !job.startedAt ? new Date() : job.startedAt,
    completedAt: terminal ? new Date() : job.completedAt,
  }).where(eq(trainingJobs.id, input.jobId));
  await db.insert(jobEvents).values({ id: id("evt"), jobId: input.jobId, type: input.type, status: input.status, message: input.message, payload: input.metrics });
  if (["queued", "provisioning", "loading_dataset"].includes(input.status)) {
    await db.update(jobAssignments).set({ status: "queued", lastHeartbeatAt: new Date() }).where(eq(jobAssignments.jobId, input.jobId));
  }
  if (input.status === "running") {
    await db.update(jobAssignments).set({ status: "running", lastHeartbeatAt: new Date() }).where(eq(jobAssignments.jobId, input.jobId));
  }
  if (terminal) {
    await db.update(receivers).set({ availability: "available", activeJobId: null, reservationExpiresAt: null })
      .where(eq(receivers.activeJobId, input.jobId));
    await db.update(jobAssignments).set({ status: input.status === "completed" ? "completed" : "released" })
      .where(eq(jobAssignments.jobId, input.jobId));
  }
  return getJobForUser(input.jobId, input.userId);
}


function simulationDuration(config: any) {
  const epochs = Math.max(1, Number(config?.params?.epochs ?? 3));
  return Math.min(120, Math.max(55, 45 + epochs * 12));
}

function simulationMetrics(job: any, progress: number, elapsedSec: number) {
  const config = job.config as any;
  const epochs = Math.max(1, Number(config?.params?.epochs ?? 3));
  const totalSteps = Math.max(20, Number(config?.dataset?.records ?? 500) * epochs / Math.max(1, Number(config?.params?.batchSize ?? 4)));
  const currentStep = Math.min(totalSteps, Math.round(totalSteps * progress));
  const seed = Math.floor(progress * 200);
  const noise = (value: number) => {
    const raw = Math.sin(value * 12.9898) * 43758.5453;
    return (raw - Math.floor(raw)) * 2 - 1;
  };
  const training = progress > 0;
  const loss = training ? Math.max(0.2, 2.6 * Math.exp(-2.7 * progress) + 0.35 + noise(seed) * 0.05) : 0;
  const learningRate = Number(config?.params?.learningRate ?? 0.0002) * (training ? Math.max(0.05, 1 - progress * 0.85) : 0);
  const vramTotalGb = Number(config?.receiver?.vramGb ?? 24);
  const vramUsedGb = training ? Math.min(vramTotalGb, vramTotalGb * (0.62 + noise(seed + 7) * 0.04)) : 0;
  return {
    progress: Number((progress * 100).toFixed(1)),
    elapsedSec: Math.round(elapsedSec),
    remainingSec: Math.max(0, Math.round(simulationDuration(config) - elapsedSec)),
    currentEpoch: Math.min(epochs, Math.max(1, Math.ceil(progress * epochs))),
    totalEpochs: epochs,
    currentStep,
    totalSteps,
    loss: Number(loss.toFixed(4)),
    learningRate: Number(learningRate.toExponential(2)),
    gpuUtil: training ? Math.round(Math.max(70, Math.min(99, 92 + noise(seed + 3) * 6))) : 25,
    vramUsedGb: Number(vramUsedGb.toFixed(1)),
    vramTotalGb,
    vramPercent: vramTotalGb ? Math.round((vramUsedGb / vramTotalGb) * 100) : 0,
    speed: training ? Number((2.4 + noise(seed + 5) * 0.4).toFixed(2)) : 0,
  };
}

function persistMetricHistory(previousMetrics: unknown, currentMetrics: Record<string, unknown>, now: Date) {
  const previous = previousMetrics && typeof previousMetrics === "object" ? (previousMetrics as { metricHistory?: unknown }).metricHistory : undefined;
  const metricHistory = Array.isArray(previous)
    ? previous.filter((sample) => sample && typeof sample === "object").slice(-47)
    : [];
  const sample = {
    capturedAt: now.toISOString(),
    progress: currentMetrics.progress,
    loss: currentMetrics.loss,
    learningRate: currentMetrics.learningRate,
    gpuUtil: currentMetrics.gpuUtil,
    vramPercent: currentMetrics.vramPercent,
  };
  const last = metricHistory[metricHistory.length - 1] as { progress?: unknown } | undefined;
  return {
    ...currentMetrics,
    metricHistory: last?.progress === sample.progress ? metricHistory : [...metricHistory, sample],
  };
}

async function createSimulationNotification(userId: number, jobId: string, type: "info" | "success" | "warning" | "error", title: string, message: string) {
  const db = await requireDb();
  await db.insert(notifications).values({ id: id("notice"), userId, jobId, type, title, message });
}

async function createCompletedModel(job: any) {
  const db = await requireDb();
  const [existing] = await db.select().from(trainedModels).where(eq(trainedModels.jobId, job.id)).limit(1);
  if (existing) return;
  const config = job.config as any;
  await db.insert(trainedModels).values({
    id: id("model"),
    userId: job.userId,
    jobId: job.id,
    name: `${job.name}-ft`,
    baseModel: job.baseModelId,
    method: String(config?.advanced?.method ?? "lora").toUpperCase(),
    sizeBytes: 168_000_000,
    artifactKey: `simulated/${job.id}/adapter-manifest.json`,
  });
}

/**
 * Advances jobs only when the authenticated client polls. This keeps simulation
 * durable and server-owned without relying on an always-on background worker.
 */
export async function advanceSimulatedJobsForUser(userId: number, now = new Date()) {
  const db = await requireDb();
  const jobs = await db.select().from(trainingJobs).where(eq(trainingJobs.userId, userId));
  for (const job of jobs) {
    // updatedAt is reset at every persisted lifecycle boundary. Using it for
    // staging prevents a long receiver-offer or dataset-delivery wait from
    // making a newly queued simulation jump immediately to running.
    const stageAgeSec = Math.max(0, (now.getTime() - job.updatedAt.getTime()) / 1000);
    if (job.status === "queued" && stageAgeSec >= 3) {
      await setJobStatus({ jobId: job.id, userId, status: "provisioning", type: "simulation.provisioning", message: "Simulation worker reserved GPU capacity and is preparing the execution environment." });
      await createSimulationNotification(userId, job.id, "info", "GPU capacity reserved", `${job.name} is provisioning in server simulation mode.`);
      continue;
    }
    if (job.status === "provisioning" && stageAgeSec >= 5) {
      await setJobStatus({ jobId: job.id, userId, status: "loading_dataset", type: "simulation.dataset_loading", message: "Simulation worker is validating and loading the training dataset." });
      continue;
    }
    if (job.status === "loading_dataset" && stageAgeSec >= 6) {
      await setJobStatus({ jobId: job.id, userId, status: "running", type: "simulation.training_started", message: "Server simulation has started the fine-tuning workload." });
      await createSimulationNotification(userId, job.id, "success", "Training started", `${job.name} is now emitting server-persisted telemetry.`);
      continue;
    }
    if (job.status === "cancelling" && stageAgeSec >= 2) {
      await setJobStatus({ jobId: job.id, userId, status: "cancelled", type: "simulation.cancelled", message: "Simulation worker acknowledged the cancellation request." });
      await createSimulationNotification(userId, job.id, "warning", "Training cancelled", `${job.name} was cancelled before completion.`);
      continue;
    }
    if (job.status !== "running" || !job.startedAt) continue;
    const elapsedSec = Math.max(0, (now.getTime() - job.startedAt.getTime()) / 1000);
    const progress = Math.min(1, elapsedSec / simulationDuration(job.config));
    const metrics = persistMetricHistory(job.metrics, simulationMetrics(job, progress, elapsedSec), now);
    if (progress >= 1) {
      await setJobStatus({ jobId: job.id, userId, status: "completed", type: "simulation.completed", message: "Simulation finished; adapter artifact manifest is ready.", metrics });
      await createCompletedModel(job);
      await createSimulationNotification(userId, job.id, "success", "Training completed", `${job.name} completed in server simulation mode.`);
    } else {
      await db.update(trainingJobs).set({ metrics }).where(eq(trainingJobs.id, job.id));
    }
  }
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createProviderExecution(input: { jobId: string; provider: string; callbackToken: string; endpointId?: string }) {
  const db = await requireDb();
  const existing = await db.select().from(providerExecutions).where(eq(providerExecutions.jobId, input.jobId)).limit(1);
  if (existing[0]) return existing[0];
  const execution = {
    id: id("exec"),
    jobId: input.jobId,
    provider: input.provider,
    endpointId: input.endpointId,
    callbackTokenHash: tokenHash(input.callbackToken),
    lastProviderStatus: "created",
  };
  await db.insert(providerExecutions).values(execution);
  return execution;
}

export async function setProviderDispatch(input: { executionId: string; providerJobId?: string; status: string; payload?: unknown }) {
  const db = await requireDb();
  await db.update(providerExecutions).set({
    providerJobId: input.providerJobId,
    lastProviderStatus: input.status,
    lastPayload: input.payload,
  }).where(eq(providerExecutions.id, input.executionId));
}

export async function applyProviderCallback(input: { executionId: string; callbackToken: string; providerStatus: string; payload: unknown }) {
  const db = await requireDb();
  const [execution] = await db.select().from(providerExecutions).where(eq(providerExecutions.id, input.executionId)).limit(1);
  if (!execution || execution.callbackTokenHash !== tokenHash(input.callbackToken)) return { accepted: false as const, reason: "invalid_callback" as const };
  const [job] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, execution.jobId)).limit(1);
  if (!job) return { accepted: false as const, reason: "missing_job" as const };
  await db.update(providerExecutions).set({ lastProviderStatus: input.providerStatus, lastPayload: input.payload }).where(eq(providerExecutions.id, execution.id));

  const normalized = input.providerStatus.toUpperCase();
  const status: JobStatus | undefined = normalized === "COMPLETED" ? "completed"
    : ["FAILED", "TIMED_OUT"].includes(normalized) ? "failed"
    : ["CANCELLED", "CANCELED"].includes(normalized) ? "cancelled"
    : ["IN_PROGRESS", "RUNNING"].includes(normalized) ? "running"
    : ["IN_QUEUE", "QUEUED"].includes(normalized) ? "queued"
    : undefined;
  if (!status || status === job.status) return { accepted: true as const, duplicate: true as const };
  const terminal = ["completed", "failed", "cancelled"].includes(status);
  await setJobStatus({ jobId: job.id, userId: job.userId, status, type: "provider.callback", message: `Provider callback reported ${normalized}.` });
  if (status === "completed") await createCompletedModel(job);
  if (terminal) await createSimulationNotification(job.userId, job.id, status === "completed" ? "success" : "error", `Provider ${status}`, `${job.name} reported ${normalized} from its GPU provider.`);
  return { accepted: true as const, duplicate: false as const };
}

export async function deleteJobForUser(jobId: string, userId: number) {
  const db = await requireDb();
  const job = await getJobForUser(jobId, userId);
  if (!job) return false;
  await db.delete(providerExecutions).where(eq(providerExecutions.jobId, jobId));
  await db.delete(settlementRecords).where(eq(settlementRecords.jobId, jobId));
  await db.delete(jobEvents).where(eq(jobEvents.jobId, jobId));
  await db.delete(trainingJobs).where(and(eq(trainingJobs.id, jobId), eq(trainingJobs.userId, userId)));
  return true;
}

export async function createSettlement(jobId: string, userId: number, amount: string) {
  const db = await requireDb();
  const existing = await db.select().from(settlementRecords).where(eq(settlementRecords.jobId, jobId)).limit(1);
  if (existing[0]) return existing[0];
  const record = { id: id("set"), jobId, userId, amount, status: "authorized" as const, externalReference: `LOCAL-${nanoid(10).toUpperCase()}` };
  await db.insert(settlementRecords).values(record);
  return record;
}

export async function getSettlementForUser(jobId: string, userId: number) {
  const job = await getJobForUser(jobId, userId);
  if (!job) return undefined;
  const db = await requireDb();
  const [settlement] = await db.select().from(settlementRecords)
    .where(and(eq(settlementRecords.jobId, jobId), eq(settlementRecords.userId, userId)))
    .limit(1);
  return settlement;
}

export async function settleCompletedJob(jobId: string, userId: number) {
  const job = await getJobForUser(jobId, userId);
  if (!job || job.status !== "completed") return undefined;
  const settlement = await getSettlementForUser(jobId, userId);
  if (!settlement) return undefined;
  if (settlement.status === "settled") return settlement;
  const db = await requireDb();
  await db.update(settlementRecords).set({ status: "settled" })
    .where(and(eq(settlementRecords.id, settlement.id), eq(settlementRecords.userId, userId)));
  return getSettlementForUser(jobId, userId);
}

export async function listModelsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(trainedModels).where(eq(trainedModels.userId, userId)).orderBy(desc(trainedModels.createdAt));
}

export async function renameModelForUser(modelId: string, userId: number, name: string) {
  const db = await requireDb();
  await db.update(trainedModels).set({ name }).where(and(eq(trainedModels.id, modelId), eq(trainedModels.userId, userId)));
  const [model] = await db.select().from(trainedModels).where(and(eq(trainedModels.id, modelId), eq(trainedModels.userId, userId))).limit(1);
  return model;
}

export async function deleteModelForUser(modelId: string, userId: number) {
  const db = await requireDb();
  await db.delete(trainedModels).where(and(eq(trainedModels.id, modelId), eq(trainedModels.userId, userId)));
}

export async function listNotificationsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
}

export async function markNotificationRead(idValue: string, userId: number) {
  const db = await requireDb();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, idValue), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await requireDb();
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, userId));
}

export async function clearNotificationsForUser(userId: number) {
  const db = await requireDb();
  await db.delete(notifications).where(eq(notifications.userId, userId));
}

export async function getProviderExecutionByJob(jobId: string) {
  const db = await requireDb();
  const [execution] = await db.select().from(providerExecutions).where(eq(providerExecutions.jobId, jobId)).limit(1);
  return execution;
}
