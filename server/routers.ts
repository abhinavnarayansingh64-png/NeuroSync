import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as neuro from "./neurosyncDb";
import { dispatchTrainingJob, gpuRuntimeMode } from "./gpuProvider";
import { createPremiumBillingPortal, createPremiumCheckout } from "./stripe";
import { ownsDatasetKey } from "./datasetTransfer";

const jobConfigSchema = z.record(z.string(), z.unknown());
const jobStatusSchema = z.enum(["draft", "awaiting_payment", "awaiting_receiver", "queued", "provisioning", "loading_dataset", "running", "paused", "cancelling", "completed", "failed", "cancelled"]);

const requireOwnedJob = async (jobId: string, userId: number) => {
  const job = await neuro.getJobForUser(jobId, userId);
  if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Training job not found." });
  return job;
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: router({
    profile: protectedProcedure.query(({ ctx }) => neuro.getOrCreateProfile(ctx.user.id)),
    setRole: protectedProcedure.input(z.object({ workspaceRole: z.enum(["sender", "receiver", "both"]) })).mutation(({ ctx, input }) => neuro.setWorkspaceRole(ctx.user.id, input.workspaceRole)),
    updatePreferences: protectedProcedure.input(z.object({ preferences: z.record(z.string(), z.unknown()) })).mutation(({ ctx, input }) => neuro.updateProfilePreferences(ctx.user.id, input.preferences)),
    membership: protectedProcedure.query(({ ctx }) => neuro.getMembership(ctx.user.id)),
    activatePremiumTrial: protectedProcedure.mutation(({ ctx }) => neuro.activatePremiumTrial(ctx.user.id)),
    createPremiumCheckout: protectedProcedure.mutation(({ ctx }) => createPremiumCheckout({
      userId: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      origin: ctx.req.headers.origin,
    })),
    createPremiumBillingPortal: protectedProcedure.mutation(({ ctx }) => createPremiumBillingPortal({
      userId: ctx.user.id,
      origin: ctx.req.headers.origin,
    })),
    cancelPremiumTrial: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        return await neuro.cancelPremiumTrial(ctx.user.id);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The Premium trial could not be revoked." });
      }
    }),
  }),
  catalog: router({
    receivers: protectedProcedure.query(({ ctx }) => neuro.listReceiversForUser(ctx.user.id)),
    baseModels: publicProcedure.query(() => neuro.listBaseModels()),
  }),
  receivers: router({
    enroll: protectedProcedure.input(z.object({
      deviceFingerprint: z.string().trim().min(8).max(160),
      name: z.string().trim().min(2).max(140),
      gpu: z.string().trim().min(2).max(120),
      vramGb: z.number().min(0).max(512),
      pricePerHour: z.number().min(30).max(60),
      capabilities: z.record(z.string(), z.unknown()).optional(),
      isDirectoryVisible: z.boolean().default(true),
    })).mutation(({ ctx, input }) => neuro.registerOrUpdateReceiver({ userId: ctx.user.id, ...input })),
    heartbeat: protectedProcedure.input(z.object({
      receiverId: z.string().min(1).max(48),
      availability: z.enum(["available", "busy", "maintenance"]),
      capabilities: z.record(z.string(), z.unknown()).optional(),
      clientTimestamp: z.coerce.date().optional(),
    })).mutation(async ({ ctx, input }) => {
      const receiver = await neuro.heartbeatReceiver({ userId: ctx.user.id, ...input });
      if (!receiver) throw new TRPCError({ code: "NOT_FOUND", message: "Receiver enrollment was not found for this account." });
      return receiver;
    }),
    coordinatorState: protectedProcedure.input(z.object({ receiverId: z.string().min(1).max(48) })).query(async ({ ctx, input }) => {
      const receiver = await neuro.getReceiverCoordinatorState(ctx.user.id, input.receiverId);
      if (!receiver) throw new TRPCError({ code: "NOT_FOUND", message: "Receiver enrollment was not found for this account." });
      return receiver;
    }),
    desktopReceiver: protectedProcedure.query(({ ctx }) => neuro.getDesktopReceiverForUser(ctx.user.id)),
    assignedJobs: protectedProcedure.input(z.object({ receiverId: z.string().min(1).max(48) })).query(({ ctx, input }) => neuro.listAssignedJobsForReceiver(ctx.user.id, input.receiverId)),
    earnings: protectedProcedure.input(z.object({ receiverId: z.string().min(1).max(48) })).query(({ ctx, input }) => neuro.getReceiverEarnings(ctx.user.id, input.receiverId)),
    history: protectedProcedure.input(z.object({ receiverId: z.string().min(1).max(48) })).query(({ ctx, input }) => neuro.listReceiverHistory(ctx.user.id, input.receiverId)),
    analytics: protectedProcedure.input(z.object({ receiverId: z.string().min(1).max(48), range: z.enum(["7d", "30d", "all"]).default("7d") })).query(({ ctx, input }) => neuro.getReceiverAnalytics(ctx.user.id, input.receiverId, input.range)),
    acceptJob: protectedProcedure.input(z.object({ receiverId: z.string().min(1).max(48), jobId: z.string().min(1).max(48) })).mutation(async ({ ctx, input }) => {
      try {
        return await neuro.acceptReceiverJob({ userId: ctx.user.id, ...input });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The receiver offer could not be accepted." });
      }
    }),
    retire: protectedProcedure.input(z.object({ receiverId: z.string().min(1).max(48) })).mutation(async ({ ctx, input }) => {
      try {
        return await neuro.retireReceiver(ctx.user.id, input.receiverId);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The receiver could not be retired." });
      }
    }),
  }),
  gpu: router({
    mode: protectedProcedure.query(() => ({ mode: gpuRuntimeMode(), provider: "runpod" as const })),
  }),
  jobs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (gpuRuntimeMode() === "simulation") {
        await neuro.advanceSimulatedJobsForUser(ctx.user.id);
      }
      return neuro.listJobsForUser(ctx.user.id);
    }),
    get: protectedProcedure.input(z.object({ jobId: z.string().min(1) })).query(async ({ ctx, input }) => {
      const job = await requireOwnedJob(input.jobId, ctx.user.id);
      const events = await neuro.listJobEvents(input.jobId, ctx.user.id);
      const assignments = await neuro.listReceiverAssignments(input.jobId);
      return { job, events: events ?? [], assignments };
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().trim().min(2).max(180),
      receiverId: z.string().min(1).max(48),
      receiverIds: z.array(z.string().min(1).max(48)).min(2).max(16).optional(),
      baseModelId: z.string().min(1).max(80),
      config: jobConfigSchema,
      datasetName: z.string().max(255).optional(),
      datasetKey: z.string().max(512).optional(),
      // Storage may return either an absolute S3 URL or a deployment-relative
      // path. Ownership is enforced through datasetKey below, so do not reject
      // a valid workspace-relative storage location before dispatch.
      datasetUrl: z.string().trim().min(1).max(2048).optional(),
      estimatedCost: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      provider: z.enum(["runpod", "vast", "lambda"]).default("runpod"),
      trainingMode: z.enum(["single", "distributed"]).default("single"),
      synchronizationStrategy: z.enum(["per_step", "adaptive"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      if (input.datasetKey && !ownsDatasetKey(ctx.user.id, input.datasetKey)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "The selected dataset does not belong to this workspace." });
      }
      if (input.trainingMode === "distributed") {
        const membership = await neuro.getMembership(ctx.user.id);
        if (membership.plan !== "premium" || !["active", "trialing"].includes(membership.status)) throw new TRPCError({ code: "FORBIDDEN", message: "Distributed fine-tuning is available with Premium membership." });
        if (!input.receiverIds || input.receiverIds.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "Select at least two receivers for distributed fine-tuning." });
        if (!input.synchronizationStrategy) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose per-step or adaptive synchronization." });
      }
      try {
        return await neuro.createTrainingJob({ ...input, userId: ctx.user.id });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Receiver")) throw new TRPCError({ code: "CONFLICT", message: error.message });
        throw error;
      }
    }),
    confirmSettlement: protectedProcedure.input(z.object({ jobId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const job = await requireOwnedJob(input.jobId, ctx.user.id);
      if (job.status !== "awaiting_payment") throw new TRPCError({ code: "BAD_REQUEST", message: "This job is not awaiting settlement." });
      const amount = job.estimatedCost ?? "0.00";
      const settlement = await neuro.createSettlement(job.id, ctx.user.id, amount);
      try {
        const offeredJob = await neuro.offerReceiverJob(job.id, ctx.user.id);
        if (!offeredJob) throw new TRPCError({ code: "NOT_FOUND", message: "Training job not found." });
        return { job: offeredJob, settlement, dispatch: null };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The receiver offer could not be created." });
      }
    }),
    settlement: protectedProcedure.input(z.object({ jobId: z.string().min(1) })).query(async ({ ctx, input }) => {
      await requireOwnedJob(input.jobId, ctx.user.id);
      return neuro.getSettlementForUser(input.jobId, ctx.user.id);
    }),
    settleFinal: protectedProcedure.input(z.object({ jobId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const job = await requireOwnedJob(input.jobId, ctx.user.id);
      if (job.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Final settlement is available only after training completes." });
      const settlement = await neuro.settleCompletedJob(input.jobId, ctx.user.id);
      if (!settlement) throw new TRPCError({ code: "NOT_FOUND", message: "Settlement record not found." });
      return settlement;
    }),
    pause: protectedProcedure.input(z.object({ jobId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const job = await requireOwnedJob(input.jobId, ctx.user.id);
      if (job.status !== "running") throw new TRPCError({ code: "BAD_REQUEST", message: "Only running jobs can be paused." });
      return neuro.setJobStatus({ jobId: job.id, userId: ctx.user.id, status: "paused", type: "job.paused", message: "Pause requested by workspace owner." });
    }),
    resume: protectedProcedure.input(z.object({ jobId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const job = await requireOwnedJob(input.jobId, ctx.user.id);
      if (job.status !== "paused") throw new TRPCError({ code: "BAD_REQUEST", message: "Only paused jobs can be resumed." });
      return neuro.setJobStatus({ jobId: job.id, userId: ctx.user.id, status: "queued", type: "job.resume_requested", message: "Resume requested; job returned to the GPU queue." });
    }),
    cancel: protectedProcedure.input(z.object({ jobId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const job = await requireOwnedJob(input.jobId, ctx.user.id);
      if (["completed", "failed", "cancelled"].includes(job.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Terminal jobs cannot be cancelled." });
      return neuro.setJobStatus({ jobId: job.id, userId: ctx.user.id, status: "cancelling", type: "job.cancel_requested", message: "Cancellation requested; waiting for provider confirmation." });
    }),
    delete: protectedProcedure.input(z.object({ jobId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const job = await requireOwnedJob(input.jobId, ctx.user.id);
      if (["running", "provisioning", "loading_dataset", "queued", "cancelling"].includes(job.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Active jobs must be cancelled before deletion." });
      }
      await neuro.deleteJobForUser(job.id, ctx.user.id);
      return { success: true } as const;
    }),
    updateStatus: protectedProcedure.input(z.object({ jobId: z.string().min(1), status: jobStatusSchema, message: z.string().min(1).max(500) })).mutation(async ({ ctx, input }) => {
      const job = await requireOwnedJob(input.jobId, ctx.user.id);
      return neuro.setJobStatus({ jobId: job.id, userId: ctx.user.id, status: input.status, type: "job.manual_state", message: input.message });
    }),
  }),
  models: router({
    list: protectedProcedure.query(({ ctx }) => neuro.listModelsForUser(ctx.user.id)),
    rename: protectedProcedure.input(z.object({ modelId: z.string().min(1), name: z.string().trim().min(2).max(180) })).mutation(({ ctx, input }) => neuro.renameModelForUser(input.modelId, ctx.user.id, input.name)),
    delete: protectedProcedure.input(z.object({ modelId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      await neuro.deleteModelForUser(input.modelId, ctx.user.id);
      return { success: true } as const;
    }),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => neuro.listNotificationsForUser(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ id: z.string().min(1) })).mutation(({ ctx, input }) => neuro.markNotificationRead(input.id, ctx.user.id)),
    markAllRead: protectedProcedure.mutation(({ ctx }) => neuro.markAllNotificationsRead(ctx.user.id)),
    clear: protectedProcedure.mutation(({ ctx }) => neuro.clearNotificationsForUser(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
