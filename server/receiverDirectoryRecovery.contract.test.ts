import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/NewJob.jsx"), "utf8");

describe("receiver directory recovery contract", () => {
  it("keeps a temporary receiver-directory failure recoverable from the job form", () => {
    expect(source).toContain("receiverDirectoryError");
    expect(source).toContain("Retry receiver directory");
    expect(source).toContain("onClick={() => refreshReceivers()}");
    expect(source).toContain("The live receiver directory is temporarily unavailable");
  });
});

