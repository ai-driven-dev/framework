import { describe, expect, it } from "vitest";
import { dropSourceClaim } from "../../../../../src/contexts/machine-claims/application/shared-source/drop-source-claim.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { RecordingSourceReferences } from "../../testing/recording-source-references.fake.js";

function claims(references?: RecordingSourceReferences) {
  return dropSourceClaim(new CapturingLogger(), references);
}

describe("dropping this project's claim on the shared source", () => {
  it("removes the claim under the root it resolved", async () => {
    const references = new RecordingSourceReferences();

    await claims(references)("/project");

    expect(references.removed).toEqual(["/project"]);
  });

  it("removes nothing when no root was resolved before the project was cleaned", async () => {
    const references = new RecordingSourceReferences();

    await claims(references)(undefined);

    expect(references.removed).toEqual([]);
  });

  it("does nothing, and does not fail, when no references file is wired", async () => {
    await expect(claims(undefined)("/project")).resolves.toBeUndefined();
  });
});
