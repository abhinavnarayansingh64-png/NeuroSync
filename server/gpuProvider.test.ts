import { afterEach, describe, expect, it, vi } from "vitest";

const { providerDb } = vi.hoisted(() => ({
  providerDb: {
    createProviderExecution: vi.fn(),
    setProviderDispatch: vi.fn(),
  },
}));

vi.mock("./neurosyncDb", () => providerDb);

import { dispatchTrainingJob, gpuRuntimeMode } from "./gpuProvider";

const savedEnv = {
  RUNPOD_API_KEY: process.env.RUNPOD_API_KEY,
  RUNPOD_ENDPOINT_ID: process.env.RUNPOD_ENDPOINT_ID,
  GPU_PROVIDER_PUBLIC_BASE_URL: process.env.GPU_PROVIDER_PUBLIC_BASE_URL,
};

const restoreEnv = (key: keyof typeof savedEnv) => {
  const value = savedEnv[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

const dispatchableJob = {
  id: "job_provider_test",
  userId: 1,
  name: "provider-check",
  baseModelId: "llama-test",
  config: { learningRate: 0.0002 },
  datasetUrl: "https://datasets.example.test/train.jsonl",
  provider: "runpod",
};

afterEach(() => {
  restoreEnv("RUNPOD_API_KEY");
  restoreEnv("RUNPOD_ENDPOINT_ID");
  restoreEnv("GPU_PROVIDER_PUBLIC_BASE_URL");
  providerDb.createProviderExecution.mockReset();
  providerDb.setProviderDispatch.mockReset();
  vi.unstubAllGlobals();
});

describe("GPU provider runtime mode", () => {
  it("stays in durable server simulation mode until all provider configuration is supplied", async () => {
    delete process.env.RUNPOD_API_KEY;
    delete process.env.RUNPOD_ENDPOINT_ID;
    delete process.env.GPU_PROVIDER_PUBLIC_BASE_URL;

    expect(gpuRuntimeMode()).toBe("simulation");
    await expect(dispatchTrainingJob({ ...dispatchableJob, id: "job_simulation_test", datasetUrl: null })).resolves.toEqual({ mode: "simulation" });
    expect(providerDb.createProviderExecution).not.toHaveBeenCalled();
  });

  it("records an execution and sends the signed callback contract when RunPod is configured", async () => {
    process.env.RUNPOD_API_KEY = "runpod-secret";
    process.env.RUNPOD_ENDPOINT_ID = "endpoint-123";
    process.env.GPU_PROVIDER_PUBLIC_BASE_URL = "https://neurosync.example.test/";
    providerDb.createProviderExecution.mockResolvedValue({ id: "execution_123" });
    providerDb.setProviderDispatch.mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "runpod_456", status: "IN_QUEUE" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(dispatchTrainingJob(dispatchableJob)).resolves.toEqual({ mode: "external", providerJobId: "runpod_456" });
    expect(providerDb.createProviderExecution).toHaveBeenCalledWith(expect.objectContaining({
      jobId: "job_provider_test",
      provider: "runpod",
      endpointId: "endpoint-123",
      callbackToken: expect.stringMatching(/^[A-Za-z0-9_-]+$/),
    }));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.runpod.ai/v2/endpoint-123/run",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer runpod-secret", "Content-Type": "application/json" },
      }),
    );

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(request.body));
    expect(payload.input).toEqual(expect.objectContaining({
      contract: "neurosync.training.v1",
      jobId: "job_provider_test",
      datasetUrl: "https://datasets.example.test/train.jsonl",
    }));
    expect(payload.webhook).toMatch(/^https:\/\/neurosync\.example\.test\/api\/gpu\/runpod\/callback\/execution_123\?token=/);
    expect(providerDb.setProviderDispatch).toHaveBeenCalledWith(expect.objectContaining({
      executionId: "execution_123",
      providerJobId: "runpod_456",
      status: "IN_QUEUE",
    }));
  });
});
