import { describe, expect, it } from "vitest";
import { claude } from "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { codex } from "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { copilot } from "../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { cursor } from "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { opencode } from "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { PluginDistribution } from "../../../../src/contexts/translate/domain/plugin-distribution.js";
import { nativeOf } from "../../tools/testing/plugin-mode.js";
import {
  agentContent,
  claudeManifestContent,
  greetContent,
  makeDist,
  makeFile,
  skillContent,
  translator,
} from "../testing/plugin-content-translator-kit.js";

describe("cross-format matrix (source × target)", () => {
  const sourceFormats = [
    { format: "claude" as const, manifestPath: ".claude-plugin/plugin.json" },
    { format: "cursor" as const, manifestPath: ".cursor-plugin/plugin.json" },
    { format: "codex" as const, manifestPath: ".codex-plugin/plugin.json" },
    { format: "copilot" as const, manifestPath: "plugin.json" },
  ];

  const targets = [
    { name: "claude", tool: claude, manifestExpected: "plugin.json" },
    { name: "cursor", tool: cursor, manifestExpected: "plugin.json" },
    { name: "codex", tool: codex, manifestExpected: "plugin.json" },
    { name: "copilot", tool: copilot, manifestExpected: "plugin.json" },
  ];

  function makeSourceDist(format: (typeof sourceFormats)[number]): PluginDistribution {
    const commands = [makeFile("commands/greet.md", greetContent)];
    const agents = [makeFile("agents/reviewer.md", agentContent)];
    const skills = [makeFile("skills/hello/SKILL.md", skillContent)];
    const manifest = makeFile(format.manifestPath, claudeManifestContent);
    return new PluginDistribution({
      manifest: { name: "sample-plugin", version: "1.0.0" },
      format: format.format,
      files: [...commands, ...agents, ...skills, manifest],
      components: { commands, agents, skills, rules: [], hooks: [], mcp: [] },
    });
  }

  for (const source of sourceFormats) {
    for (const target of targets) {
      if (target.name === "cursor") {
        // Cursor Mode B: pluginManifestRelativePath is null — no manifest file written into plugin dir.
        it(`${source.format} source → ${target.name} target: does not emit manifest (Mode B, null pluginManifestRelativePath)`, () => {
          const dist = makeSourceDist(source);
          const files = translator.translate(dist, target.tool);
          expect(files.map((f) => f.relativePath)).not.toContain(
            expect.stringMatching(/plugin\.json$/)
          );
        });
      } else {
        it(`${source.format} source → ${target.name} target: emits manifest at ${target.manifestExpected}`, () => {
          const dist = makeSourceDist(source);
          const files = translator.translate(dist, target.tool);
          const expected = `${nativeOf(target.tool.section("plugins")).pluginOutputDir("sample-plugin")}${target.manifestExpected}`;
          expect(files.map((f) => f.relativePath)).toContain(expected);
        });
      }
    }
  }
});

describe("PluginContentTranslator.detectFlatCollisions()", () => {
  it("reports no collision when plugins use different plugin names", () => {
    const dist1 = makeDist({ manifest: { name: "plugin-a", version: "1.0.0" } });
    const dist2 = makeDist({ manifest: { name: "plugin-b", version: "1.0.0" } });
    const collisions = translator.detectFlatCollisions([dist1, dist2], opencode);
    expect(collisions).toEqual([]);
  });

  it("reports collisions when same plugin name is used twice", () => {
    const dist1 = makeDist({ manifest: { name: "same-plugin", version: "1.0.0" } });
    const dist2 = makeDist({ manifest: { name: "same-plugin", version: "2.0.0" } });
    const collisions = translator.detectFlatCollisions([dist1, dist2], opencode);
    expect(collisions.length).toBeGreaterThan(0);
    expect(collisions[0].plugin).toBe("same-plugin");
  });

  it("returns empty array for native-mode tools", () => {
    expect(translator.detectFlatCollisions([makeDist()], claude)).toEqual([]);
  });
});

/** The path a plugin's own content takes on its way to disk: the chain `aidd plugin install`
 * follows, and the one the golden suite cannot see, since `aidd translate` never calls
 * `rewriteContent` at all. */
describe("a plugin whose content references the framework", () => {
  const withPlaceholder = () => {
    const skills = [
      makeFile(
        "skills/hello/SKILL.md",
        `---\nname: hello\ndescription: Hello skill\n---\n\nSee \`{{TOOLS}}/plugins/aidd-pm/x.yml\` and @{{DOCS}}/memory/testing.md\n`
      ),
    ];
    // `files` and `components` both, or the override keeps the default skill content and
    // the assertion passes on a file that never carried a placeholder.
    return makeDist({
      files: skills,
      components: { skills, commands: [], agents: [], rules: [], hooks: [], mcp: [] },
    });
  };

  it("resolves the reference for the tool being installed into", () => {
    const file = translator
      .translate(withPlaceholder(), copilot)
      .find((f) => f.relativePath.endsWith("SKILL.md"));

    expect(file?.content).toContain(".github/plugins/aidd-pm/x.yml");
    expect(file?.content).toContain(
      "[aidd_docs/memory/testing.md](../../aidd_docs/memory/testing.md)"
    );
    expect(file?.content).not.toContain("{{TOOLS}}");
    expect(file?.content).not.toContain("{{DOCS}}");
  });
});
