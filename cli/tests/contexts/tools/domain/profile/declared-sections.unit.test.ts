import { describe, expect, it, vi } from "vitest";
import { buildSections } from "../../../../../src/contexts/tools/domain/profile/declared-sections.js";
import { McpConfigPart } from "../../../../../src/contexts/tools/domain/sections/mcp-section.js";
import { SkillsSection } from "../../../../../src/contexts/tools/domain/sections/skills-section.js";
import { CapabilityConfigError } from "../../../../../src/contexts/tools/domain/tools.error.js";
import { SmolTomlCodec } from "../../../../../src/shared/infrastructure/smol-toml-codec.adapter.js";

const toml = new SmolTomlCodec();
const at = { directory: ".x/", toolSuffix: ".claude.md", formats: { toml } };
const tomlAgents = {
  format: "toml" as const,
  frontmatter: (source: Record<string, unknown>) => source,
};

describe("the sections a profile declares as parameters", () => {
  it("keeps a section the profile built itself", () => {
    const skills = new SkillsSection({ directory: ".own/" });
    expect(buildSections({ skills }, at).skills).toBe(skills);
  });

  it("builds a section from its parameters under the directory and suffix stated once", () => {
    const agents = buildSections({ agents: tomlAgents }, at).agents;
    expect(agents?.buildInstallPath("reviewer.claude.md")).toBe(".x/agents/reviewer.toml");
  });

  it("refuses TOML agents when no codec was wired", () => {
    expect(() => buildSections({ agents: tomlAgents }, { ...at, formats: {} })).toThrow(
      CapabilityConfigError
    );
  });

  it("builds a TOML MCP file with the wired codec and the merge named from it", () => {
    const merge = (existing: string) => existing;
    const mergeWith = vi.fn(() => merge);
    const mcp = buildSections(
      { mcp: { config: { outputPath: ".x/config.toml", format: "toml", mergeWith } } },
      at
    ).mcp;

    expect(mcp?.config).toBeInstanceOf(McpConfigPart);
    expect(mergeWith).toHaveBeenCalledWith(toml);
  });
});
