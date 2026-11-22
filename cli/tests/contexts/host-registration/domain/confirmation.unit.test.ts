import { describe, expect, it } from "vitest";
import { skippedWarning } from "../../../../src/contexts/host-registration/domain/confirmation.js";

describe("wording a skipped native step", () => {
  it("words a refused native step with its label and the host's reason", () => {
    expect(skippedWarning("register marketplace 'aidd'")("exit 1")).toBe(
      "Native plugin activation — register marketplace 'aidd' skipped: exit 1"
    );
  });
});
