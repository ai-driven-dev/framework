import { describe, expect, it } from "vitest";
import { printIdentityResult } from "../../../../src/presentation/display/telemetry/telemetry-identity-display.js";
import { CapturingOutput } from "../../../shared/testing/capturing-output.fake.js";

function shown(result: Parameters<typeof printIdentityResult>[1]): CapturingOutput {
  const output = new CapturingOutput(false);
  printIdentityResult(output, result);
  return output;
}

describe("printIdentityResult", () => {
  it("says who the measurement names, and how to stop", () => {
    const output = shown({ status: "set", personId: "person-a" });
    expect(output.at("success")[0]).toContain('"person-a"');
    expect(output.at("success")[0]).toContain("--off");
  });

  it("says the person axis shows anonymous when nobody is named", () => {
    expect(shown({ status: "unset" }).at("info")[0]).toContain('shows "anonymous"');
    expect(shown({ status: "removed" }).at("success")[0]).toContain('shows "anonymous"');
  });

  it("says the identity was removed", () => {
    expect(shown({ status: "removed" }).at("success")[0]).toContain("removed");
  });

  it("explains what an identity is when one is refused", () => {
    expect(shown({ status: "refused" }).at("error")[0]).toBe(
      "An identity is one non-empty line of at most 128 characters."
    );
  });
});
