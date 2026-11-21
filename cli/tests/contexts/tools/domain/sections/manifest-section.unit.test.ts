import { describe, it } from "vitest";
import { manifestSection } from "../../../../../src/contexts/tools/domain/sections/manifest-section.js";

describe("a manifest section", () => {
  it("does not compile without the plugin root token", () => {
    // @ts-expect-error pluginRootToken is required on a manifest section
    manifestSection({ manifestRelativePath: null });
  });
});
