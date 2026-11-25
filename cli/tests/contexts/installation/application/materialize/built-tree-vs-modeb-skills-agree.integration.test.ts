import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPluginTranslation } from "../../../../../src/composition/contexts/translate.js";
import { artifactPath } from "../../../../../src/shared/domain/materialization/artifact-path.js";
import {
  type PluginComponentFile,
  PluginDistribution,
} from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { REPOSITORY_ROOT } from "../../../../shared/testing/repository-root.builder.js";

const PLUGINS_DIR = join(REPOSITORY_ROOT, "plugins");

/**
 * Two independent paths compute an OpenCode-flat skill path for the same plugin content.
 * The fixture's non-skill children under skills/ are what makes a drift between them visible.
 */

const PLUGIN_NAME = "aidd-telemetry";

function skillFile(relativePath: string, content = "// stub"): PluginComponentFile {
  return { relativePath: `skills/${relativePath}`, content };
}

function makeTelemetryLikeDist(): PluginDistribution {
  const skills = [
    skillFile("shared/attribution.cjs"),
    skillFile("package.json", `{ "type": "commonjs" }`),
    skillFile("01-cost/SKILL.md", `---\nname: 01-cost\ndescription: Cost skill\n---\n\nBody.\n`),
    skillFile("01-cost/scripts/telemetry-report.cjs", `require("../../shared/attribution.cjs");`),
  ];
  return new PluginDistribution({
    manifest: { name: parsePluginName(PLUGIN_NAME), version: "1.0.0" },
    format: TOOL.claude,
    files: skills,
    components: { commands: [], agents: [], rules: [], skills, hooks: [], mcp: [] },
  });
}

function modeBSkillPaths(dist: PluginDistribution): string[] {
  return createPluginTranslation(registeredTools())
    .execute({ distribution: dist, tool: registeredTools().aiProfile(TOOL.opencode) })
    .files.map((f) => f.relativePath)
    .filter((p) => p.startsWith(".opencode/skills/"))
    .sort();
}

function builtTreeSkillPaths(dist: PluginDistribution): string[] {
  const contract = registeredTools().aiProfile(TOOL.opencode).buildContract("flat");
  if (contract === null) throw new Error("opencode declares no flat build contract");
  const skillsArtifact = contract.artifacts.skills;
  if (!skillsArtifact.supported) throw new Error("opencode flat skills artifact unsupported");
  return dist.components.skills
    .map((f) => artifactPath(skillsArtifact, PLUGIN_NAME, f.relativePath))
    .sort();
}

describe("opencode flat skills - built-tree route agrees with mode-B install route", () => {
  it("produce the identical set of relative output paths for a plugin with non-skill children", () => {
    const dist = makeTelemetryLikeDist();

    const modeB = modeBSkillPaths(dist);
    const builtTree = builtTreeSkillPaths(dist);

    expect(builtTree).toEqual(modeB);
    expect(modeB).toEqual([
      ".opencode/skills/aidd-telemetry/01-cost/SKILL.md",
      ".opencode/skills/aidd-telemetry/01-cost/scripts/telemetry-report.cjs",
      ".opencode/skills/aidd-telemetry/package.json",
      ".opencode/skills/aidd-telemetry/shared/attribution.cjs",
    ]);
  });
});

function skillLeavesOf(plugin: string): string[] {
  const skillsDir = join(PLUGINS_DIR, plugin, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((skill) => skill.isDirectory() && existsSync(join(skillsDir, skill.name, "SKILL.md")))
    .map((skill) => skill.name);
}

function pluginsByLeafSkillName(): Map<string, string[]> {
  const byLeaf = new Map<string, string[]>();
  const plugins = readdirSync(PLUGINS_DIR, { withFileTypes: true }).filter((p) => p.isDirectory());
  for (const plugin of plugins) {
    for (const leaf of skillLeavesOf(plugin.name)) {
      byLeaf.set(leaf, [...(byLeaf.get(leaf) ?? []), plugin.name]);
    }
  }
  return byLeaf;
}

// Nesting a skill under its plugin's own directory shortens its `name` to the leaf, so
// nothing stops two plugins shipping the same leaf any more. This does.
describe("skill names across plugins, now that the plugin prefix is a directory", () => {
  it("no two plugins ship a skill with the same leaf name", () => {
    const byLeaf = pluginsByLeafSkillName();

    const shared = [...byLeaf.entries()].filter(([, plugins]) => plugins.length > 1);
    expect(byLeaf.size).toBeGreaterThan(10);
    expect(shared.map(([leaf, plugins]) => `${leaf}: ${plugins.join(", ")}`)).toEqual([]);
  });
});
