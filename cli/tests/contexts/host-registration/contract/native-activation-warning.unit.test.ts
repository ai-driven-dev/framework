import { describe, expect, it } from "vitest";
import { nativeActivationWarning } from "../../../../src/contexts/host-registration/contract/native-activation-warning.js";

describe("naming a native activation warning", () => {
  it("leads with the step it was raised in, set off by a colon", () => {
    expect(nativeActivationWarning("build 'aidd' skipped")).toBe(
      "Native plugin activation: build 'aidd' skipped"
    );
  });
});
