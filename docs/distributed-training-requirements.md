# Distributed Fine-Tuning Requirements

Source: `NEUROSYNCFINAL.pptx`, slides 4 and 6, reviewed on 2026-08-21.

## Product workflow

Premium users need a choice between **single-GPU fine-tuning** and **distributed fine-tuning**. Distributed jobs select multiple eligible GPU receivers, partition the dataset, track checkpoints, account for network latency, detect failed nodes, and reassign work when capacity changes.

## Synchronization modes

The distributed workflow exposes two user-selectable strategies:

| Mode | User-facing intent | Orchestrator behavior |
|---|---|---|
| Per-step synchronization | Prioritize consistent progress | Synchronize gradients or adapters at every configured step boundary. |
| Adaptive synchronization | Prioritize throughput and resilience | Choose a synchronization interval from receiver capability, network latency, dataset size, and selected priority; revisit the interval when nodes change state. |

The orchestration model also requires checkpoint migration and fault recovery to preserve work when a receiver becomes unavailable.

## Monetization framing

The supplied revenue model combines a model fee and hourly compute fee. Membership is positioned as access to priority compute, improved GPU selection, and model discounts. Actual billing remains separate from entitlement gating and needs an approved payment integration before charging users.

## Implementation boundary

The web application can persist receiver heartbeats, availability, assignments, job partitions, synchronization strategy, checkpoints, and real-time job state across signed-in devices. Actual local CUDA execution and direct GPU telemetry require a receiver-side desktop agent or approved external GPU provider credentials; browser sessions alone cannot reliably expose or control a machine's discrete GPU.
