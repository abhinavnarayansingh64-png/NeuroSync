import { describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
vi.mock("./db", () => ({ getDb }));

const { getReceiverCoordinatorState, heartbeatReceiver, shouldReleaseReceiverReservation } = await import("./neurosyncDb");

function receiver(overrides: Record<string, unknown> = {}) {
  return {
    id: "rx_1", ownerId: 7, availability: "busy", activeJobId: "job_1",
    reservationExpiresAt: new Date(Date.now() - 60_000), lastHeartbeatAt: new Date(),
    capabilities: {}, ...overrides,
  };
}

function createCoordinatorDb(selectResults: unknown[][], updateResults: unknown[] = [{ affectedRows: 1 }]) {
  const selections = [...selectResults];
  const updates = [...updateResults];
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => selections.shift() ?? [] }) }) }),
    update: () => ({ set: () => ({ where: async () => updates.shift() ?? { affectedRows: 1 } }) }),
    insert: () => ({ values: async () => undefined }),
    transaction: async (callback: (tx: typeof db) => Promise<void>) => callback(db),
  };
  return db;
}

describe("receiver coordinator reservation recovery", () => {
  const now = new Date("2026-08-22T00:00:00.000Z");

  it("immediately frees a Busy receiver that has no assignment", () => {
    expect(shouldReleaseReceiverReservation({ activeJobId: null, reservationExpiresAt: null }, undefined, now)).toBe(true);
  });

  it("expires abandoned payment or acceptance reservations without freeing active training", () => {
    const expired = new Date(now.getTime() - 1);
    expect(shouldReleaseReceiverReservation({ activeJobId: "job_waiting", reservationExpiresAt: expired }, "awaiting_payment", now)).toBe(true);
    expect(shouldReleaseReceiverReservation({ activeJobId: "job_running", reservationExpiresAt: expired }, "running", now)).toBe(false);
  });

  it("keeps a valid pre-dispatch reservation Busy until its expiration time", () => {
    const validUntil = new Date(now.getTime() + 60_000);
    expect(shouldReleaseReceiverReservation({ activeJobId: "job_waiting", reservationExpiresAt: validUntil }, "awaiting_receiver", now)).toBe(false);
  });

  it("recovers expired pre-dispatch reservations through the coordinator-state query", async () => {
    const recovered = receiver({ availability: "available", activeJobId: null, reservationExpiresAt: null });
    getDb.mockResolvedValue(createCoordinatorDb([
      [receiver()],
      [{ status: "awaiting_payment" }],
      [{ status: "awaiting_payment" }],
      [recovered],
    ]));
    await expect(getReceiverCoordinatorState(7, "rx_1")).resolves.toMatchObject({ availability: "available", activeJobId: null });
  });

  it("preserves Busy through coordinator state when the assignment is already running", async () => {
    getDb.mockResolvedValue(createCoordinatorDb([
      [receiver()],
      [{ status: "running" }],
    ]));
    await expect(getReceiverCoordinatorState(7, "rx_1")).resolves.toMatchObject({ availability: "busy", activeJobId: "job_1" });
  });

  it("recovers an abandoned expired reservation through the receiver heartbeat", async () => {
    const recovered = receiver({ availability: "available", activeJobId: null, reservationExpiresAt: null });
    getDb.mockResolvedValue(createCoordinatorDb([
      [receiver()],
      [{ status: "awaiting_receiver" }],
      [{ status: "awaiting_receiver" }],
      [recovered],
      [recovered],
    ], [{ affectedRows: 1 }, { affectedRows: 1 }, { affectedRows: 1 }, { affectedRows: 1 }]));
    await expect(heartbeatReceiver({ userId: 7, receiverId: "rx_1", availability: "available" })).resolves.toMatchObject({ availability: "available", activeJobId: null });
  });

  it("keeps an active training assignment Busy through the receiver heartbeat", async () => {
    const running = receiver();
    getDb.mockResolvedValue(createCoordinatorDb([
      [running],
      [{ status: "running" }],
      [running],
    ]));
    await expect(heartbeatReceiver({ userId: 7, receiverId: "rx_1", availability: "available" })).resolves.toMatchObject({ availability: "busy", activeJobId: "job_1" });
  });
});
