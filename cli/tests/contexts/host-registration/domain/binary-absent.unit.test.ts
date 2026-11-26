import { describe, expect, it } from "vitest";
import { binaryAbsentNotice } from "../../../../src/contexts/host-registration/domain/binary-absent.js";

describe("saying what a host's missing CLI leaves standing", () => {
  it("names the binary twice: what it left, and that it is not on the PATH", () => {
    expect(binaryAbsentNotice("kimi", "2 plugin(s)")).toBe(
      "kimi: 2 plugin(s) left in place, the kimi CLI is not on the PATH."
    );
  });
});
