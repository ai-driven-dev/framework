import { describe, expect, it } from "vitest";
import { rootReleaseTags } from "../../../../src/contexts/distribution/domain/root-release.js";

describe("rootReleaseTags", () => {
  it("drops release-please per-component tags", () => {
    expect(rootReleaseTags(["aidd-refine-v1.0.0", "v4.0.0", "aidd-context-v1.0.0"])).toEqual([
      "v4.0.0",
    ]);
  });

  it("keeps a root tag carrying a prerelease suffix", () => {
    expect(rootReleaseTags(["v3.7.3-pm.1"])).toEqual(["v3.7.3-pm.1"]);
  });

  it("drops a v that is not followed by a digit", () => {
    expect(rootReleaseTags(["vnext", "v"])).toEqual([]);
  });

  it("keeps the order it was given", () => {
    expect(rootReleaseTags(["v4.0.0", "v3.9.1", "v10.0.0"])).toEqual([
      "v4.0.0",
      "v3.9.1",
      "v10.0.0",
    ]);
  });
});
