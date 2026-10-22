import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const detectorSource = readFileSync(resolve(process.cwd(), "client/src/services/gpuDetection.js"), "utf8");
const receiverSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverDashboard.jsx"), "utf8");
const receiverDbSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");

describe("browser GPU fallback safety contract", () => {
  it("uses a high-performance WebGPU adapter first and WebGL only as a feature-detected fallback", () => {
    expect(detectorSource).toContain("navigator.gpu.requestAdapter");
    expect(detectorSource).toContain("powerPreference: preference");
    expect(detectorSource).toContain("const preference = 'high-performance'");
    expect(detectorSource).toContain("const info = adapter?.info");
    expect(detectorSource).not.toContain("requestAdapterInfo");
    expect(detectorSource).toContain("WEBGL_debug_renderer_info");
    expect(detectorSource).toContain("getContext('webgl2')");
  });

  it("returns one normalized object and never elevates browser data to verified runtime telemetry", () => {
    expect(detectorSource).toContain("verified: false");
    expect(detectorSource).toContain("vramGb: null");
    expect(detectorSource).toContain("exactModelAvailable: false");
    expect(detectorSource).toContain("model: null");
    expect(detectorSource).not.toContain("RTX 4060 → assume");
  });

  it("keeps browser detection out of the Receiver workspace and reserves job operations for desktop", () => {
    expect(receiverSource).not.toContain("browserGpuDetection: browserGpu");
    expect(receiverSource).not.toContain("browser_detected_unverified");
    expect(receiverSource).not.toContain("Optional local agent");
    expect(receiverSource).toContain("Desktop receiver required");
  });

  it("rejects software renderer strings as physical browser GPU models", () => {
    expect(detectorSource).toContain("microsoft basic render driver");
    expect(detectorSource).toContain("swiftshader");
    expect(detectorSource).toContain("llvmpipe");
    expect(detectorSource).toContain("softwareRenderer");
    expect(detectorSource).toContain("WebGPU exposed a software/fallback adapter");
    expect(detectorSource).toContain("model: exactModelAvailable ? rawInfo.description : null");
    expect(receiverSource).not.toContain("GPU-only browser limitation · software/fallback adapter");
  });

  it("keeps browser detection metadata separate from canonical receiver hardware", () => {
    expect(receiverDbSource).toContain("browserModelIsUnavailable");
    expect(receiverDbSource).toContain("canonicalGpu");
    expect(receiverDbSource).toContain("must never become canonical hardware");
    expect(receiverSource).not.toContain("browserGpu?.exactModelAvailable ? browserGpu.model : 'Physical GPU not exposed'");
  });

  it("keeps browser WebGPU metadata available to the fallback service without rendering it in the Receiver workspace", () => {
    expect(detectorSource).toContain("isFallbackAdapter");
    expect(detectorSource).toContain("adapterInfoAvailable");
    expect(detectorSource).toContain("maxBufferSize");
    expect(detectorSource).toContain("maxStorageBufferBindingSize");
    expect(receiverSource).not.toContain("WebGPU diagnostics");
    expect(receiverSource).not.toContain("Fallback adapter");
    expect(receiverSource).not.toContain("adapter.info");
    expect(receiverSource).not.toContain("browser does not expose physical VRAM");
  });
});
