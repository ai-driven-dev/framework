import { describe, expect, it } from "vitest";
import { kimi } from "../../../../../../src/composition/tool-profiles/kimi.js";
import { present } from "../../../../../shared/testing/present.builder.js";

describe("building Kimi's flat contract", () => {
  it("ships no hooks, because Kimi reads them only from the user's own config", () => {
    const { hooks } = present(kimi.buildContracts.flat)().artifacts;

    expect(hooks).toEqual({ supported: false, reason: expect.stringContaining("user-level") });
  });
});
