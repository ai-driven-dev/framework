import { describe, expect, it } from "vitest";
import { FRAMEWORK_BUILD_MODES } from "../../../../src/contexts/tools/contract/tool-profile.js";

describe("the framework's build modes", () => {
  it("lists the two layouts a build takes, the marketplace dist first", () => {
    expect([...FRAMEWORK_BUILD_MODES]).toStrictEqual(["marketplace", "flat"]);
  });
});
