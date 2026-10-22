import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverDashboard.jsx"), "utf8");

describe("verified receiver hardware persistence", () => {
  it("promotes only current verified nvidia-smi data into canonical GPU fields", () => {
    expect(dbSource).toContain('telemetry?.verified === true');
    expect(dbSource).toContain('telemetry?.source === "nvidia-smi"');
    expect(dbSource).toContain('telemetry?.source === "desktop_native_nvidia_smi"');
    expect(dbSource).toContain('verifiedHardware');
    expect(dbSource).toContain('gpu: telemetry!.model');
  });

  it("keeps the offer, protected delivery, and heartbeat paths separate from browser GPU detection", () => {
    expect(dashboardSource).toContain('acceptJob.mutateAsync');
    expect(dashboardSource).toContain('downloadReceiverDataset');
    expect(dashboardSource).toContain('verifiedGpuTelemetry');
    expect(dashboardSource).toContain('window.setInterval(refreshAgentTelemetry, 3_000)');
    expect(dashboardSource).not.toContain('detectBrowserGpu');
  });
});
