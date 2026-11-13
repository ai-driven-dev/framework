import { describe, expect, it } from "vitest";
import { manifestSection } from "../../../../../src/contexts/tools/domain/sections/manifest-section.js";

describe("a manifest section", () => {
  it("is neutral native until it states a translation mode", () => {
    expect(
      manifestSection({ manifestRelativePath: "plugin.json", pluginRootToken: "$X_PLUGIN_ROOT" })
        .translationMode
    ).toBeNull();
  });

  it("does not compile without the plugin root token", () => {
    // @ts-expect-error pluginRootToken is required on a manifest section
    manifestSection({ manifestRelativePath: null });
  });
});
