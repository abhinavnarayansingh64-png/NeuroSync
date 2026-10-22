import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
vi.mock("./db", () => ({ getDb }));

const { acceptReceiverJob } = await import("./neurosyncDb");

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assign_1", jobId: "job_1", receiverId: "rx_1", status: "awaiting_acceptance",
    acceptedAt: null, datasetDownloadStartedAt: null, datasetDownloadCompletedAt: null,
    ...overrides,
  };
}

function lifecycleDb(rows: unknown[][]) {
  const selections = [...rows];
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => selections.shift() ?? [] }) }) }),
      }),
    }),
    update: () => ({ set: () => ({ where: async () => ({ affectedRows: 1 }) }) }),
    insert: () => ({ values: async () => undefined }),
    transaction: async (callback: (tx: typeof db) => Promise<void>) => callback(db),
  };
  return db;
}

describe("receiver acceptance behavior", () => {
  beforeEach(() => getDb.mockReset());

  it("claims a pending offer once and moves the job to delivery preparation", async () => {
    const claimed = assignment();
    const row = { assignment: claimed, job: { id: "job_1", status: "awaiting_receiver" }, receiver: { id: "rx_1", ownerId: 7 } };
    getDb.mockResolvedValue(lifecycleDb([[row], [row]]));

    const result = await acceptReceiverJob({ userId: 7, receiverId: "rx_1", jobId: "job_1" });

    expect(result.acceptedNow).toBe(true);
    expect(result.assignment).toMatchObject({ job: { id: "job_1" }, receiver: { id: "rx_1" } });
  });

  it("returns an idempotent result when the assignment already has an acceptance timestamp", async () => {
    const claimed = assignment({ acceptedAt: new Date("2026-08-23T00:00:00.000Z") });
    const row = { assignment: claimed, job: { id: "job_1", status: "loading_dataset" }, receiver: { id: "rx_1", ownerId: 7 } };
    getDb.mockResolvedValue(lifecycleDb([[row], [row]]));

    await expect(acceptReceiverJob({ userId: 7, receiverId: "rx_1", jobId: "job_1" })).resolves.toMatchObject({ acceptedNow: false });
  });
});
