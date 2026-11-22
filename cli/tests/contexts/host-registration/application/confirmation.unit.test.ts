import { describe, expect, it } from "vitest";
import {
  bestEffortNativeCall,
  skippedWarning,
} from "../../../../src/contexts/host-registration/application/confirmation.js";

const refused = () => ({ detail: "exit 1" });

describe("bestEffortNativeCall", () => {
  it("confirms a call that ran to completion, with no warning", () => {
    const warnings: string[] = [];

    expect(
      bestEffortNativeCall(
        () => undefined,
        (reason) => reason,
        (warning) => warnings.push(warning)
      )
    ).toStrictEqual({ confirmed: true });
    expect(warnings).toEqual([]);
  });

  it("refuses a call the host's own CLI refused, and hands the caller's warning to the sink", () => {
    const warnings: string[] = [];

    expect(
      bestEffortNativeCall(
        refused,
        (reason) => `claude marketplace remove failed: ${reason}`,
        (warning) => warnings.push(warning)
      )
    ).toStrictEqual({ confirmed: false, warning: "claude marketplace remove failed: exit 1" });
    expect(warnings).toEqual(["claude marketplace remove failed: exit 1"]);
  });

  it("propagates any failure that is not the host CLI refusing", () => {
    expect(() =>
      bestEffortNativeCall(
        (): never => {
          throw new Error("activator bug");
        },
        (reason) => reason,
        () => undefined
      )
    ).toThrow("activator bug");
  });
});

describe("skippedWarning", () => {
  it("words a refused native step with its label and the host's reason", () => {
    expect(skippedWarning("register marketplace 'aidd'")("exit 1")).toBe(
      "Native plugin activation — register marketplace 'aidd' skipped: exit 1"
    );
  });
});
