import { describe, expect, it } from "vitest";
import { ToolSuffix } from "../../../../../src/contexts/tools/domain/profile/tool-suffix.js";
import { CapabilityConfigError } from "../../../../../src/shared/domain/errors.js";

describe("ToolSuffix", () => {
  it.each([".claude.md", ".agent.md", ".instructions.md"])("accepts %s", (value) => {
    expect(new ToolSuffix(value).value).toBe(value);
  });

  it.each([
    "",
    "claude.md",
    ".claude",
    ".Claude.md",
    ".claude-code.md",
    ".claude.mdc",
    "x.claude.md",
  ])("refuses %j, which is no tool suffix", (value) => {
    expect(() => new ToolSuffix(value)).toThrow(CapabilityConfigError);
  });

  describe("strip", () => {
    const suffix = new ToolSuffix(".claude.md");

    it("swaps the suffix of the file name for a plain markdown extension, keeping its directory", () => {
      expect(suffix.strip("a/b/plan.claude.md")).toBe("a/b/plan.md");
    });

    it("leaves a file name that does not carry the suffix as it is", () => {
      expect(suffix.strip("a/b/plan.cursor.md")).toBe("a/b/plan.cursor.md");
    });
  });

  describe("isForeign", () => {
    const suffix = new ToolSuffix(".cursor.md");

    it("tells a file name carrying the suffix, whatever its directory", () => {
      expect(suffix.isForeign("a/b/plan.cursor.md")).toBe(true);
    });

    it("does not read the directories for the suffix", () => {
      expect(suffix.isForeign("a.cursor.md/plan.md")).toBe(false);
    });
  });

  it("names the refused value and the expected shape", () => {
    expect(() => new ToolSuffix("claude")).toThrow(
      '"claude" is not a tool suffix, expected ".<tool>.md".'
    );
  });

  it("keeps the directory of a name that has one and strips a bare name too", () => {
    const suffix = new ToolSuffix(".claude.md");
    expect(suffix.strip("plan.claude.md")).toBe("plan.md");
    expect(suffix.isForeign("a/plan.claude.md")).toBe(true);
    expect(suffix.isForeign("a.claude.md/plan.md")).toBe(false);
  });
});
