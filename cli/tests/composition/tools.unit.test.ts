import { describe, expect, it } from "vitest";
import { wireTools } from "../../src/composition/tools.js";
import { REGISTERED_PROFILES } from "../../src/contexts/tools/domain/profiles/registered-profiles.js";

describe("wireTools", () => {
  it("holds every registered profile, in the order the registration list keeps", () => {
    const tools = wireTools();

    expect([...tools.inHelpOrder("ai"), ...tools.inHelpOrder("ide")]).toEqual(
      REGISTERED_PROFILES.map((profile) => profile.toolId)
    );
  });

  it("builds a catalog of its own on every call", () => {
    expect(wireTools()).not.toBe(wireTools());
  });
});
