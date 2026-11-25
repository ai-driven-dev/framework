import { describe, expect, it } from "vitest";
import { parsePluginSpec } from "../../../../src/contexts/installation/contract/plugin-spec.js";

describe("reading a plugin spec", () => {
  it("answers a bare name with no version", () => {
    expect(parsePluginSpec("aidd-dev")).toEqual({ name: "aidd-dev" });
  });

  it("splits the version at the last @", () => {
    expect(parsePluginSpec("aidd-dev@1.2.3")).toEqual({ name: "aidd-dev", version: "1.2.3" });
  });

  it("keeps a leading @ as part of the name", () => {
    expect(parsePluginSpec("@scope/plugin")).toEqual({ name: "@scope/plugin" });
    expect(parsePluginSpec("@scope/plugin@2.0.0")).toEqual({
      name: "@scope/plugin",
      version: "2.0.0",
    });
  });
});
