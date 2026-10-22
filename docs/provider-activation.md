# Activating RunPod Execution

NeuroSync is intentionally running in **server-side simulation mode** until all three RunPod settings below are configured. In simulation mode, jobs, lifecycle stages, metrics, event history, and notifications remain persistent in the NeuroSync database, but no task is dispatched to external GPU infrastructure.

| Environment variable | Required value | Purpose |
|---|---|---|
| `RUNPOD_API_KEY` | A RunPod API key authorized to invoke the chosen endpoint | Authenticates `POST /v2/{endpointId}/run` requests from the NeuroSync server. |
| `RUNPOD_ENDPOINT_ID` | The identifier of the serverless RunPod endpoint that implements NeuroSync's training contract | Selects the endpoint that receives fine-tuning submissions. |
| `GPU_PROVIDER_PUBLIC_BASE_URL` | The public HTTPS origin of this NeuroSync deployment, without a trailing slash | Allows NeuroSync to give each RunPod execution a unique callback URL. |

> Store these values in the project's managed **Secrets** settings. Do not add them to source control, client code, or a committed `.env` file. `RUNPOD_API_KEY` is server-only and must never be prefixed with `VITE_`.

## Activation procedure

1. Build or select a RunPod serverless endpoint that accepts the `neurosync.training.v1` contract described in [`gpu-provider-architecture.md`](./gpu-provider-architecture.md). The endpoint needs access to the dataset URL and must return or relay lifecycle results for the submitted job.
2. Obtain a RunPod API key that may submit jobs to that endpoint. Configure `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID` in the managed Secrets settings.
3. Configure `GPU_PROVIDER_PUBLIC_BASE_URL` with the final public NeuroSync HTTPS URL, for example `https://neurosync.example.com`. A preview-only or local address cannot receive RunPod callbacks.
4. Restart the application after the settings are saved. `gpu.mode` will report `external` only when all three values are available; otherwise it deliberately remains `simulation`.
5. Submit one low-cost test job. On settlement confirmation, NeuroSync creates a per-execution callback token and posts the task to `https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run`.
6. Confirm the RunPod worker calls the webhook supplied in the dispatch payload. The callback URL includes a random, single-execution token and follows this shape:

   ```text
   POST {GPU_PROVIDER_PUBLIC_BASE_URL}/api/gpu/runpod/callback/{executionId}?token={callbackToken}
   ```

   The callback accepts a `status` field either at the request root or at `output.status`. NeuroSync validates the execution ID and token before recording the provider event; an invalid token is rejected with HTTP 401.

## Dispatch contract

When activated, NeuroSync sends the following compact envelope to the RunPod endpoint:

```json
{
  "input": {
    "contract": "neurosync.training.v1",
    "jobId": "...",
    "jobName": "...",
    "baseModelId": "...",
    "trainingConfig": {},
    "datasetUrl": "..."
  },
  "webhook": "https://.../api/gpu/runpod/callback/...",
  "policy": {
    "executionTimeout": 86400000,
    "ttl": 172800000
  }
}
```

The implementation records the provider execution and its callback token before dispatching. A rejected request is persisted as `dispatch_failed` and the corresponding training job moves to a failure state rather than silently appearing queued.

## Callback security model

RunPod's documented async request contract supports a top-level webhook URL and delivery retries, but does not document a provider request-signature header for that webhook. NeuroSync therefore uses the callback token embedded in the unique HTTPS callback URL as a per-execution bearer secret: it is generated server-side, stored only as a hash, and checked before any event can update a job. Keep callback URLs private and do not log them in client applications.

Use a **Restricted** RunPod API key with the minimum endpoint permissions needed for dispatch. RunPod likewise advises treating the key like a password. [1] [2]

## Pre-production validation

| Check | Expected outcome |
|---|---|
| All three variables are absent | The GPU mode indicator reads **Simulation** and no RunPod request is issued. |
| All three variables are set | The GPU mode indicator reads **External / RunPod**. |
| RunPod accepts the job | The provider execution stores the RunPod job ID and the job remains visible in NeuroSync. |
| Callback token is missing or invalid | The callback responds with HTTP 400 or 401 and makes no job update. |
| Valid queued/running/completed callback | The associated job events and persistent job status update for the owning user. |

The adapter is deliberately RunPod-first but isolated behind `server/gpuProvider.ts`; a later provider can implement the same submission and callback lifecycle without changing the client-side job workflow.

## References

[1]: https://docs.runpod.io/serverless/endpoints/send-requests "RunPod — Send API requests"
[2]: https://docs.runpod.io/get-started/api-keys "RunPod — Manage API keys"
