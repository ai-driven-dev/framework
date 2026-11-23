import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyLinkSyntax } from "../../../../src/shared/domain/materialization/link-syntax.js";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../src/shared/domain/plugin/plugin-name.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { REPOSITORY_ROOT } from "../../../shared/testing/repository-root.builder.js";
import { translator } from "../testing/engine-kit.builder.js";
import {
  claude,
  codex,
  copilot,
  cursor,
  kilo,
  opencode,
} from "../testing/registered-profiles.builder.js";

/**
 * Prose - a skill, an agent, a rule - is translated: frontmatter converted, paths rewritten.
 * An artefact is carried byte for byte: a path rewritten inside a program no longer parses.
 */
function pluginFile(relativePath: string): string {
  return readFileSync(join(REPOSITORY_ROOT, "plugins", "aidd-context", relativePath), "utf8");
}

const ARTEFACTS = ["hooks/memory.cjs"] as const;

describe("a plugin's executable files survive being installed", () => {
  for (const relativePath of ARTEFACTS) {
    it(`${relativePath} is not what any tool's own rewrite would make of it`, () => {
      const content = pluginFile(relativePath);
      const rewritten = registeredTools()
        .idsInCanonicalOrder("ai")
        .map((tool) => applyLinkSyntax(content, registeredTools().aiProfile(tool).linkSyntax));

      // The rewrite is the thing the translator must not apply to this file. Where a tool's
      // rewrite happens to leave it alone, that is luck; where it does not, this names it.
      const damagedBy = registeredTools()
        .idsInCanonicalOrder("ai")
        .filter((_, index) => rewritten[index] !== content);
      expect(
        damagedBy.length === 0 || relativePath.endsWith(".js"),
        `${relativePath} is rewritten by ${damagedBy.join(", ")} and is not carried verbatim`
      ).toBe(true);
    });
  }
});

/** The decisive check: not "would a rewrite damage it", but "does installing the plugin
 * actually put it there, unchanged". The path is the fixture; the content is real bytes. */
describe("installing the plugin carries a skill's own script, on every tool", () => {
  const SCRIPT = "skills/02-project-memory/scripts/example.cjs";
  const SCRIPT_CONTENT = pluginFile("hooks/memory.cjs");
  function distributionOf(): PluginDistribution {
    const skills = [
      {
        relativePath: "skills/02-project-memory/SKILL.md",
        content: pluginFile("skills/02-project-memory/SKILL.md"),
      },
      { relativePath: SCRIPT, content: SCRIPT_CONTENT },
    ];
    const hooks = [
      { relativePath: "hooks/hooks.json", content: pluginFile("hooks/hooks.json") },
      { relativePath: "hooks/memory.cjs", content: pluginFile("hooks/memory.cjs") },
    ];
    return new PluginDistribution({
      manifest: { name: parsePluginName("aidd-context"), version: "0.1.0" },
      format: TOOL.claude,
      files: [...skills, ...hooks],
      components: { skills, commands: [], agents: [], rules: [], hooks, mcp: [] },
    });
  }

  for (const tool of [claude, codex, copilot, cursor, kilo, opencode]) {
    it(`${tool.toolId} installs it byte for byte`, () => {
      const installed = translator
        .translate(distributionOf(), tool)
        .find((file) => file.relativePath.endsWith("02-project-memory/scripts/example.cjs"));

      expect(installed, `${tool.toolId} drops the script entirely`).toBeDefined();
      expect(installed?.content).toBe(SCRIPT_CONTENT);
    });
  }

  it("still translates the prose beside it", () => {
    const installed = translator
      .translate(distributionOf(), claude)
      .find((file) => file.relativePath.endsWith("02-project-memory/SKILL.md"));

    // Carrying artefacts verbatim must not turn every skill into an artefact: this one
    // still goes through the frontmatter conversion, so it is not byte-identical.
    expect(installed?.content).not.toBe(pluginFile("skills/02-project-memory/SKILL.md"));
    expect(installed?.content).toContain("memory of its architecture");
  });

  /** A script whose text that tool's own rewrite really does change. Each tool rewrites its
   * own directory's paths, so a single shared sample would let three tools pass by luck. */
  function rewritableScript(directory: string): string {
    return `const p = "${directory}commands/01_plan/x";\nconst q = "@${directory}commands/02_do/y";\n`;
  }

  function distributionWithScript(content: string): PluginDistribution {
    const skills = [
      {
        relativePath: "skills/02-project-memory/SKILL.md",
        content: pluginFile("skills/02-project-memory/SKILL.md"),
      },
      { relativePath: SCRIPT, content },
    ];
    return new PluginDistribution({
      manifest: { name: parsePluginName("aidd-context"), version: "0.1.0" },
      format: TOOL.claude,
      files: skills,
      components: { skills, commands: [], agents: [], rules: [], hooks: [], mcp: [] },
    });
  }

  for (const tool of [claude, codex, copilot, cursor, opencode]) {
    it(`${tool.toolId} leaves a script's own paths alone`, () => {
      // Paths this tool's own rewrite is built to touch, in a file that is not prose. That the
      // guard is not vacuous is asserted once, below, over every tool at once.
      const script = rewritableScript(tool.directory);

      const installed = translator
        .translate(distributionWithScript(script), tool)
        .find((file) => file.relativePath.endsWith("02-project-memory/scripts/example.cjs"));

      expect(installed?.content).toBe(script);
    });
  }

  it("carries it verbatim on a flat install too, not just a native one", () => {
    // OpenCode installs flat: skills keep their sub-path but every file used to be rewritten
    // on the way. The script survives there only because that rewrite leaves it alone.
    const installed = translator
      .translate(distributionOf(), opencode)
      .find((file) => file.relativePath.endsWith("02-project-memory/scripts/example.cjs"));

    expect(installed, "opencode drops the script entirely").toBeDefined();
    expect(installed?.content).toBe(SCRIPT_CONTENT);
  });
  it("guards against a rewrite that some tool really would apply", () => {
    // Without this, every assertion above could pass over content no rewrite touches, and
    // the guard would be protecting nothing while looking thorough.
    const rewritten = [claude, codex, copilot, cursor, opencode].filter((tool) => {
      const script = rewritableScript(tool.directory);
      return applyLinkSyntax(script, tool.linkSyntax) !== script;
    });

    expect(rewritten.length).toBeGreaterThan(0);
  });
});
