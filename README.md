# NeuroSync

NeuroSync is a persistent AI fine-tuning marketplace with two client surfaces: a browser Sender workspace and an Electron desktop client that supports Sender and Receiver modes. Both clients use the same authenticated backend, database, job identifiers, receiver assignments, lifecycle transitions, and payout calculations.

## What is implemented

The application includes a public landing page, authenticated workspace routing, sender dataset and model workflows, receiver discovery, Premium and distributed fine-tuning configuration, job monitoring, receiver history, earnings analytics, and shared cross-session state. Receiver offers, acceptance, protected dataset delivery, dispatch gating, running progress, completion, failure recovery, and central payout calculations are persisted by the backend.

The browser Receiver experience is intentionally limited to account-level activity views and a desktop-app handoff. Native receiver hardware discovery and job acceptance belong to the Electron client. When a desktop receiver reports a live assignment, the browser can show the shared assignment state and desktop-reported runtime telemetry; it does not infer GPU or memory values through WebGPU, WebGL, manual entry, or simulation.

The Electron client uses a secure main process and preload bridge. It collects native host information through operating-system APIs and NVIDIA tooling when available, including GPU model, VRAM, utilization, temperature, power, driver, CPU, RAM, storage, CUDA toolkit, and PyTorch CUDA readiness. Unavailable values remain unavailable and include diagnostics. The browser and desktop clients do not create separate accounts, schemas, or job systems.

> Training execution is currently labelled **SIMULATION EXECUTION** until a real GPU training provider or local CUDA training adapter is connected. The provider-neutral integration boundary is retained for future activation.

## Architecture

| Layer | Current implementation |
| --- | --- |
| Browser client | React 18, Vite, React Router, Tailwind CSS, TanStack Query, tRPC client |
| Desktop client | Electron 33, secure `BrowserWindow`, context isolation, minimal preload bridge |
| Application server | Node.js, Express, TypeScript, tRPC |
| Persistence | MySQL/TiDB through Drizzle ORM |
| Authentication | Manus OAuth and authenticated server context |
| Payments | Stripe Premium entitlement and signed webhook flow |
| File storage | S3-compatible storage through the project storage helpers |
| Training boundary | Simulation adapter plus provider-neutral external GPU contract |
| Testing | Vitest, TypeScript checks, production build checks, source contracts |

The main source directories are organized as follows:

```text
client/       React pages, layouts, contexts, hooks, services, and UI components
electron/     Electron main process, preload bridge, native telemetry, diagnostics
server/       tRPC routers, database helpers, lifecycle logic, and tests
drizzle/      Database schema and migration metadata
shared/       Shared constants and types
local-agent/  Optional loopback-only legacy receiver agent for the documented fallback path
docs/         Desktop, receiver, storage, and integration documentation
```

## Local development

Use Node.js 20 or newer and pnpm. From the project root:

```bash
pnpm install
pnpm dev
```

The development server runs the authenticated web application and shared API. The exact local port is selected by the development configuration; the default development preview is normally available at `http://localhost:3000`.

Run the project checks with:

```bash
pnpm test
pnpm run check
pnpm run build
```

The application requires the environment values supplied by the managed project for database access, OAuth, storage, and optional Stripe behavior. Do not commit `.env` files or credentials. Use the project’s secret-management interface or your deployment environment to provide them.

## Electron desktop client

The desktop client loads the shared NeuroSync application and does not create a second backend. To run it against the deployed application:

```bash
pnpm desktop:start
```

To run it against a local development server already running on port 3000:

```bash
pnpm desktop:dev
```

To inspect native telemetry without opening the Electron window:

```bash
pnpm run desktop:diagnose
```

The diagnostic command uses actual local operating-system and NVIDIA sources. On systems without NVIDIA tooling, CUDA, or PyTorch, it reports those components as unavailable rather than fabricating values. A Windows RTX device is required to validate real NVIDIA output.

The configured Windows package command is:

```bash
pnpm desktop:package
```

It requests a 64-bit Windows NSIS target through electron-builder. A portable unsigned Windows archive is available separately for development testing, but a signed production installer still needs to be built and install-tested in a Windows build environment.

## Receiver workflow

A Receiver user should use the Electron client. At startup, the client offers Sender and Receiver modes. Receiver mode uses the shared authenticated identity and sends native hardware capabilities through the existing receiver enrollment and heartbeat flow. A sender sees the persisted receiver record and availability state through the same backend directory.

The receiver workflow keeps explicit offers and acceptance, protected dataset delivery, transfer-gated dispatch, shared polling/reconciliation, and server-derived earnings. The browser view can display shared status and history, but it does not accept jobs or register browser hardware. Those operations require the desktop client.

## Honest capability boundaries

The project does not implement encrypted execution, blockchain settlement, trusted execution environments, or local CUDA training. It also does not claim that browser WebGPU or WebGL identity is authoritative. These are deliberate future-extension boundaries, not hidden behavior.

Before a hackathon submission, validate the deployed OAuth flow, run the Electron client on the intended Windows machine, confirm the Hardware page reports the actual adapter, and test one complete sender-to-receiver lifecycle. State clearly in the demo when training is simulated.

## Useful documentation

- [`docs/desktop-client.md`](./docs/desktop-client.md) — Electron setup, native diagnostics, packaging, and Windows limitations.
- [`docs/receiver-local-agent.md`](./docs/receiver-local-agent.md) — optional loopback receiver-agent scope and fallback behavior.
- [`docs/receiver-browser-handoff-notes.md`](./docs/receiver-browser-handoff-notes.md) — browser-to-desktop Receiver boundary and UI decisions.
- [`docs/`](./docs/) — storage and integration notes.

## License

This repository is a NeuroSync project source distribution. Review the hackathon’s submission and AI-assistance policy before publishing the repository or demo materials.
