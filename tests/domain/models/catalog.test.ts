import { describe, expect, it } from "vitest";
import { type CatalogFile, generateCatalogContent } from "../../../src/domain/models/catalog.js";

function makeFile(
  frameworkPath: string,
  installedPath: string,
  toolId = "claude",
  frontmatter: Record<string, unknown> = {}
): CatalogFile {
  return { frameworkPath, installedPath, toolId, frontmatter };
}

describe("generateCatalogContent", () => {
  it("returns header + 'No content installed.' for empty files", () => {
    const result = generateCatalogContent([], "aidd_docs");

    expect(result).toContain("# AIDD Framework Catalog");
    expect(result).toContain("No content installed.");
    expect(result).not.toContain("###");
  });

  it("groups by framework section (first path component) with h3", () => {
    const files = [
      makeFile("agents/alexia.md", ".claude/agents/alexia.md", "claude", {
        description: "Clarity agent",
      }),
    ];

    const result = generateCatalogContent(files, "aidd_docs");

    expect(result).toContain("### `agents`");
    expect(result).toContain("[alexia.md](../.claude/agents/alexia.md)");
    expect(result).not.toContain("No content installed.");
  });

  it("generates subfolder subsections with h4", () => {
    const files = [
      makeFile("commands/04_code/implement.md", ".claude/commands/aidd/04/implement.md", "claude", {
        description: "Implement plan",
      }),
    ];

    const result = generateCatalogContent(files, "aidd_docs");

    expect(result).toContain("### `commands`");
    expect(result).toContain("#### `commands/04_code`");
    expect(result).toContain("[implement.md](../.claude/commands/aidd/04/implement.md)");
  });

  it("generates Table of Contents from h3/h4 headings", () => {
    const files = [
      makeFile("agents/alexia.md", ".claude/agents/alexia.md"),
      makeFile("commands/04_code/implement.md", ".claude/commands/aidd/04/implement.md"),
    ];

    const result = generateCatalogContent(files, "aidd_docs");

    expect(result).toContain("## Table of Contents");
    expect(result).toContain("- [agents](#agents)");
    expect(result).toContain("- [commands](#commands)");
    expect(result).toContain("  - [commands/04_code](#commands04_code)");
  });

  it("adds description column when frontmatter has description", () => {
    const files = [
      makeFile("agents/alexia.md", ".claude/agents/alexia.md", "claude", {
        description: "Clarity challenger",
      }),
    ];

    const result = generateCatalogContent(files, "aidd_docs");

    expect(result).toContain("| Description |");
    expect(result).toContain("`Clarity challenger`");
  });

  it("merges same-frameworkPath entries into one row with an Installed column showing tool links", () => {
    const files = [
      makeFile("agents/alexia.md", ".claude/agents/alexia.md", "claude"),
      makeFile("agents/alexia.md", ".github/agents/alexia.agent.md", "copilot"),
    ];

    const result = generateCatalogContent(files, "aidd_docs");

    // Filename appears once as plain text
    expect(result).toContain("alexia.md");
    // Installed column with tool-named links
    expect(result).toContain("| Installed |");
    expect(result).toContain("[claude](../.claude/agents/alexia.md)");
    expect(result).toContain("[copilot](../.github/agents/alexia.agent.md)");
    expect(result).toContain(" · ");
    // Only one data row for this file
    const dataRows = result
      .split("\n")
      .filter((l) => l.startsWith("| ") && !l.startsWith("| File") && !l.startsWith("|---"));
    expect(dataRows).toHaveLength(1);
  });

  it("uses direct file link (no Installed column) when only one tool is installed", () => {
    const files = [makeFile("agents/alexia.md", ".claude/agents/alexia.md", "claude")];

    const result = generateCatalogContent(files, "aidd_docs");

    expect(result).toContain("[alexia.md](../.claude/agents/alexia.md)");
    expect(result).not.toContain("| Installed |");
  });

  it("computes correct relative links for custom docsDir", () => {
    const files = [makeFile("agents/alexia.md", ".claude/agents/alexia.md")];

    const result = generateCatalogContent(files, "my_docs");

    expect(result).toContain("[alexia.md](../.claude/agents/alexia.md)");
  });

  it("sorts sections alphabetically", () => {
    const files = [
      makeFile("skills/challenge/SKILL.md", ".claude/skills/challenge/SKILL.md"),
      makeFile("agents/alexia.md", ".claude/agents/alexia.md"),
      makeFile("commands/04_code/implement.md", ".claude/commands/aidd/04/implement.md"),
    ];

    const result = generateCatalogContent(files, "aidd_docs");

    const agentsIdx = result.indexOf("### `agents`");
    const commandsIdx = result.indexOf("### `commands`");
    const skillsIdx = result.indexOf("### `skills`");

    expect(agentsIdx).toBeLessThan(commandsIdx);
    expect(commandsIdx).toBeLessThan(skillsIdx);
  });

  it("uses flat table (no h4) when section has no subfolders", () => {
    const files = [
      makeFile("agents/alexia.md", ".claude/agents/alexia.md"),
      makeFile("agents/martin.md", ".claude/agents/martin.md"),
    ];

    const result = generateCatalogContent(files, "aidd_docs");

    expect(result).toContain("### `agents`");
    expect(result).not.toContain("####");
  });

  it("omits 'name' and 'model' frontmatter keys from columns", () => {
    const files = [
      makeFile("agents/alexia.md", ".claude/agents/alexia.md", "claude", {
        name: "alexia",
        model: "sonnet",
        description: "Agent desc",
      }),
    ];

    const result = generateCatalogContent(files, "aidd_docs");

    expect(result).not.toContain("| Name |");
    expect(result).not.toContain("| Model |");
    expect(result).toContain("| Description |");
  });
});
