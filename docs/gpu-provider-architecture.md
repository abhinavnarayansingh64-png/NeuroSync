# External GPU Provider Architecture

NeuroSync will use a provider-neutral job contract and a first adapter for Runpod Serverless. The adapter will submit long-running work asynchronously, retain the provider job identifier, accept completion callbacks, retrieve terminal status when callbacks are delayed, and write all state transitions into the product event stream.

Runpod’s queue-based endpoints accept asynchronous work through `POST https://api.runpod.ai/v2/{endpointId}/run` with bearer authentication and a required `input` object. They expose `/status`, `/cancel`, and retry operations and permit a per-request `webhook` URL. Its documentation states that failed callback deliveries are retried twice at ten-second intervals, so NeuroSync’s callback handler must be idempotent and return a success response only after its event write is committed. Runpod also states that asynchronous results are retained for thirty minutes, so the provider adapter must persist artifact URLs and terminal metadata promptly. Execution policy can define `executionTimeout` and `ttl`; both are limited to seven days. [1]

Vast.ai has a REST API with bearer-token authentication and documents notifications and webhooks, making it suitable for a future adapter. [2] Lambda Cloud exposes instance-management APIs, but its documented outgoing webhooks are for support-ticket events rather than training completion; it will therefore remain a future instance-orchestration adapter rather than the first serverless job adapter. [3]

## Integration Boundary

| Responsibility | NeuroSync backend | GPU provider adapter |
| --- | --- | --- |
| Identity and authorization | Owns accounts, roles, jobs, and access control | Receives only job-scoped provider credentials |
| Dataset and artifact references | Creates durable storage references and records metadata | Consumes signed input URLs and returns output references |
| Job state | Records an append-only event stream and determines user-visible status | Maps provider states to the neutral status contract |
| Callback security | Enforces a per-job opaque callback token and idempotency key | Sends the documented provider callback payload |
| Retry and reconciliation | Retries safe submissions and polls only as a fallback | Performs provider-specific submit, status, cancel, and error handling |

## References

[1]: https://docs.runpod.io/serverless/endpoints/send-requests "Runpod: Send API requests"
[2]: https://docs.vast.ai/api-reference/introduction "Vast.ai API Reference"
[3]: https://docs.lambda.ai/public-cloud/cloud-api/ "Lambda Cloud API"
[4]: https://docs.runpod.io/serverless/endpoints/overview "Runpod Serverless endpoint overview"
