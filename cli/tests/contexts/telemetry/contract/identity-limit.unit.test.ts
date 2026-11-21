import { describe, expect, it } from "vitest";
import { MAX_IDENTITY_LENGTH } from "../../../../src/contexts/telemetry/contract/identity-limit.js";

describe("the longest identifier a person may be named by", () => {
  it("is the 128 characters every refusal and prompt says", () => {
    expect(MAX_IDENTITY_LENGTH).toBe(128);
  });
});
