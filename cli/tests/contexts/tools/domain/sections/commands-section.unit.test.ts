import { describe, expect, it } from "vitest";
import { CommandsSection } from "../../../../../src/contexts/tools/domain/sections/commands-section.js";

describe("CommandsSection file acceptance", () => {
  const cap = new CommandsSection({
    toolSuffix: ".claude.md",
    buildInstallPath: (fileName) => fileName,
    convertFrontmatter: (fm) => fm,
  });

  it("accepts its own suffix and a suffix belonging to no tool", () => {
    expect(cap.acceptsFileName("01-plan/plan.claude.md")).toBe(true);
    expect(cap.acceptsFileName("01-plan/plan.md")).toBe(true);
  });

  it("refuses another tool's suffix wherever the file sits", () => {
    expect(cap.acceptsFileName("a/b/plan.cursor.md")).toBe(false);
  });
});
