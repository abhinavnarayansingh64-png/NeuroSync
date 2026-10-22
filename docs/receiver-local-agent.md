# Legacy receiver local agent

The supported Receiver path is the **NeuroSync Electron desktop client**. Electron collects native host and NVIDIA telemetry directly, accepts job offers, receives protected datasets, and reports receiver state through the shared backend.

This document covers the optional loopback agent retained for transition and diagnostics. The hosted browser Receiver workspace does not use this agent for enrollment, job acceptance, dataset delivery, or hardware registration. New deployments should use the desktop client instead.

## Scope

The agent runs on the same Windows computer as the NVIDIA GPU and binds only to `127.0.0.1`. It can query a current NVIDIA snapshot through `nvidia-smi`, but it is not a cloud worker, a training executor, or a replacement for the Electron desktop client. It does not accept jobs or write datasets to a training directory.

## Windows setup

The receiver computer needs Node.js 20 or newer and an NVIDIA driver that provides `nvidia-smi`. First confirm the driver can report the adapter:

```bat
nvidia-smi
```

Copy the complete `local-agent` directory to the Windows computer, then run:

```bat
cd C:\path\to\local-agent
start_receiver_agent.bat
```

The launcher keeps the terminal open when startup fails. It defaults to the published NeuroSync origin. For a preview environment, set the exact browser origin before starting it:

```bat
set NS_ALLOWED_ORIGINS=https://3000-your-preview.manus.computer
start_receiver_agent.bat
```

## Local endpoints

| Endpoint | Purpose | Source |
| --- | --- | --- |
| `GET /health` | Confirms that the loopback process is running. | Agent process |
| `GET /status` | Reports agent version, bind address, and supported endpoints. | Agent process |
| `GET /gpu` | Returns a fresh GPU snapshot. | `nvidia-smi` |
| `GET /v1/telemetry` | Compatibility alias for `/gpu`. | Same GPU snapshot |

For every `/gpu` request, the agent queries the actual NVIDIA system command and returns only values it can read, including model, total/used/free VRAM, utilization, UUID, and observation time. An unavailable GPU or tool is reported with a diagnostic; no default model or VRAM is substituted.

The agent uses exact-origin CORS and accepts only configured origins. It never binds to the LAN or public internet. Origin-less requests are reserved for local command-line diagnostics.

## Diagnostic check

With the agent running, use another Command Prompt:

```bat
curl http://127.0.0.1:47831/health
curl http://127.0.0.1:47831/gpu
```

The health request should return HTTP 200. The GPU response should match the adapter and memory reported by `nvidia-smi` on that same machine. If the agent is stopped, the endpoint becomes unavailable; it does not simulate a connected receiver.

## Relationship to the desktop client

The current supported lifecycle is sender offer → Electron desktop acceptance → protected desktop dataset delivery → persisted transfer completion → dispatch → progress and server-derived earnings. The loopback agent is infrastructure telemetry only. It is retained for backwards compatibility and troubleshooting while desktop adoption is completed.

The Linux development sandbox has no NVIDIA device or `nvidia-smi`, so it can validate the process contract, unavailable diagnostics, and CORS boundary but cannot verify a real Windows adapter. Real Windows validation must be performed on the intended receiver machine.
