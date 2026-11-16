import { describe, expect, it } from "vitest";
import { ReleaseClaims } from "../../../../src/contexts/machine-claims/application/release-claims.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { RecordingSourceReferences } from "./recording-source-references.js";

function claims(references?: RecordingSourceReferences) {
  return new ReleaseClaims(
    new InMemoryFileAdapter(),
    new CapturingLogger(),
    { frameworkMarketplaceName: "aidd-framework", platform: process.platform },
    undefined,
    references
  );
}

describe("dropping this project's claim on the shared source", () => {
  it("removes the claim under the root it resolved", async () => {
    const references = new RecordingSourceReferences();

    await claims(references).drop("/project");

    expect(references.removed).toEqual(["/project"]);
  });

  it("removes nothing when no root was resolved before the project was cleaned", async () => {
    const references = new RecordingSourceReferences();

    await claims(references).drop(undefined);

    expect(references.removed).toEqual([]);
  });

  it("does nothing, and does not fail, when no references file is wired", async () => {
    await expect(claims(undefined).drop("/project")).resolves.toBeUndefined();
  });
});
