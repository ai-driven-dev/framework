import { describe, expect, it } from "vitest";
import { CommandsSection } from "../../../../../src/contexts/tools/domain/sections/commands-section.js";

describe("CommandsSection", () => {
  it("converts the frontmatter by the file's relative name", () => {
    const section = new CommandsSection({
      toolSuffix: ".claude.md",
      buildInstallPath: (fileName) => fileName,
      convertFrontmatter: (fm, relativeFileName) => ({ ...fm, source: relativeFileName }),
    });

    expect(section.convertFrontmatter({ a: 1 }, "plan.md")).toEqual({ a: 1, source: "plan.md" });
  });
});
