# NeuroSync Desktop Client

## Scope and shared architecture

NeuroSync Desktop is an **Electron shell around the existing React application**. It does not create a desktop-only account, backend, database, job schema, or payment ledger. Both the existing sender website and desktop Sender/Receiver workspaces use the same authenticated service, receiver directory, job identifiers, protected dataset metadata, assignment lifecycle, polling reconciliation, and server-side payout calculation.

The desktop window opens NeuroSync’s `/desktop` route. At startup, the user chooses **Sender** or **Receiver** for that Electron session. This choice is intentionally stored only in the desktop window’s session storage; selecting Receiver in the desktop client does not rewrite the website’s saved navigation preference. Sender mode reuses the existing dashboard, dataset upload, model selection, configuration, marketplace, jobs, cost, and analytics routes.

Electron is configured with context isolation and without renderer Node integration. The renderer receives only `window.neurosyncDesktop.getHardwareProfile()`, a narrow one-way request that invokes the native collector in the Electron main process. This follows Electron’s security guidance to avoid exposing unrestricted IPC or Node APIs to rendered content.[^electron-security]

## Receiver-native telemetry

Receiver Desktop collects local facts without WebGPU/WebGL or manual hardware entry. On NVIDIA systems it executes `nvidia-smi` and reports GPU model, total/used/free VRAM, utilization, temperature, power draw, driver version, and compute capability only when the installed tool exposes it. The profile also reports local RAM, CPU model/logical cores, physical CPU cores when Windows returns them, storage, OS/architecture, CUDA toolkit detection (`nvcc`), and PyTorch CUDA availability.

| Data source | Status sent to the backend | Behavior when unavailable |
|---|---|---|
| Electron main process + `nvidia-smi` | **Verified** only when a model and positive VRAM value are returned; source is `desktop_native_nvidia_smi` | Keeps fields unavailable and sends a diagnostic; never substitutes browser or manually entered data |
| Native OS APIs / Windows PowerShell | Informational system capability profile | Shows unavailable/diagnostic values without blocking the UI |
| `nvcc` and Python/PyTorch probe | Informational runtime readiness | Shows whether the local toolkit/runtime is detected; does not claim a model requires it unless catalog metadata states so |
| Browser WebGPU/WebGL and optional loopback agent | Existing web-receiver fallback paths | Remain separate from Electron-native verified telemetry |

Only verified `nvidia-smi` telemetry may promote the receiver’s canonical marketplace GPU model and VRAM fields. The existing receiver enrollment and heartbeat procedures persist the full desktop profile in `capabilities` and retain the current coordinator, offer, transfer, dispatch, and earnings behavior.

## Hardware and catalog readiness view

Receiver Desktop contains four distinct workspace areas: **Overview**, **Job History**, **Earnings & Analytics**, and **Hardware**. The Hardware page refreshes native GPU telemetry every three seconds and displays separated GPU, system, CUDA/PyTorch, storage, and catalog-readiness sections.

Readiness is deliberately narrow and truthful. It compares verified **total GPU VRAM** with the existing model catalog’s `recommendedVram` metadata. It returns **Ready**, **Not Suitable**, or **Unknown**. It does not invent CUDA, PyTorch, RAM, storage, quantization, or training requirements not present in the catalog. A Ready result is a hardware comparison only—not proof that local training can execute.

> **Current execution boundary:** Training continues to use the existing clearly labelled simulation workflow. This milestone does not add real local CUDA training, encryption, blockchain, or confidential-computing/TEE capabilities.

## Windows developer setup

Use a Windows machine when validating actual NVIDIA hardware. The packaged application is not required for the diagnostic workflow.

1. Install a current Node.js LTS release and `pnpm`.
2. Clone the NeuroSync project and open PowerShell in the project root.
3. Run `pnpm install`. If the package manager asks to approve Electron’s install script, approve **Electron** so it can obtain its supported runtime.
4. Verify the installed shell with `pnpm exec electron --version`.
5. Run `pnpm run desktop:diagnose` to print the local native profile as JSON. A machine without an NVIDIA driver, CUDA toolkit, or PyTorch reports explicit unavailable diagnostics; it does not fabricate substitute values.
6. For development against a locally running NeuroSync service, start the web service with `pnpm dev` and then run `pnpm desktop:dev`. The Electron window loads `http://localhost:3000/desktop` in this mode.
7. For the configured hosted route, run `pnpm desktop:start`. Sign in through the existing OAuth flow in the Electron window and select Receiver. Open **Hardware** to confirm that the local profile refreshes.

> Do not enter hardware specifications manually. The receiver should register or heartbeat only after the native collector has reported the actual local state.

## Packaging status

`pnpm desktop:package` is configured to build the web bundle and request a 64-bit Windows NSIS target through `electron-builder`. The Electron runtime, module syntax, diagnostic command, type check, and production web build have been validated in the Linux development sandbox. A Linux cross-package attempt reached Windows application packaging but stopped because `electron-builder` requires Wine for the remaining Windows signing/package step. Run the final package command from a Windows build environment, or provision Wine intentionally in a compatible Linux build environment. **A Windows NSIS installer has not yet been produced or validated**, and Linux headless validation cannot verify Windows OAuth behavior, a real RTX GPU, or Windows driver/CUDA/PyTorch values.

Before treating a Windows installer as release-ready, validate the following on the target Windows machine:

1. `pnpm run desktop:diagnose` returns the actual adapter and non-null VRAM through `nvidia-smi`.
2. `pnpm desktop:start` completes OAuth and opens the existing shared account.
3. Receiver selection shows the native profile, heartbeat updates the shared marketplace, and a sender sees the verified receiver state.
4. An existing offer is accepted, the protected dataset delivery completes, execution progresses under the existing simulation label, and server-derived earnings reconcile on both sender and receiver screens.
5. `pnpm desktop:package` completes, then the produced Windows installer is installed and retested outside the developer checkout.

[^electron-security]: [Electron Security: Context Isolation and IPC](https://www.electronjs.org/docs/latest/tutorial/security)
