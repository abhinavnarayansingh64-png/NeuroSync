import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const agentSource = readFileSync(resolve(process.cwd(), "local-agent/receiver-agent.mjs"), "utf8");
const clientSource = readFileSync(resolve(process.cwd(), "client/src/services/receiverAgent.js"), "utf8");
const receiverSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverDashboard.jsx"), "utf8");
const documentation = readFileSync(resolve(process.cwd(), "docs/receiver-local-agent.md"), "utf8");

describe("optional local receiver-agent contract", () => {
  it("queries nvidia-smi only from a loopback process restricted to configured origins", () => {
    expect(agentSource).toContain("'nvidia-smi'");
    expect(agentSource).toContain(".listen(port, '127.0.0.1'");
    expect(agentSource).toContain("NS_ALLOWED_ORIGINS");
    expect(agentSource).toContain("allowedOrigins.has(origin)");
    expect(agentSource).not.toContain("Access-Control-Allow-Origin', '*'");
  });

  it("exposes health, status, GPU telemetry and explicit NVIDIA failure diagnostics without arbitrary command execution", () => {
    expect(agentSource).toContain("pathname === '/health'");
    expect(agentSource).toContain("pathname === '/status'");
    expect(agentSource).toContain("pathname !== '/gpu' && pathname !== '/v1/telemetry'");
    expect(agentSource).toContain("nvidia_smi_not_found");
    expect(agentSource).toContain("nvidia_smi_failed");
    expect(agentSource).toContain("memory.used");
    expect(agentSource).toContain("utilization.gpu");
  });

  it("keeps the local agent optional for legacy web setups and reserves verified status for fresh nvidia-smi telemetry", () => {
    expect(clientSource).toContain("payload?.source !== 'nvidia-smi'");
    expect(clientSource).toContain("telemetry_available");
    expect(clientSource).toContain("vramUsedGb");
    expect(clientSource).toContain("utilizationPct");
    expect(clientSource).toContain("agent_unreachable");
    expect(clientSource).toContain("LOCAL_AGENT_BASE_URL");
    expect(receiverSource).not.toContain("detectBrowserGpu");
    expect(receiverSource).toContain("desktop_native_nvidia_smi");
    expect(documentation).toContain("start_receiver_agent.bat");
    expect(documentation).toContain("Electron desktop client");
    expect(documentation).toContain("optional loopback agent");
  });
});
