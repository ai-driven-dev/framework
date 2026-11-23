import { describe, expect, it } from "vitest";
import { toleratingUnreadableRefs } from "../../../../src/contexts/machine-claims/application/shared-source-reference-support.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";

describe("when the refs cannot be read", () => {
  it("propagates any failure that is not an unreadable registry", async () => {
    await expect(
      toleratingUnreadableRefs(new CapturingLogger(), "fallback", async () => {
        throw new Error("a bug, not a corrupted file");
      })
    ).rejects.toThrow("a bug, not a corrupted file");
  });
});
