import { parse as parseToml } from "smol-toml";
import { describe, expect, it } from "vitest";
import { parseFrontmatter, serializeFrontmatter } from "../../../../src/shared/domain/markdown.js";
import { parsePluginName } from "../../../../src/shared/domain/plugin/plugin-name.js";
import {
  agentContent,
  claudeManifestContent,
  greetContent,
  hooksJsonContent,
  makeDist,
  makeFile,
  mcpJsonContent,
  pathsFor,
  ruleContent,
  skillContent,
  translator,
} from "../testing/engine-kit.builder.js";
import {
  antigravity,
  claude,
  codex,
  copilot,
  cursor,
  opencode,
  vscode,
} from "../testing/registered-profiles.builder.js";

describe("the engine translate()", () => {
  it.each([
    [
      "claude",
      claude,
      ".claude/plugins/aidd-dev/agents/reviewer.md",
      { model: "claude-haiku-5-5", effort: "medium" },
    ],
    [
      "codex",
      codex,
      ".codex/plugins/aidd-dev/codex-agents/reviewer.toml",
      { model: "gpt-6-luna", model_reasoning_effort: "medium" },
    ],
    [
      "copilot",
      copilot,
      ".github/plugins/aidd-dev/agents/reviewer.agent.md",
      { model: "gpt-6-luna", reasoningEffort: "medium" },
    ],
    [
      "opencode",
      opencode,
      ".opencode/agents/aidd-dev-reviewer.md",
      { model: "openai/gpt-6-luna#medium" },
    ],
  ] as const)(
    "carries %s's model and Claude's effort, under the host's own key, through ordinary installation",
    (label, host, path, expected) => {
      const base = makeDist({ manifest: { name: parsePluginName("aidd-dev"), version: "1.0.0" } });
      const agent = makeFile(
        "agents/reviewer.md",
        serializeFrontmatter(
          {
            name: "reviewer",
            description: "Role",
            model: expected.model.replace(/#.*$/, ""),
            effort: "medium",
          },
          "Reviewer agent from sample-plugin."
        )
      );
      const dist = makeDist({
        manifest: base.manifest,
        files: base.files.map((file) => (file.relativePath === agent.relativePath ? agent : file)),
        components: { ...base.components, agents: [agent] },
      });
      const installed = translator.translate(dist, host).find((file) => file.relativePath === path);
      expect(installed).toBeDefined();
      const content = installed?.content ?? "";
      expect(
        label === "codex" ? parseToml(content) : parseFrontmatter(content).frontmatter
      ).toMatchObject(expected);
      expect(content).toContain("Reviewer agent from sample-plugin.");
    }
  );

  describe("claude target", () => {
    it("emits all components claude supports under .claude/plugins/sample-plugin/", () => {
      const paths = pathsFor(claude);
      expect(paths).toContain(".claude/plugins/sample-plugin/commands/greet.md");
      expect(paths).toContain(".claude/plugins/sample-plugin/agents/reviewer.md");
      expect(paths).toContain(".claude/plugins/sample-plugin/skills/hello/SKILL.md");
      expect(paths).toContain(".claude/plugins/sample-plugin/rules/standards.md");
      expect(paths).toContain(".claude/plugins/sample-plugin/hooks/hooks.json");
      expect(paths).toContain(".claude/plugins/sample-plugin/.mcp.json");
    });

    it("emits native plugin manifest where the tool reads it", () => {
      const files = translator.translate(makeDist(), claude);
      const manifest = files.find(
        (f) => f.relativePath === ".claude/plugins/sample-plugin/.claude-plugin/plugin.json"
      );
      expect(manifest).toBeDefined();
      expect(manifest?.content).toContain("sample-plugin");
    });

    it("emits hooks companion scripts alongside hooks.json", () => {
      const scriptFile = makeFile("hooks/update_memory.js", "console.log('updated');");
      const hooksFiles = [makeFile("hooks/hooks.json", hooksJsonContent), scriptFile];
      const dist = makeDist({
        files: [
          makeFile("skills/hello/SKILL.md", skillContent),
          makeFile("commands/greet.md", greetContent),
          makeFile("agents/reviewer.md", agentContent),
          makeFile("rules/standards.md", ruleContent),
          ...hooksFiles,
          makeFile(".mcp.json", mcpJsonContent),
          makeFile(".claude-plugin/plugin.json", claudeManifestContent),
        ],
        components: {
          skills: [makeFile("skills/hello/SKILL.md", skillContent)],
          commands: [makeFile("commands/greet.md", greetContent)],
          agents: [makeFile("agents/reviewer.md", agentContent)],
          rules: [makeFile("rules/standards.md", ruleContent)],
          hooks: hooksFiles,
          mcp: [makeFile(".mcp.json", mcpJsonContent)],
        },
      });
      const paths = pathsFor(claude, dist);
      expect(paths).toContain(".claude/plugins/sample-plugin/hooks/hooks.json");
      expect(paths).toContain(".claude/plugins/sample-plugin/hooks/update_memory.js");
    });

    it("keeps a hook script's own directories, which its requires resolve against", () => {
      const hooksFiles = [
        makeFile("hooks/hooks.json", hooksJsonContent),
        makeFile("hooks/journal.cjs", 'require("./lib/repo.js");'),
        makeFile("hooks/lib/repo.cjs", "module.exports = {};"),
      ];
      const dist = makeDist({
        files: [...hooksFiles, makeFile(".claude-plugin/plugin.json", claudeManifestContent)],
        components: {
          skills: [],
          commands: [],
          agents: [],
          rules: [],
          hooks: hooksFiles,
          mcp: [],
        },
      });
      const paths = pathsFor(claude, dist);
      expect(paths).toContain(".claude/plugins/sample-plugin/hooks/journal.cjs");
      expect(paths).toContain(".claude/plugins/sample-plugin/hooks/lib/repo.cjs");
      expect(paths).not.toContain(".claude/plugins/sample-plugin/hooks/repo.cjs");
    });
  });

  describe("cursor target (Mode B - user-scope flat materialization)", () => {
    it("emits rules with .mdc extension under plugin-name-prefixed path", () => {
      expect(pathsFor(cursor)).toContain("sample-plugin/rules/standards.mdc");
    });

    it("emits cursor-format frontmatter on rules (globs key)", () => {
      const files = translator.translate(makeDist(), cursor);
      const rule = files.find((f) => f.relativePath.endsWith("standards.mdc"));
      expect(rule?.content).toContain("globs:");
    });

    it("does not emit plugin.json (pluginManifestRelativePath is null)", () => {
      const files = translator.translate(makeDist(), cursor);
      const manifest = files.find((f) => f.relativePath.endsWith("plugin.json"));
      expect(manifest).toBeUndefined();
    });

    it("does not emit hooks (acceptsHooks is false)", () => {
      expect(pathsFor(cursor)).not.toContain(expect.stringContaining("hooks/hooks.json"));
    });

    it("does not emit mcp (acceptsMcp is false)", () => {
      expect(pathsFor(cursor)).not.toContain(expect.stringContaining("mcp.json"));
    });

    it("emits commands under plugin-name-prefixed path", () => {
      expect(pathsFor(cursor)).toContain("sample-plugin/commands/greet.md");
    });

    it("file paths are base-relative (no .cursor/ prefix - base resolved at install time)", () => {
      const paths = pathsFor(cursor);
      expect(paths.every((p) => !p.startsWith(".cursor/"))).toBe(true);
    });
  });

  describe("codex target", () => {
    it("emits agents as TOML", () => {
      expect(pathsFor(codex)).toContain(".codex/plugins/sample-plugin/codex-agents/reviewer.toml");
    });

    it("agent content is TOML format", () => {
      const files = translator.translate(makeDist(), codex);
      const agent = files.find((f) => f.relativePath.endsWith("reviewer.toml"));
      expect(agent?.content).toContain("name =");
      expect(agent?.content).toContain("description =");
      expect(agent?.content).toContain("developer_instructions =");
    });

    it("emits native plugin manifest where the tool reads it", () => {
      const files = translator.translate(makeDist(), codex);
      const manifest = files.find(
        (f) => f.relativePath === ".codex/plugins/sample-plugin/.codex-plugin/plugin.json"
      );
      expect(manifest).toBeDefined();
    });
  });

  describe("copilot target", () => {
    it("emits commands as prompts with .prompt.md extension", () => {
      expect(pathsFor(copilot)).toContain(".github/plugins/sample-plugin/prompts/greet.prompt.md");
    });

    it("emits agents with .agent.md extension", () => {
      expect(pathsFor(copilot)).toContain(".github/plugins/sample-plugin/agents/reviewer.agent.md");
    });

    it("emits rules as instructions with .instructions.md extension", () => {
      expect(pathsFor(copilot)).toContain(
        ".github/plugins/sample-plugin/instructions/standards.instructions.md"
      );
    });
  });

  describe("opencode target (flat mode)", () => {
    it("emits commands under .opencode/commands/sample-plugin/ with name prefix", () => {
      const files = translator.translate(makeDist(), opencode);
      const greet = files.find(
        (f) => f.relativePath === ".opencode/commands/sample-plugin/greet.md"
      );
      expect(greet).toBeDefined();
      expect(greet?.content).toContain("name: 'aidd-sample-plugin:greet'");
    });

    it("emits agents at their native flat path", () => {
      expect(pathsFor(opencode)).toContain(".opencode/agents/sample-plugin-reviewer.md");
    });

    it("emits skills under .opencode/skills/sample-plugin/", () => {
      expect(pathsFor(opencode)).toContain(".opencode/skills/sample-plugin/hello/SKILL.md");
    });

    it("emits rules under .opencode/rules/sample-plugin/", () => {
      expect(pathsFor(opencode)).toContain(".opencode/rules/sample-plugin/standards.md");
    });
  });

  describe("antigravity target (flat mode, one-level skills)", () => {
    it("emits a skill as .agents/skills/<plugin>-<skill>/, never nested under the plugin", () => {
      expect(pathsFor(antigravity)).toEqual([
        ".agents/agents/sample-plugin-reviewer/agent.md",
        ".agents/skills/sample-plugin-hello/SKILL.md",
      ]);
    });
  });

  describe("vscode (IDE tool)", () => {
    it("returns empty array", () => {
      expect(translator.translate(makeDist(), vscode)).toEqual([]);
    });
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

describe("the MCP declaration an install merges into the tool's own config", () => {
  const NO_COMPONENTS = { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] };
  const declared = JSON.stringify({ mcpServers: { local: { command: "node", args: ["s.js"] } } });
  const withMcp = () => {
    const mcp = [makeFile(".mcp.json", declared)];
    return makeDist({
      files: mcp,
      components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp },
    });
  };

  it("is the declaration in the shape the tool's config holds", () => {
    expect(JSON.parse(translator.mcp(withMcp(), opencode) ?? "null").mcp.local.type).toBe("local");
  });

  it("is nothing for a plugin that declares no servers", () => {
    expect(translator.mcp(makeDist({ components: NO_COMPONENTS }), opencode)).toBeNull();
  });

  it("is nothing for a tool whose plugins carry their own MCP file", () => {
    expect(translator.mcp(withMcp(), claude)).toBeNull();
  });
});
