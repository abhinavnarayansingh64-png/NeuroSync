import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const transferSource = readFileSync(resolve(process.cwd(), "server/datasetTransfer.ts"), "utf8");
const validatorSource = readFileSync(resolve(process.cwd(), "client/src/services/datasetValidator.js"), "utf8");

describe("dataset transfer contract", () => {
  it("accepts only supported dataset formats up to 500 MB through an authenticated sender upload route", () => {
    expect(transferSource).toContain("MAX_DATASET_BYTES = 500 * 1024 * 1024");
    expect(transferSource).toContain('app.post("/api/datasets/upload"');
    expect(transferSource).toContain("sdk.authenticateRequest(req)");
    expect(transferSource).toContain("Datasets must be JSON, JSONL, or CSV files.");
    expect(validatorSource).toContain("MAX_FILE_BYTES = 500 * 1024 * 1024");
  });

  it("streams an accepted receiver dataset through an authenticated route and dispatches only after stream completion", () => {
    expect(transferSource).toContain('app.get("/api/receiver-datasets/:jobId"');
    expect(transferSource).toContain("markReceiverDatasetDownloadStarted");
    expect(transferSource).toContain("markReceiverDatasetDownloadCompleted");
    expect(transferSource).toContain("res.on(\"finish\"");
    expect(transferSource).toContain("if (!completed.dispatchReady || !completed.job) return;");
    expect(transferSource).toContain("await dispatchTrainingJob(completed.job)");
  });
});
