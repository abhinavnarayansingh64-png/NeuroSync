# Live Receiver and Local GPU Agent Boundary

NeuroSync now persists receiver enrollment, heartbeats, availability, and job reservations in the shared database. When two authenticated receiver sessions register from separate laptops, each receiver becomes visible in the sender directory. A sender’s reservation is atomic: once a job acquires a receiver, its directory state changes to **Busy**, and other sender sessions cannot select it.

## Browser receiver mode

The receiver dashboard provides a browser-based heartbeat every 20 seconds. It is appropriate for collaborative availability and reservation coordination across laptops. GPU model, VRAM, and hourly rate are supplied by the receiver owner and are explicitly marked **self-reported**.

## Verified GPU telemetry and local execution

Web browsers cannot reliably enumerate CUDA devices, measure VRAM use, or launch local fine-tuning workloads. Running a job on a receiver’s actual GPU requires an authenticated local receiver agent that can:

1. Inspect the host GPU through CUDA or the vendor driver.
2. Send signed device and health heartbeats to the receiver API.
3. Download signed job artifacts and report progress, checkpoints, failures, and completion callbacks.
4. Run the approved training container with resource limits.

Until that agent is installed and paired, the platform’s server-side provider adapter remains responsible for execution. In the current configuration, this is the documented simulation fallback until a real external GPU provider or a receiver agent is activated.

## Multi-receiver distributed jobs

Premium distributed jobs select two or more currently available receivers. The server persists the topology, dataset-partition plan, per-worker assignment, and synchronization strategy:

| Strategy | Behaviour |
|---|---|
| Per-step synchronization | Workers synchronize gradients and checkpoint state after every optimization step. |
| Adaptive synchronization | The coordinator synchronizes based on loss divergence, latency, and interval budget. |

Assignments are recoverable, but end-to-end distributed execution also requires the local receiver agent or an external provider that implements the same job and callback contract.
