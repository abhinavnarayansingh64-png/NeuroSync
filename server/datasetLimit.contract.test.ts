import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const validatorSource = readFileSync(resolve(process.cwd(), "client/src/services/datasetValidator.js"), "utf8");
const uploadSource = readFileSync(resolve(process.cwd(), "client/src/components/DatasetUpload.jsx"), "utf8");

describe("dataset size presentation", () => {
  it("keeps the visible upload limit aligned with the enforced 500 MB validation limit", () => {
    expect(validatorSource).toContain("MAX_FILE_BYTES = 500 * 1024 * 1024");
    expect(uploadSource).toContain("up to 500 MB");
  });
});

