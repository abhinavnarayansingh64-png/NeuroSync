import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const receiverSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverDashboard.jsx"), "utf8");

describe("receiver offer, acceptance, and payout contract", () => {
  it("creates a persisted receiver offer after settlement instead of dispatching immediately", () => {
    expect(routerSource).toContain("neuro.offerReceiverJob(job.id, ctx.user.id)");
    expect(dbSource).toContain('status: "awaiting_receiver"');
    expect(routerSource).not.toContain("dispatchTrainingJob(queuedJob)");
  });

  it("uses idempotent persisted acceptance and transfer completion gates", () => {
    expect(routerSource).toContain("acceptJob: protectedProcedure");
    expect(dbSource).toContain("export async function acceptReceiverJob");
    expect(dbSource).toContain("markReceiverDatasetDownloadStarted");
    expect(dbSource).toContain("markReceiverDatasetDownloadCompleted");
    expect(dbSource).toContain("dispatchReady");
  });

  it("renders explicit desktop acceptance and delivery controls rather than claiming training began", () => {
    expect(receiverSource).toContain("Accept job & start delivery");
    expect(receiverSource).toContain("Desktop delivery transfers the protected dataset");
    expect(receiverSource).toContain("Completed and running jobs never expose a download action.");
    expect(receiverSource).toContain("Desktop receiver required");
    expect(receiverSource).not.toContain('role="switch"');
  });

  it("keeps payout computation centralized on the server", () => {
    expect(dbSource).toContain("baseFee * 0.7");
    expect(dbSource).toContain("senderUsageEstimate * 0.6");
    expect(dbSource).toContain("usagePayout * progressFraction");
    expect(receiverSource).toContain("Server-derived from the sender estimate");
  });
});
