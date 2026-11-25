import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { userManifestPath } from "../../../../src/contexts/installation/domain/project-layout.js";

describe("locating the user manifest", () => {
  it("names manifest.json directly under the user config dir, no .aidd nesting", () => {
    expect(userManifestPath("/user-cache")).toBe(join("/user-cache", "manifest.json"));
  });
});
