import { beforeEach, describe, expect, it } from "vitest";
import { BuildNativeTree } from "../../../../src/contexts/translate/application/build-native-tree.use-case.js";
import {
  FrameworkPlaceholderInPluginError,
  InvalidBuildPathsError,
  JsonSchemaValidationError,
} from "../../../../src/contexts/translate/domain/translate.error.js";
import type { PluginTreeSink } from "../../../../src/contexts/translate/ports/plugin-tree-sink.js";
import { buildContractOf } from "../../../shared/testing/build-contract-of.builder.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import type { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import {
  makeAssetProvider,
  makeSeededFs,
  makeUseCase,
  makeValidator,
  OUT_DIR,
  SOURCE_DIR,
} from "../testing/build-native-tree-world.builder.js";
import { buildTree } from "../testing/build-tree.builder.js";

describe("building a native tree on disk", () => {
  let fs: InMemoryFileAdapter;
  let logger: CapturingLogger;

  beforeEach(async () => {
    fs = await makeSeededFs();
    logger = new CapturingLogger();
  });

  describe("manifest validation", () => {
    it("throws JsonSchemaValidationError when manifest is invalid", async () => {
      const v = makeValidator(true);
      const ap = makeAssetProvider();
      const uc = buildTree(
        fs,
        v,
        ap,
        logger,
        buildContractOf(registeredTools(), TOOL.copilot, "marketplace"),
        "marketplace"
      );
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(JsonSchemaValidationError);
    });
  });

  describe("plugin manifest synthesis", () => {
    it("writes synthesized plugin.json at the OpenPlugin output path", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const destPath = `${OUT_DIR}/plugins/aidd-test/.plugin/plugin.json`;
      expect(fs.has(destPath)).toBe(true);
    });

    it("synthesized plugin.json does not contain strict or $schema", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const raw = fs.getFile(`${OUT_DIR}/plugins/aidd-test/.plugin/plugin.json`) ?? "";
      expect(raw).not.toContain("strict");
      expect(raw).not.toContain("$schema");
    });

    it("synthesized plugin.json has skills array when skills directory has SKILL.md files", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const parsed = JSON.parse(
        fs.getFile(`${OUT_DIR}/plugins/aidd-test/.plugin/plugin.json`) ?? "{}"
      ) as { skills: string[] };
      expect(Array.isArray(parsed.skills)).toBe(true);
      expect(parsed.skills.some((s: string) => s.startsWith("./skills/"))).toBe(true);
    });

    it("synthesized plugin.json omits skills when no SKILL.md files exist", async () => {
      for (const path of fs.listUnder(`${SOURCE_DIR}/plugins/aidd-test/skills`)) {
        if (path.endsWith("SKILL.md")) await fs.deleteFile(path);
      }
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const parsed = JSON.parse(
        fs.getFile(`${OUT_DIR}/plugins/aidd-test/.plugin/plugin.json`) ?? "{}"
      ) as Record<string, unknown>;
      expect(parsed.skills).toBeUndefined();
    });

    it("synthesized plugin.json lists ./agents/*.md file paths when agents directory has .md files", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const parsed = JSON.parse(
        fs.getFile(`${OUT_DIR}/plugins/aidd-test/.plugin/plugin.json`) ?? "{}"
      ) as { agents: string[] };
      expect(parsed.agents).toEqual(["./agents/code-reviewer.md"]);
    });

    it("synthesized plugin.json omits agents when no .md files exist in agents directory", async () => {
      for (const path of fs.listUnder(`${SOURCE_DIR}/plugins/aidd-test/agents`)) {
        await fs.deleteFile(path);
      }
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const parsed = JSON.parse(
        fs.getFile(`${OUT_DIR}/plugins/aidd-test/.plugin/plugin.json`) ?? "{}"
      ) as Record<string, unknown>;
      expect(parsed.agents).toBeUndefined();
    });

    it("source .claude-plugin/plugin.json is NOT copied to output", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      expect(fs.has(`${OUT_DIR}/plugins/aidd-test/.claude-plugin/plugin.json`)).toBe(false);
    });
  });

  describe("agent emission + frontmatter strip", () => {
    it("emits agents with their original .md extension (no rename)", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      expect(fs.has(`${OUT_DIR}/plugins/aidd-test/agents/code-reviewer.md`)).toBe(true);
      expect(fs.has(`${OUT_DIR}/plugins/aidd-test/agents/code-reviewer.agent.md`)).toBe(false);
    });

    it("keeps only the agent fields Copilot reads", async () => {
      const agentPath = `${SOURCE_DIR}/plugins/aidd-test/agents/extra.md`;
      fs.setFile(
        agentPath,
        "---\nname: extra\ndescription: desc\nversion: 1.0\ntags:\n  - test\n---\n\nBody."
      );
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const out = fs.getFile(`${OUT_DIR}/plugins/aidd-test/agents/extra.md`) ?? "";
      expect(out).toContain("name: 'extra'");
      expect(out).toContain("description: 'desc'");
      expect(out).not.toContain("version");
      expect(out).not.toContain("tags");
    });
  });

  describe("skill tree copy", () => {
    it("copies all skill files to the output", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const skillFiles = fs.listUnder(`${OUT_DIR}/plugins/aidd-test/skills`);
      expect(skillFiles.length).toBeGreaterThan(0);
    });

    it("rewrites @./ references in .md skill files", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const helloOut = fs.getFile(`${OUT_DIR}/plugins/aidd-test/skills/hello.md`) ?? "";
      expect(helloOut).toContain("[SKILL.md](./SKILL.md)");
    });

    it("rewrites @../ references in .md skill files", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const helloOut = fs.getFile(`${OUT_DIR}/plugins/aidd-test/skills/hello.md`) ?? "";
      expect(helloOut).toContain("[commit/SKILL.md](../commit/SKILL.md)");
    });

    it("leaves no @-reference to the Claude plugin root in a skill", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const helloOut = fs.getFile(`${OUT_DIR}/plugins/aidd-test/skills/hello.md`) ?? "";
      expect(helloOut).not.toContain("@" + "$" + "{CLAUDE_PLUGIN_ROOT}");
    });
  });

  describe("hooks rewrite", () => {
    it("writes hooks.json with CLAUDE_PLUGIN_ROOT rewritten to OpenPlugin native token", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const destPath = `${OUT_DIR}/plugins/aidd-test/hooks/hooks.json`;
      const dest = fs.getFile(destPath) ?? "";
      const claudeVarRef = "$" + "{CLAUDE_PLUGIN_ROOT}";
      const pluginRootRef = "$" + "{PLUGIN_ROOT}";
      expect(dest).not.toContain(claudeVarRef);
      expect(dest).toContain(`${pluginRootRef}/hooks/check.sh`);
    });

    it("hooks.json output is valid JSON with same structure (minus the variable substitution)", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const dest = fs.getFile(`${OUT_DIR}/plugins/aidd-test/hooks/hooks.json`) ?? "";
      const parsed = JSON.parse(dest) as { hooks: { PreToolUse: unknown[] } };
      expect(parsed.hooks.PreToolUse).toBeDefined();
    });
  });

  describe("mcp rewrite", () => {
    it("writes .mcp.json with CLAUDE_PLUGIN_ROOT rewritten to OpenPlugin native token", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const dest = fs.getFile(`${OUT_DIR}/plugins/aidd-test/.mcp.json`) ?? "";
      const claudeVarRef = "$" + "{CLAUDE_PLUGIN_ROOT}";
      const pluginRootRef = "$" + "{PLUGIN_ROOT}";
      expect(dest).not.toContain(claudeVarRef);
      expect(dest).toContain(`${pluginRootRef}/bin/server.js`);
    });

    it(".mcp.json output preserves mcpServers structure", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const dest = fs.getFile(`${OUT_DIR}/plugins/aidd-test/.mcp.json`) ?? "";
      const pluginRootRef = "$" + "{PLUGIN_ROOT}";
      const parsed = JSON.parse(dest) as { mcpServers: Record<string, { command: string }> };
      expect(parsed.mcpServers["aidd-test-server"].command).toBe(`${pluginRootRef}/bin/server.js`);
    });
  });

  describe("@{{TOOLS}}/ halts the build", () => {
    it("throws FrameworkPlaceholderInPluginError and leaves partial output on disk", async () => {
      const badSkillPath = `${SOURCE_DIR}/plugins/aidd-test/skills/bad.md`;
      fs.setFile(badSkillPath, "# Bad\n@{{TOOLS}}/agents/something.md\n");
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(FrameworkPlaceholderInPluginError);
      const filesInOut = fs.listUnder(OUT_DIR);
      expect(filesInOut.length).toBeGreaterThan(0);
    });
  });

  describe("out-of-scope sections", () => {
    it("logs a warning for commands/ and rules/ directories and lists them in skippedSections", async () => {
      const v = makeValidator();
      const ap = makeAssetProvider();
      const uc = buildTree(
        fs,
        v,
        ap,
        logger,
        buildContractOf(registeredTools(), TOOL.copilot, "marketplace"),
        "marketplace"
      );
      const result = await uc.execute({
        sourceDir: SOURCE_DIR,
        outDir: OUT_DIR,
        target: TOOL.copilot,
      });
      const [plugin] = result.plugins;
      expect(plugin.skippedSections).toEqual(["commands", "rules"]);
      expect(logger.warnMessages).toEqual([
        "Skipping commands/ in plugin 'aidd-test' (out of scope for MVP1).",
        "Skipping rules/ in plugin 'aidd-test' (out of scope for MVP1).",
      ]);
    });
  });

  describe("safety guard", () => {
    it("throws InvalidBuildPathsError when outDir equals sourceDir", async () => {
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: SOURCE_DIR, target: TOOL.copilot })
      ).rejects.toThrow(InvalidBuildPathsError);
    });

    it("throws when outDir is inside sourceDir", async () => {
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: `${SOURCE_DIR}/dist`, target: TOOL.copilot })
      ).rejects.toThrow(InvalidBuildPathsError);
    });

    it("throws when sourceDir is inside outDir", async () => {
      const uc = makeUseCase(fs);
      const parent = SOURCE_DIR.split("/").slice(0, -1).join("/");
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: parent, target: TOOL.copilot })
      ).rejects.toThrow(InvalidBuildPathsError);
    });
  });

  describe("when built twice", () => {
    it("produces byte-identical output on a second run with identical inputs", async () => {
      const uc = makeUseCase(fs);
      const opts = { sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot };
      await uc.execute(opts);
      const firstRunFiles = Object.fromEntries(
        fs.listUnder(OUT_DIR).map((p) => [p, fs.getFile(p)])
      );
      await fs.deleteDirectory(OUT_DIR);
      await uc.execute(opts);
      const secondRunFiles = Object.fromEntries(
        fs.listUnder(OUT_DIR).map((p) => [p, fs.getFile(p)])
      );
      expect(Object.keys(firstRunFiles).sort()).toEqual(Object.keys(secondRunFiles).sort());
      for (const key of Object.keys(firstRunFiles)) {
        expect(firstRunFiles[key]).toBe(secondRunFiles[key]);
      }
    });

    it("produces byte-identical output when a forced second run writes into the tree the first left", async () => {
      const v = makeValidator();
      const ap = makeAssetProvider();
      const uc = buildTree(
        fs,
        v,
        ap,
        logger,
        buildContractOf(registeredTools(), TOOL.copilot, "marketplace"),
        "marketplace",
        true
      );
      const opts = { sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot };
      await uc.execute(opts);
      const firstRunFiles = Object.fromEntries(
        fs.listUnder(OUT_DIR).map((p) => [p, fs.getFile(p)])
      );
      await uc.execute(opts);
      const secondRunFiles = Object.fromEntries(
        fs.listUnder(OUT_DIR).map((p) => [p, fs.getFile(p)])
      );
      expect(Object.keys(firstRunFiles).length).toBeGreaterThan(0);
      expect(secondRunFiles).toEqual(firstRunFiles);
    });
  });
});

