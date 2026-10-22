import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const overviewSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverDashboard.jsx"), "utf8");
const historySource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverHistory.jsx"), "utf8");
const earningsSource = readFileSync(resolve(process.cwd(), "client/src/pages/ReceiverEarnings.jsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.jsx"), "utf8");

describe("receiver history and analytics contract", () => {
  it("uses one server-side payout calculation for overview, history, and analytics", () => {
    expect(dbSource).toContain("export function calculateReceiverPayout");
    expect(dbSource).toContain("export async function listReceiverHistory");
    expect(dbSource).toContain("export async function getReceiverAnalytics");
    expect(routerSource).toContain("history:");
    expect(routerSource).toContain("analytics:");
    expect(historySource).toContain("trpc.receivers.history");
    expect(earningsSource).toContain("trpc.receivers.analytics");
  });

  it("keeps terminal history away from the live receiver overview and registers separate routes", () => {
    expect(overviewSource).not.toContain('"Job history"');
    expect(overviewSource).toContain("Today’s earnings");
    expect(appSource).toContain('path="/receiver/history"');
    expect(appSource).toContain('path="/receiver/earnings"');
    expect(earningsSource).toContain("LineChart");
  });
});
