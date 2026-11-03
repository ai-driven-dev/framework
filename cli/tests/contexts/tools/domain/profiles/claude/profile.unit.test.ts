import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";

describe("claude profile", () => {
  it("has .claude/ directory", () => {
    expect(claude.directory).toBe(".claude/");
  });

  it("names the one config file Claude reads, and where it goes", () => {
    expect(claude.configOutputPaths).toStrictEqual({ "settings.json": ".claude/settings.json" });
  });
});
