import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const senderSource = readFileSync(resolve(process.cwd(), "client/src/pages/JobDetails.jsx"), "utf8");
const receiverSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverDashboard.jsx"), "utf8");
const persistenceSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");

describe("receiver offer and transfer visibility", () => {
  it("shows senders persisted acceptance and dataset-delivery states before execution", () => {
    expect(senderSource).toContain("awaiting_acceptance");
    expect(senderSource).toContain("datasetDownloadStartedAt");
    expect(senderSource).toContain("datasetDownloadCompletedAt");
    expect(senderSource).toContain("Training cannot start until this receiver explicitly accepts.");
    expect(senderSource).toContain("execution remains blocked.");
  });

  it("keeps receiver transfer state in the shared persistence lifecycle", () => {
    expect(receiverSource).toContain("Dataset delivery complete");
    expect(receiverSource).toContain("downloadReceiverDataset");
    expect(persistenceSource).toContain("markReceiverDatasetDownloadStarted");
    expect(persistenceSource).toContain("markReceiverDatasetDownloadCompleted");
    expect(persistenceSource).toContain("datasetDownloadCompletedAt");
  });
});