/** Each layout step reports what it wrote, and the use case is the only place those counts are
 * added up; a stub layout states them so the arithmetic is readable. */
const LAYOUT = {
  contract: buildContractOf(registeredTools(), TOOL.copilot, "marketplace"),
  mode: "marketplace",
  force: false,
} as const;

const countingSink: PluginTreeSink = {
  prepare: () => Promise.resolve(),
  writePlugin: () => Promise.resolve({ files: 31, declaredMcp: null }),
  finish: () => Promise.resolve(32),
};

describe("what a build reports having written", () => {
  it("adds each layout step's own count per plugin, then what the layout wrote after them", async () => {
    const fs = await makeSeededFs();
    const _v = makeValidator();
    const _ap = makeAssetProvider();
    const uc = new BuildNativeTree({
      fs,
      logger: new CapturingLogger(),
      sink: countingSink,
      layout: LAYOUT,
    });
    const result = await uc.execute({
      sourceDir: SOURCE_DIR,
      outDir: OUT_DIR,
      target: TOOL.copilot,
    });
    expect(result).toEqual({
      outDir: OUT_DIR,
      totalFiles: 63,
      plugins: [{ name: "aidd-test", filesWritten: 31, skippedSections: ["commands", "rules"] }],
    });
  });

  it("reports no skipped section for a plugin shipping neither commands nor rules", async () => {
    const fs = await makeSeededFs();
    for (const section of ["commands", "rules"]) {
      await fs.deleteDirectory(`${SOURCE_DIR}/plugins/aidd-test/${section}`);
    }
    const logger = new CapturingLogger();
    const _v = makeValidator();
    const _ap = makeAssetProvider();
    const uc = new BuildNativeTree({ fs, logger, sink: countingSink, layout: LAYOUT });
    const result = await uc.execute({
      sourceDir: SOURCE_DIR,
      outDir: OUT_DIR,
      target: TOOL.copilot,
    });
    expect(result.plugins).toEqual([{ name: "aidd-test", filesWritten: 31, skippedSections: [] }]);
    expect(logger.warnMessages).toEqual([]);
  });
});
