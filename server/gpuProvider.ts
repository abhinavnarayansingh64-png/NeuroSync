import { randomBytes } from "node:crypto";
import * as neuro from "./neurosyncDb";

type DispatchableJob = {
  id: string;
  userId: number;
  name: string;
  baseModelId: string;
  config: unknown;
  datasetUrl: string | null;
  provider: string;
};

const config = () => ({
  apiKey: process.env.RUNPOD_API_KEY,
  endpointId: process.env.RUNPOD_ENDPOINT_ID,
  publicBaseUrl: process.env.GPU_PROVIDER_PUBLIC_BASE_URL?.replace(/\/$/, ""),
});

export function gpuRuntimeMode() {
  const { apiKey, endpointId, publicBaseUrl } = config();
  return apiKey && endpointId && publicBaseUrl ? "external" as const : "simulation" as const;
}

export async function dispatchTrainingJob(job: DispatchableJob) {
  if (gpuRuntimeMode() === "simulation") return { mode: "simulation" as const };

  const { apiKey, endpointId, publicBaseUrl } = config();
  const callbackToken = randomBytes(32).toString("base64url");
  const execution = await neuro.createProviderExecution({
    jobId: job.id,
    provider: "runpod",
    callbackToken,
    endpointId,
  });
  const webhook = `${publicBaseUrl}/api/gpu/runpod/callback/${execution.id}?token=${encodeURIComponent(callbackToken)}`;
  const payload = {
    input: {
      contract: "neurosync.training.v1",
      jobId: job.id,
      jobName: job.name,
      baseModelId: job.baseModelId,
      trainingConfig: job.config,
      datasetUrl: job.datasetUrl,
    },
    webhook,
    policy: { executionTimeout: 86_400_000, ttl: 172_800_000 },
  };

  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.id) {
    await neuro.setProviderDispatch({ executionId: execution.id, status: "dispatch_failed", payload: body });
    throw new Error(`RunPod rejected training submission (${response.status}).`);
  }
  await neuro.setProviderDispatch({ executionId: execution.id, providerJobId: String(body.id), status: String(body.status ?? "IN_QUEUE"), payload: body });
  return { mode: "external" as const, providerJobId: String(body.id) };
}
