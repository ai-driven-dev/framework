import { describe, expect, it } from "vitest";
import { CommandsSection } from "../../../../../src/contexts/tools/domain/sections/commands-section.js";

describe("CommandsSection", () => {
  it("writes the converted frontmatter and the body as a markdown file", () => {
    const section = new CommandsSection({
      toolSuffix: ".claude.md",
      buildInstallPath: (fileName) => fileName,
      convertFrontmatter: (fm, relativeFileName) => ({ ...fm, source: relativeFileName }),
    });

    const converted = section.convertFrontmatter({ a: 1 }, "plan.md");

    expect(section.serialize(converted, "Body.")).toBe(
      "---\na: '1'\nsource: 'plan.md'\n---\nBody."
    );
  });
});
