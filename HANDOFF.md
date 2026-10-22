# NeuroSync continuation notes

This document summarizes the current implementation boundaries and the safest places to continue development. The repository is a full-stack React, Node, tRPC, Drizzle, and Electron project.

## Current state

The browser client provides the public landing page and Sender workspace. The Electron client loads the same application and offers Sender and Receiver modes at startup. Both clients use the same authenticated user identity, backend API, database records, receiver directory, job IDs, assignment lifecycle, dataset metadata, and payout calculations.

Receiver operations are desktop-first. Electron native telemetry is collected in `electron/nativeTelemetry.mjs` and exposed through `electron/preload.mjs` to the renderer through the minimal `window.neurosyncDesktop` bridge. Browser Receiver pages retain account-level history and earnings views and can show shared assignment state, but they do not register browser hardware or accept jobs.

## Shared lifecycle

The authoritative lifecycle is implemented in `server/neurosyncDb.ts` and exposed through `server/routers.ts`. Do not introduce a second receiver registry, job schema, payout formula, or desktop-only backend. The existing flow persists receiver offers, acceptance, protected dataset delivery, dispatch gating, running/completed state, polling reconciliation, and receiver earnings.

When extending a lifecycle transition, update the data-layer behavior first, then the tRPC contract, then the relevant sender and receiver pages. Preserve idempotency and ownership checks around receiver acceptance and dataset delivery. Keep simulation transitions clearly labelled until a real execution adapter is enabled.

## Native telemetry boundary

Electron uses native operating-system APIs for CPU, RAM, storage, platform, and architecture. NVIDIA fields are populated from `nvidia-smi` when available. CUDA toolkit and PyTorch CUDA readiness are detected independently. A missing tool, unsupported platform, or unavailable field must remain `null` or an explicit unavailable diagnostic.

Do not use WebGPU, WebGL, renderer strings, manual model entry, or default VRAM values as authoritative desktop hardware. The browser detector remains a restricted fallback for browser-specific capability information and must not overwrite verified native desktop telemetry. Verified marketplace GPU promotion is guarded by source and freshness checks in the server data layer.

## Local development

```bash
pnpm install
pnpm dev
pnpm test
pnpm run check
pnpm run build
```

Run the desktop client against the deployed application with `pnpm desktop:start`. Run it against a local server with `pnpm desktop:dev`. Inspect native telemetry without opening the UI using `pnpm run desktop:diagnose`. Package a Windows NSIS target with `pnpm desktop:package` from a suitable Windows build environment. Do not commit environment files or credentials.

## Main continuation points

| Concern | Primary files |
| --- | --- |
| Client routes and workspace modes | `client/src/App.jsx`, `client/src/layouts/AppLayout.jsx`, `client/src/pages/DesktopLaunch.jsx` |
| Receiver desktop UI | `client/src/pages/ReceiverDashboard.jsx`, `client/src/pages/ReceiverHardware.jsx`, `client/src/services/desktopRuntime.js` |
| Browser Receiver handoff | `client/src/services/desktopDownload.js`, `client/src/hooks/useReceiverIdentity.js`, receiver history and earnings pages |
| Native desktop runtime | `electron/main.mjs`, `electron/preload.mjs`, `electron/nativeTelemetry.mjs`, `electron/diagnose-native.mjs` |
| Shared lifecycle and payout | `server/neurosyncDb.ts`, `server/routers.ts`, `drizzle/schema.ts` |
| Regression contracts | `server/*contract.test.ts`, `server/*.test.ts` |
| Product and setup documentation | `README.md`, `docs/desktop-client.md`, `docs/receiver-local-agent.md` |

## Remaining real-device validation

The sandbox can validate syntax, type checking, production builds, source contracts, and native diagnostic behavior on its own host. It cannot validate the user’s Windows RTX 3050, Windows OAuth session, driver/CUDA/PyTorch installation, or end-to-end multi-device behavior. Those checks must be performed on the intended Windows machine. Record actual outputs rather than replacing unavailable values with examples.

The configured Windows installer has not been install-tested. The portable unsigned build is suitable for development testing, but a production submission should disclose its unsigned status or provide a Windows-built installer.

## Future boundaries

Encryption, blockchain settlement, trusted execution environments, and real local CUDA training are not implemented in this migration. Add them only behind explicit contracts and review the security implications before changing the current simulation or payout behavior.
