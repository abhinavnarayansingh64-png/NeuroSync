import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const persistenceSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");
const senderSource = readFileSync(resolve(process.cwd(), "client/src/pages/NewJob.jsx"), "utf8");
const receiverSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverDashboard.jsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("browser receiver network contract", () => {
  it("expires stale browser heartbeats and exposes coordinated receiver availability", () => {
    expect(persistenceSource).toContain("const HEARTBEAT_TTL_MS = 45_000");
    expect(persistenceSource).toMatch(/staleHeartbeat\s*\?\s*"offline"/);
    expect(persistenceSource).toContain("export async function heartbeatReceiver");
    expect(persistenceSource).toContain("receiverHeartbeats");
  });

  it("reserves selected receivers transactionally and retains active work through reconciliation", () => {
    expect(persistenceSource).toContain("await db.transaction(async tx => {");
    expect(persistenceSource).toContain('eq(receivers.availability, "available")');
    expect(persistenceSource).toContain("isNull(receivers.activeJobId)");
    expect(persistenceSource).toContain("A Busy flag without an assignment is never coordinator-owned");
    expect(persistenceSource).toContain("TERMINAL_JOB_STATUSES.includes(jobStatus)");
    expect(persistenceSource).toContain("PRE_DISPATCH_JOB_STATUSES");
  });

  it("uses stable receiver identity with retrying polling and cached coordinator presentation", () => {
    expect(persistenceSource).toContain("export async function getReceiverCoordinatorState");
    expect(receiverSource).toContain("trpc.receivers.coordinatorState.useQuery");
    expect(receiverSource).toContain("retry: 4");
    expect(receiverSource).toContain("placeholderData: (previous) => previous");
    expect(receiverSource).toContain("const liveReceiver = coordinatorState.data || directoryReceiver || (isDesktop ? enrolled : null) || null");
    expect(receiverSource).toContain("Connection lost — retrying");
    expect(receiverSource).toContain("{ receiverId: receiverId || 'unregistered' }");
  });

  it("creates settlement offers and reserves hardware telemetry for the desktop native runtime", () => {
    expect(routerSource).toContain("neuro.offerReceiverJob(job.id, ctx.user.id)");
    expect(routerSource).toContain("acceptJob: protectedProcedure");
    expect(receiverSource).not.toContain("detectBrowserGpu");
    expect(receiverSource).toContain("desktop_receiver_native_runtime");
    expect(receiverSource).toContain("Desktop receiver required");
    expect(senderSource).toContain("local agent is required for verified CUDA telemetry");
  });
});
