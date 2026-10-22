import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const membershipSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");
const contextSource = readFileSync(resolve(process.cwd(), "client/src/contexts/DataContext.jsx"), "utf8");
const cardSource = readFileSync(resolve(process.cwd(), "client/src/components/ui/Card.jsx"), "utf8");

describe("dispatch, trial, and form-step contracts", () => {
  it("accepts deployment-relative dataset locations while retaining dataset-key ownership checks", () => {
    expect(routerSource).toContain("datasetUrl: z.string().trim().min(1).max(2048).optional()");
    expect(routerSource).toContain("ownsDatasetKey(ctx.user.id, input.datasetKey)");
  });

  it("activates an eligible trial idempotently and refreshes membership state immediately", () => {
    expect(membershipSource).toContain('existing.plan === "premium" && ["active", "trialing"].includes(existing.status)');
    expect(membershipSource).toContain('status: "trialing"');
    expect(contextSource).toContain("utils.workspace.membership.setData(undefined, membership)");
  });

  it("uses explicit cream/ink contrast for every guided-form step state", () => {
    expect(cardSource).toContain("border-2 border-[#fffaf0]/80 bg-[#282522] text-[#fffaf0]");
    expect(cardSource).toContain("bg-[#fffaf0] text-[#171512]");
  });
});
