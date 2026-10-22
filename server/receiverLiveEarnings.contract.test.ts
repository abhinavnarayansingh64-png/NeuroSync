import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const persistenceSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");
const receiverSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverDashboard.jsx"), "utf8");

describe("receiver live visibility contract", () => {
  it("advances assigned simulation jobs from receiver polling rather than requiring the sender dashboard", () => {
    expect(persistenceSource).toContain("advanceSimulatedJobsForUser(ownerId)");
    expect(persistenceSource).toContain("Receiver-side polling is a first-class simulation clock");
  });

  it("returns active accrued and projected receiver earnings from persisted telemetry", () => {
    expect(persistenceSource).toContain("accruedActiveEarnings");
    expect(persistenceSource).toContain("projectedActiveEarnings");
    expect(persistenceSource).toContain("baseFee * 0.7");
    expect(persistenceSource).toContain("senderUsageEstimate * 0.6");
  });

  it("renders active projection and pinned desktop job-level progress on a four-second polling cadence", () => {
    expect(receiverSource).toContain("Projected active payout");
    expect(receiverSource).toContain("Accrued active payout");
    expect(receiverSource).toContain("Current receiver assignment");
    expect(receiverSource).toContain("sticky top-20 z-20");
    expect(receiverSource).toContain("refetchInterval: 4_000");
  });
});
