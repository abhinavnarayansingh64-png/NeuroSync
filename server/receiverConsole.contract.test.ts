import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const receiverSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverDashboard.jsx"), "utf8");
const historySource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverHistory.jsx"), "utf8");
const transferClientSource = readFileSync(resolve(process.cwd(), "client/src/services/datasetTransfer.js"), "utf8");
const persistenceSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");

describe("receiver console contract", () => {
  it("renders coordinator state and server-derived earnings without receiver-controlled availability actions", () => {
    expect(receiverSource).toContain("Coordinator state");
    expect(receiverSource).toContain("Projected active payout");
    expect(receiverSource).toContain("Accrued active payout");
    expect(receiverSource).not.toContain("changeAvailability");
    expect(receiverSource).not.toContain("setAvailability");
    expect(persistenceSource).toContain("export async function getReceiverEarnings");
    expect(persistenceSource).toContain('row.job.status === "completed"');
  });

  it("keeps the active offer or execution task on Overview and terminal history on its dedicated route", () => {
    expect(receiverSource).toContain("Current receiver assignment");
    expect(receiverSource).not.toContain('"Job history"');
    expect(receiverSource).toContain("Offer pending your explicit acceptance.");
    expect(receiverSource).toContain("Accept job & start delivery");
    expect(receiverSource).toContain("Open NeuroSync Desktop to accept or manage this assignment.");
    expect(historySource).toContain("Terminal assignments");
    expect(historySource).toContain("Completed, failed, and cancelled assignments only");
  });

  it("uses authenticated browser delivery and preserves staged sender upload progress", () => {
    expect(transferClientSource).toContain("previewAuthorizationHeader");
    expect(transferClientSource).toContain("request.setRequestHeader('Authorization', authorization)");
    expect(transferClientSource).toContain("Math.floor((event.loaded / event.total) * 4) * 25");
    expect(transferClientSource).toContain("downloadReceiverDataset");
    expect(transferClientSource).toContain("request.responseType = 'blob'");
  });
});
