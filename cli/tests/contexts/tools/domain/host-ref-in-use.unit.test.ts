import { describe, expect, it } from "vitest";
import "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { hostRefInUse } from "../../../../src/contexts/tools/domain/registry.js";

describe("hostRefInUse — whether a ref the host lists is a plugin in use", () => {
  it("takes an enabled ref for one, at every host", () => {
    expect(hostRefInUse("claude", true)).toBe(true);
    expect(hostRefInUse("copilot", true)).toBe(true);
  });

  it("takes a disabled ref for one where uninstall removes the ref: the person disabled it", () => {
    expect(hostRefInUse("claude", false)).toBe(true);
  });

  it("takes a disabled ref for what an uninstall left where uninstall only disables it", () => {
    expect(hostRefInUse("copilot", false)).toBe(false);
  });
});
