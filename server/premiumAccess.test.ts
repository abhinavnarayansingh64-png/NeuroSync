import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as neuro from "./neurosyncDb";

const context: TrpcContext = {
  user: {
    id: 7,
    openId: "premium-test-user",
    email: "premium@example.com",
    name: "Premium Test",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

const distributedInput = {
  name: "Premium distributed test",
  receiverId: "receiver-a",
  receiverIds: ["receiver-a", "receiver-b"],
  baseModelId: "gemma-2b",
  config: { dataset: { records: 20 } },
  provider: "runpod" as const,
  trainingMode: "distributed" as const,
  synchronizationStrategy: "per_step" as const,
};

afterEach(() => vi.restoreAllMocks());

describe("Premium distributed job access", () => {
  it("rejects distributed training for a free membership before reserving receivers", async () => {
    vi.spyOn(neuro, "getMembership").mockResolvedValue({ plan: "free", status: "active" } as never);
    const createTrainingJob = vi.spyOn(neuro, "createTrainingJob");

    await expect(appRouter.createCaller(context).jobs.create(distributedInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createTrainingJob).not.toHaveBeenCalled();
  });

  it.each(["active", "trialing"] as const)("permits a %s Premium membership", async (status) => {
    vi.spyOn(neuro, "getMembership").mockResolvedValue({ plan: "premium", status } as never);
    const createdJob = { id: "job_premium", userId: context.user!.id, status: "awaiting_payment" };
    const createTrainingJob = vi.spyOn(neuro, "createTrainingJob").mockResolvedValue(createdJob as never);

    await expect(appRouter.createCaller(context).jobs.create(distributedInput)).resolves.toEqual(createdJob);
    expect(createTrainingJob).toHaveBeenCalledWith(expect.objectContaining({ userId: context.user!.id, trainingMode: "distributed", synchronizationStrategy: "per_step" }));
  });
});
