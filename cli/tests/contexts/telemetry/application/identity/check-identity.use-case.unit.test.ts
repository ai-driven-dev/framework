import { describe, expect, it } from "vitest";
import { CheckIdentity } from "../../../../../src/contexts/telemetry/application/identity/check-identity.use-case.js";

describe("checking an identity", () => {
  it("accepts what can name a person, trimmed", () => {
    expect(new CheckIdentity().execute({ typed: "  Ada Example " })).toEqual({
      status: "valid",
      personId: "Ada Example",
    });
  });

  it("refuses what cannot name anyone", () => {
    expect(new CheckIdentity().execute({ typed: "   " })).toEqual({ status: "refused" });
  });
});
