import { describe, expect, it } from "vitest";
import { estimateJobCost } from "../client/src/services/pricing.js";

const gemma = {
  id: "gemma-2b",
  basePriceInr: 40,
  hourlyRateInr: 90,
  mbPerHour: 12,
};

const dataset = { sizeBytes: 10 * 1024 * 1024 };

describe("marketplace pricing calibration", () => {
  it("uses the documented 10–15 minute Gemma 2B RTX 4090 reference and clamps the catalog price bands", () => {
    const estimate = estimateJobCost(gemma, dataset, 3, {
      receiver: { gpu: "NVIDIA RTX 4090", vramGb: 24 },
    });

    expect(estimate?.estimatedHours).toBe(0.2);
    expect(estimate?.referenceTime).toContain("10–15 min");
    expect(estimate?.basePriceInr).toBe(100);
    expect(estimate?.hourlyRateInr).toBe(60);
  });

  it("accounts for every selected distributed receiver while reducing coordinated runtime", () => {
    const single = estimateJobCost({ ...gemma, basePriceInr: 180, hourlyRateInr: 45 }, dataset, 3, {
      receiver: { gpu: "NVIDIA A100", vramGb: 40 },
    });
    const distributed = estimateJobCost({ ...gemma, basePriceInr: 180, hourlyRateInr: 45 }, dataset, 3, {
      trainingMode: "distributed",
      receiverCount: 2,
      receiver: { gpu: "NVIDIA A100", vramGb: 40 },
    });

    expect(distributed?.receiverCount).toBe(2);
    expect(distributed?.estimatedHours).toBeLessThanOrEqual(single?.estimatedHours ?? Infinity);
    expect(distributed?.estimatedTotalInr).toBeGreaterThanOrEqual(single?.estimatedTotalInr ?? 0);
  });
});
