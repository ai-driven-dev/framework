import { describe, expect, it } from "vitest";
import { pluginsCapability } from "../../../../src/contexts/tools/domain/plugins/plugins-capability.js";
import { claude } from "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { codex } from "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { cursor } from "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { opencode } from "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { vscode } from "../../../../src/contexts/tools/domain/profiles/vscode/profile.js";
import { parseFrontmatter } from "../../../../src/kernel/markdown.js";
import { withSections } from "../../../helpers/ports/stub-ai-tool.js";
import { nativeOf } from "../../tools/testing/plugin-mode.js";
import {
  distOf,
  hooksDist,
  makeDist,
  makeFile,
  mcpJsonContent,
  skillDist,
  translator,
  treeOf,
} from "../testing/plugin-content-translator-kit.js";

describe("a plugin's mcp declaration", () => {
  it("lands at the name cursor reads it under", () => {
    const mcp = [makeFile(".mcp.json", mcpJsonContent)];
    expect(treeOf(cursor, distOf([...mcp], { mcp }))).toEqual({
      "sample-plugin/mcp.json": mcpJsonContent,
    });
  });

  it("is dropped by a target that hosts none", () => {
    const refusingMcp = withSections(claude, {
      plugins: pluginsCapability({
        mode: "native",
        pluginRootToken: "$X_PLUGIN_ROOT",
        pluginsDir: ".claude/plugins/",
        pluginManifestRelativePath: null,
        acceptsHooks: true,
        acceptsMcp: false,
      }),
    });
    const mcp = [makeFile(".mcp.json", mcpJsonContent)];
    expect(treeOf(refusingMcp, distOf([...mcp], { mcp }))).toEqual({});
  });
});

describe("what an installed file came from", () => {
  it("maps back only the components, never the manifest, the hooks or the mcp declaration", () => {
    const { componentPaths } = translator.translateWithComponentPaths(makeDist(), claude);
    expect(Object.fromEntries(componentPaths)).toEqual({
      ".claude/plugins/sample-plugin/skills/hello/SKILL.md": "skills/hello/SKILL.md",
      ".claude/plugins/sample-plugin/commands/greet.md": "commands/greet.md",
      ".claude/plugins/sample-plugin/agents/reviewer.md": "agents/reviewer.md",
      ".claude/plugins/sample-plugin/rules/standards.md": "rules/standards.md",
    });
  });
});

describe("what a person still has to do before a hook runs", () => {
  it("names codex's trust step once for a plugin that ships hooks", () => {
    const { notices } = translator.translateWithComponentPaths(hooksDist(), codex);
    expect(notices).toEqual([
      {
        pluginName: "sample-plugin",
        component: "hooks",
        toolId: "codex",
        message: nativeOf(codex.section("plugins")).trustNotice(),
      },
    ]);
  });

  it("says nothing for a plugin that ships no hook", () => {
    expect(translator.translateWithComponentPaths(skillDist(), codex).notices).toEqual([]);
  });

  it("says nothing for a target that asks for no trust", () => {
    expect(translator.translateWithComponentPaths(hooksDist(), claude).notices).toEqual([]);
  });
});

describe("a target that runs no hook a plugin ships", () => {
  const refusingHooks = withSections(opencode, {
    plugins: pluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      acceptsHooks: false,
      hooksUnsupportedReason: "OpenCode runs no hook a plugin ships.",
    }),
  });

  it("records the refusal against the plugin and the target", () => {
    expect(translator.translateWithComponentPaths(hooksDist(), refusingHooks).skipped).toEqual([
      {
        pluginName: "sample-plugin",
        component: "hooks",
        toolId: "opencode",
        reason: "OpenCode runs no hook a plugin ships.",
      },
    ]);
  });

  it("records nothing for a plugin that ships no hook", () => {
    expect(translator.translateWithComponentPaths(skillDist(), refusingHooks).skipped).toEqual([]);
  });
});

describe("a command a flat target installs", () => {
  const cases = [
    { authored: "aidd:04:sub:greet", installed: "aidd-sample-plugin:sub:greet" },
    { authored: "team:greet", installed: "aidd-sample-plugin:greet" },
    { authored: "greet", installed: "aidd-sample-plugin:greet" },
  ];

  for (const { authored, installed } of cases) {
    it(`names '${authored}' as '${installed}'`, () => {
      const commands = [
        makeFile(
          "commands/greet.md",
          `---\nname: ${authored}\ndescription: Greet command\n---\n\nGreet.\n`
        ),
      ];
      const content = treeOf(opencode, distOf([...commands], { commands }))[
        ".opencode/commands/sample-plugin/greet.md"
      ];
      expect(parseFrontmatter(content).frontmatter).toEqual({
        name: installed,
        description: "Greet command",
      });
    });
  }

  it("falls back to the file's own name when the command declares none", () => {
    const commands = [
      makeFile("commands/greet.md", "---\ndescription: Greet command\n---\n\nGreet.\n"),
    ];
    const content = treeOf(opencode, distOf([...commands], { commands }))[
      ".opencode/commands/sample-plugin/greet.md"
    ];
    expect(parseFrontmatter(content).frontmatter).toEqual({
      description: "Greet command",
      name: "aidd-sample-plugin:greet.md",
    });
  });
});

describe("a target that hosts no plugin", () => {
  const emptyResult = { files: [], componentPaths: new Map(), skipped: [], notices: [] };

  it("produces nothing for an IDE", () => {
    expect(translator.translateWithComponentPaths(makeDist(), vscode)).toEqual(emptyResult);
  });

  it("produces nothing for a tool declaring plugins unsupported", () => {
    const unsupported = withSections(claude, {
      plugins: pluginsCapability({
        mode: "unsupported",
        hooksUnsupportedReason: "Claude hosts no plugin here.",
      }),
    });
    expect(translator.translateWithComponentPaths(makeDist(), unsupported)).toEqual(emptyResult);
  });
});
