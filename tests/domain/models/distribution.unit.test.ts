import { assert, describe, expect, it } from "vitest";
import { generateDistribution } from "../../../src/domain/models/distribution.js";
import { FileHash } from "../../../src/domain/models/file-hash.js";
import { FrameworkDescriptor } from "../../../src/domain/models/framework-descriptor.js";
import type { FileSystem } from "../../../src/domain/ports/file-system.js";
import type { Hasher } from "../../../src/domain/ports/hasher.js";
import type { Platform } from "../../../src/domain/ports/platform.js";
import { claudeToolConfig } from "../../../src/domain/tools/claude.js";
import { copilotToolConfig } from "../../../src/domain/tools/copilot.js";
import { cursorToolConfig } from "../../../src/domain/tools/cursor.js";
import { opencodeToolConfig } from "../../../src/domain/tools/opencode.js";

const linuxPlatform: Platform = { current: () => "linux" };
const win32Platform: Platform = { current: () => "win32" };

const framework = new FrameworkDescriptor({
  version: "3.2.2",
  contentSections: [
    { name: "agents", directory: "agents", entryFile: null },
    { name: "commands", directory: "commands", entryFile: null },
    { name: "rules", directory: "rules", entryFile: null },
    { name: "skills", directory: "skills", entryFile: "SKILL.md" },
  ],
  templateRefs: [{ name: "agentsMd", path: "aidd_docs/templates/AGENTS.md" }],
  configRefs: [{ name: "mcp", path: "config/mcp.json" }],
  scriptRefs: [],
});

let hashCounter = 0;
const stubHasher: Hasher = {
  hash: (_content: string): FileHash => {
    const hex = (hashCounter % 16).toString(16).repeat(32);
    hashCounter++;
    return new FileHash(hex);
  },
};

const stubFs: FileSystem = {
  fileExists: async (_path: string): Promise<boolean> => false,
  writeFile: async (_path: string, _content: string): Promise<void> => {},
  deleteFile: async (_path: string): Promise<void> => {},
  createDirectory: async (_path: string): Promise<void> => {},
  deleteEmptyDirectories: async (_path: string): Promise<void> => {},
  readFile: async (_path: string): Promise<string> => "",
  listDirectory: async (_path: string): Promise<string[]> => [],
  readFileHash: async (_path: string): Promise<FileHash> => new FileHash("0".repeat(32)),
  mergeJsonFile: async (_path: string, _content: string): Promise<void> => {},
  deleteDirectory: async (_path: string): Promise<void> => {},
  chmodExecutable: async (_path: string): Promise<void> => {},
  backup: async (_absolutePath: string): Promise<string> => _absolutePath,
  hasLocalChanges: async (_path: string, _knownHash: FileHash): Promise<boolean> => false,
};

const stubProjectRoot = "/";

// 3 per section = 12 files total
const contentFiles = new Map<string, string>([
  ["agents/code-reviewer.md", "# Code Reviewer"],
  ["agents/refactor-guide.md", "# Refactor Guide"],
  ["agents/test-writer.md", "# Test Writer"],
  ["commands/04_code/implement.md", "# Implement"],
  ["commands/06_tests/write-tests.md", "# Write Tests"],
  ["commands/08_deploy/commit.md", "# Commit"],
  ["rules/01-standards/naming.md", '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Naming'],
  [
    "rules/01-standards/no-silent-errors.md",
    '---\npaths:\n  - "src/**/*.ts"\n---\n\n# No Silent Errors',
  ],
  ["rules/04-tooling/biome.md", '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Biome'],
  ["skills/commit/SKILL.md", "# Commit Skill"],
  ["skills/debug/SKILL.md", "# Debug Skill"],
  ["skills/review-pr/SKILL.md", "# Review PR Skill"],
]);

describe("generateDistribution()", () => {
  it("produces files for Claude ToolSpec", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files.length).toBe(12);
    for (const f of files) {
      expect(f.relativePath.startsWith(".claude/")).toBe(true);
    }
  });

  it("produces files for Cursor ToolSpec", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      cursorToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files.length).toBe(12);
    for (const f of files) {
      expect(f.relativePath.startsWith(".cursor/")).toBe(true);
    }
  });

  it("produces files for Copilot ToolSpec", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files.length).toBe(12);
    for (const f of files) {
      expect(f.relativePath.startsWith(".github/") || f.relativePath.startsWith(".vscode/")).toBe(
        true
      );
    }
  });

  it("Copilot agents go to .github/agents/ with .agent.md extension", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const agentFiles = files.filter((f) => f.relativePath.startsWith(".github/agents/"));
    expect(agentFiles.length).toBeGreaterThan(0);
    for (const f of agentFiles) {
      expect(f.relativePath).toMatch(/\.agent\.md$/);
    }
  });

  it("Copilot commands go to .github/prompts/ with .prompt.md extension", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const promptFiles = files.filter((f) => f.relativePath.startsWith(".github/prompts/"));
    expect(promptFiles.length).toBeGreaterThan(0);
    for (const f of promptFiles) {
      expect(f.relativePath).toMatch(/\.prompt\.md$/);
    }
  });

  it("Copilot rules go to .github/instructions/ with .instructions.md extension", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const ruleFiles = files.filter((f) => f.relativePath.startsWith(".github/instructions/"));
    expect(ruleFiles.length).toBeGreaterThan(0);
    for (const f of ruleFiles) {
      expect(f.relativePath).toMatch(/\.instructions\.md$/);
    }
  });

  it("Copilot skills go to .github/skills/", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const skillFiles = files.filter((f) => f.relativePath.startsWith(".github/skills/"));
    expect(skillFiles.length).toBeGreaterThan(0);
  });

  it("each generated file has a FileHash", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    for (const f of files) {
      expect(f.hash).toBeDefined();
      expect(f.hash.value).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("skills section only includes SKILL.md entryFile", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const skillFiles = files.filter((f) => f.relativePath.includes("skills"));
    for (const f of skillFiles) {
      expect(f.relativePath).toContain("SKILL.md");
    }
  });

  it("rewrites {{TOOLS}}/ placeholder in content", async () => {
    hashCounter = 0;
    const singleFileMap = new Map([["agents/test.md", "path: {{TOOLS}}/agents/"]]);
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      singleFileMap,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files[0]?.content).toContain(".claude/");
    expect(files[0]?.content).not.toContain("{{TOOLS}}");
  });

  it("excludes tool-specific files not belonging to the active tool", async () => {
    hashCounter = 0;
    const withToolFiles = new Map([
      ["rules/04-tooling/ide-mapping.claude.md", "---\npaths:\n---\n# Claude"],
      ["rules/04-tooling/ide-mapping.cursor.md", "---\nalwaysApply: true\n---\n# Cursor"],
      ["rules/04-tooling/ide-mapping.copilot.md", "---\napplyTo: '**'\n---\n# Copilot"],
      ["rules/01-standards/generic.md", "# Generic rule"],
    ]);
    const claudeFiles = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      withToolFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const claudePaths = claudeFiles.map((f) => f.relativePath);
    expect(claudePaths.some((p) => p.endsWith("04-tooling/ide-mapping.md"))).toBe(true);
    expect(claudePaths.some((p) => p.includes("ide-mapping.cursor"))).toBe(false);
    expect(claudePaths.some((p) => p.includes("ide-mapping.copilot"))).toBe(false);
    expect(claudePaths.some((p) => p.includes("generic.md"))).toBe(true);
  });

  it("converts frontmatter for Cursor: paths -> globs", async () => {
    hashCounter = 0;
    const singleFileMap = new Map([
      ["rules/01-standards/naming.md", '---\npaths:\n  - "src/**/*.ts"\n---\n\n# Naming'],
    ]);
    const files = await generateDistribution(
      framework,
      cursorToolConfig,
      "aidd_docs",
      singleFileMap,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files[0]?.content).toContain("globs:");
    expect(files[0]?.content).toContain("alwaysApply:");
    expect(files[0]?.content).not.toContain("paths:");
  });

  it("keeps description for claude rules with alwaysApply false and no paths", async () => {
    hashCounter = 0;
    const singleFileMap = new Map([
      [
        "rules/01-standards/naming.md",
        "---\ndescription: Standards\nalwaysApply: false\n---\n\n# Naming",
      ],
    ]);
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      singleFileMap,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files[0]?.content).not.toContain("paths:");
    expect(files[0]?.content).not.toContain("alwaysApply:");
    expect(files[0]?.content).toContain("description: 'Standards'");
    expect(files[0]?.content).toContain("# Naming");
  });

  it("installs copilot rule with globs + alwaysApply: false as applyTo", async () => {
    hashCounter = 0;
    const singleFileMap = new Map([
      [
        "rules/01-standards/command-structure.md",
        '---\ndescription: Standards\nglobs: ["{{TOOLS}}/rules/**/*.md"]\nalwaysApply: false\n---\n\n# Command Structure',
      ],
    ]);
    const files = await generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      singleFileMap,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files.length).toBe(1);
    expect(files[0]?.relativePath).toBe(
      ".github/instructions/01-command-structure.instructions.md"
    );
    expect(files[0]?.content).toContain("applyTo:");
    expect(files[0]?.content).toContain("# Command Structure");
  });

  it("includes MCP config for Claude at .mcp.json regardless of source path", async () => {
    hashCounter = 0;
    const withConfig = new Map([...contentFiles, ["config/mcp.json", '{"mcpServers":{}}']]);
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      withConfig,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files.find((f) => f.relativePath === ".mcp.json")).toBeDefined();
    expect(files.find((f) => f.relativePath === "config/mcp.json")).toBeUndefined();
  });

  it("includes MCP config for Cursor at .cursor/mcp.json", async () => {
    hashCounter = 0;
    const withConfig = new Map([...contentFiles, ["config/mcp.json", '{"mcpServers":{}}']]);
    const files = await generateDistribution(
      framework,
      cursorToolConfig,
      "aidd_docs",
      withConfig,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const mcp = files.find((f) => f.relativePath === ".cursor/mcp.json");
    expect(mcp).toBeDefined();
  });

  it("transforms MCP npx command on win32 platform", async () => {
    hashCounter = 0;
    const mcpContent = JSON.stringify({
      mcpServers: { myServer: { command: "npx", args: ["-y", "my-pkg"] } },
    });
    const withConfig = new Map([...contentFiles, ["config/mcp.json", mcpContent]]);
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      withConfig,
      stubHasher,
      win32Platform,
      stubProjectRoot,
      stubFs
    );
    const mcp = files.find((f) => f.relativePath === ".mcp.json");
    expect(mcp).toBeDefined();
    const parsed = JSON.parse(mcp?.content ?? "{}");
    expect(parsed.mcpServers.myServer.command).toBe("cmd");
    expect(parsed.mcpServers.myServer.args).toEqual(["/c", "npx", "-y", "my-pkg"]);
  });

  it("Claude commands land in .claude/commands/aidd/{phase}/ subdirectory", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      contentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const commandFiles = files.filter((f) => f.relativePath.includes("commands"));
    expect(commandFiles).toHaveLength(3);
    for (const f of commandFiles) {
      expect(f.relativePath).toMatch(/^\.claude\/commands\/aidd\/\d+\//);
    }
  });

  it("Claude rewrites @{{TOOLS}}/commands/ to @.claude/commands/aidd/{phase}/", async () => {
    hashCounter = 0;
    const withInclude = new Map([["agents/test.md", "@{{TOOLS}}/commands/04_code/implement.md"]]);
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      withInclude,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files[0]?.content).toContain("@.claude/commands/aidd/04/implement.md");
    expect(files[0]?.content).not.toContain("@{{TOOLS}}");
  });

  it("includes memory bank as CLAUDE.md for Claude", async () => {
    hashCounter = 0;
    const withTemplate = new Map([
      ...contentFiles,
      ["aidd_docs/templates/AGENTS.md", "# Memory Bank\n"],
    ]);
    const files = await generateDistribution(
      framework,
      claudeToolConfig,
      "aidd_docs",
      withTemplate,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files.find((f) => f.relativePath === "CLAUDE.md")).toBeDefined();
  });

  it("includes memory bank as AGENTS.md for Cursor", async () => {
    hashCounter = 0;
    const withTemplate = new Map([
      ...contentFiles,
      ["aidd_docs/templates/AGENTS.md", "# Memory Bank\n"],
    ]);
    const files = await generateDistribution(
      framework,
      cursorToolConfig,
      "aidd_docs",
      withTemplate,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files.find((f) => f.relativePath === "AGENTS.md")).toBeDefined();
  });

  it("includes memory bank as .github/copilot-instructions.md for Copilot", async () => {
    hashCounter = 0;
    const withTemplate = new Map([
      ...contentFiles,
      ["aidd_docs/templates/AGENTS.md", "# Memory Bank\n"],
    ]);
    const files = await generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      withTemplate,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files.find((f) => f.relativePath === ".github/copilot-instructions.md")).toBeDefined();
  });

  it("includes MCP config for Copilot at .vscode/mcp.json", async () => {
    hashCounter = 0;
    const withConfig = new Map([...contentFiles, ["config/mcp.json", '{"mcpServers":{}}']]);
    const files = await generateDistribution(
      framework,
      copilotToolConfig,
      "aidd_docs",
      withConfig,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const mcp = files.find((f) => f.relativePath === ".vscode/mcp.json");
    expect(mcp).toBeDefined();
  });

  describe("OpenCode", () => {
    it("transforms MCP servers to OpenCode format in opencode.json", async () => {
      hashCounter = 0;
      const withMcp = new Map([
        ...contentFiles,
        [
          "config/mcp.json",
          JSON.stringify({
            mcpServers: {
              "my-server": { command: "npx", args: ["-y", "my-pkg"], env: { KEY: "val" } },
            },
          }),
        ],
      ]);
      const opencodeFramework = new FrameworkDescriptor({
        version: "1.0.0",
        contentSections: [],
        templateRefs: [],
        configRefs: [{ name: "mcp", path: "config/mcp.json" }],
        scriptRefs: [],
      });
      const files = await generateDistribution(
        opencodeFramework,
        opencodeToolConfig,
        "aidd_docs",
        withMcp,
        stubHasher,
        linuxPlatform,
        stubProjectRoot,
        stubFs
      );
      const mcpFile = files.find((f) => f.relativePath === "opencode.json");
      assert(mcpFile !== undefined, "opencode.json not generated");
      expect(mcpFile.merge).toBe(true);
      expect(JSON.parse(mcpFile.content)).toEqual({
        mcp: {
          "my-server": {
            type: "local",
            command: ["npx", "-y", "my-pkg"],
            enabled: true,
            environment: { KEY: "val" },
          },
        },
      });
    });

    it("opencode settings and MCP config both contribute to opencode.json", async () => {
      hashCounter = 0;
      const withBothConfigs = new Map([
        ...contentFiles,
        ["config/mcp.json", JSON.stringify({ mcpServers: { server: { command: "node" } } })],
        ["config/opencode.json", JSON.stringify({ model: "claude-sonnet-4-5" })],
      ]);
      const opencodeFramework = new FrameworkDescriptor({
        version: "1.0.0",
        contentSections: [],
        templateRefs: [],
        configRefs: [
          { name: "mcp", path: "config/mcp.json" },
          { name: "opencode", path: "config/opencode.json" },
        ],
        scriptRefs: [],
      });
      const files = await generateDistribution(
        opencodeFramework,
        opencodeToolConfig,
        "aidd_docs",
        withBothConfigs,
        stubHasher,
        linuxPlatform,
        stubProjectRoot,
        stubFs
      );
      const opencodeJsonFiles = files.filter((f) => f.relativePath === "opencode.json");
      expect(opencodeJsonFiles).toHaveLength(2);
      expect(opencodeJsonFiles.every((f) => f.merge)).toBe(true);
      const contents = opencodeJsonFiles.map(
        (f) => JSON.parse(f.content) as Record<string, unknown>
      );
      expect(contents.some((c) => c.mcp !== undefined)).toBe(true);
      expect(contents.some((c) => c.model === "claude-sonnet-4-5")).toBe(true);
    });
  });
});

describe("generateDistribution() snapshots", () => {
  const snapshotContentFiles = new Map<string, string>([
    [
      "agents/alexia.md",
      "---\nname: alexia\ndescription: Autonomous agent\nmodel: opus\n---\n\n# Alexia\n\nUse @{{TOOLS}}/rules/01-standards/naming.md for rules.\n",
    ],
    [
      "commands/04_code/implement.md",
      "---\nname: implement\ndescription: Implement a plan\nargument-hint: task description\n---\n\n# Implement\n\nReference: @{{TOOLS}}/commands/04_code/implement.md\n",
    ],
    [
      "rules/01-standards/naming.md",
      '---\npaths:\n  - "src/**/*.ts"\ndescription: Naming standards\n---\n\n# Naming\n',
    ],
    ["skills/commit/SKILL.md", "# Commit Skill\n\nUse {{TOOLS}}/agents/ for agents.\n"],
    [
      "aidd_docs/templates/AGENTS.md",
      "---\nname: agents\ndescription: Memory bank\n---\n\n# AGENTS.md\n\nSee @{{TOOLS}}/rules/01-standards/naming.md\n",
    ],
    ["config/mcp.json", '{"mcpServers":{}}'],
  ]);

  const snapshotFramework = new FrameworkDescriptor({
    version: "3.2.2",
    contentSections: [
      { name: "agents", directory: "agents", entryFile: null },
      { name: "commands", directory: "commands", entryFile: null },
      { name: "rules", directory: "rules", entryFile: null },
      { name: "skills", directory: "skills", entryFile: "SKILL.md" },
    ],
    templateRefs: [{ name: "agentsMd", path: "aidd_docs/templates/AGENTS.md" }],
    configRefs: [{ name: "mcp", path: "config/mcp.json" }],
    scriptRefs: [],
  });

  it("Claude — agents content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      claudeToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const agent = files.find((f) => f.relativePath.includes("agents/"));
    expect(agent?.content).toEqual(
      "---\nname: 'alexia'\ndescription: 'Autonomous agent'\n---\n\n# Alexia\n\nUse @.claude/rules/01-standards/naming.md for rules.\n"
    );
  });

  it("Claude — commands content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      claudeToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const cmd = files.find((f) => f.relativePath.includes("commands/"));
    expect(cmd?.content).toEqual(
      "---\nname: 'aidd:04:implement'\ndescription: 'Implement a plan'\nargument-hint: 'task description'\n---\n\n# Implement\n\nReference: @.claude/commands/aidd/04/implement.md\n"
    );
  });

  it("Claude — rules content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      claudeToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const rule = files.find((f) => f.relativePath.includes("rules/"));
    expect(rule?.content).toEqual('---\npaths:\n  - "src/**/*.ts"\n---\n\n# Naming\n');
  });

  it("Claude — skills content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      claudeToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const skill = files.find((f) => f.relativePath.includes("skills/"));
    expect(skill?.content).toEqual("# Commit Skill\n\nUse .claude/agents/ for agents.\n");
  });

  it("Claude — config content is passed through unchanged", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      claudeToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const config = files.find((f) => f.relativePath === ".mcp.json");
    expect(config?.content).toEqual('{"mcpServers":{}}');
  });

  it("Claude — memoryBank content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      claudeToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const mem = files.find((f) => f.relativePath === "CLAUDE.md");
    expect(mem?.content).toEqual(
      "---\nname: agents\ndescription: Memory bank\n---\n\n# AGENTS.md\n\nSee @.claude/rules/01-standards/naming.md\n"
    );
  });

  describe("OpenCode", () => {
    it("skills installed content uses the .opencode/ tool directory path", async () => {
      hashCounter = 0;
      const files = await generateDistribution(
        snapshotFramework,
        opencodeToolConfig,
        "aidd_docs",
        snapshotContentFiles,
        stubHasher,
        linuxPlatform,
        stubProjectRoot,
        stubFs
      );
      const skill = files.find((f) => f.relativePath.includes("skills/"));
      expect(skill?.content).toEqual("# Commit Skill\n\nUse .opencode/agents/ for agents.\n");
    });

    it("workflow skills with bare command paths produce working references", async () => {
      hashCounter = 0;
      const withWorkflow = new Map([
        ...snapshotContentFiles,
        [
          "skills/workflow/SKILL.md",
          "# Workflow\n\n1. Brainstorm: {{TOOLS}}/commands/02_context/brainstorm.md\n2. Plan: {{TOOLS}}/commands/03_plan/plan.md\n",
        ],
      ]);
      const files = await generateDistribution(
        snapshotFramework,
        opencodeToolConfig,
        "aidd_docs",
        withWorkflow,
        stubHasher,
        linuxPlatform,
        stubProjectRoot,
        stubFs
      );
      const skill = files.find((f) => f.relativePath.includes("workflow/"));
      expect(skill?.content).toEqual(
        "# Workflow\n\n1. Brainstorm: .opencode/commands/aidd/02/brainstorm.md\n2. Plan: .opencode/commands/aidd/03/plan.md\n"
      );
    });
  });

  it("Cursor — agents content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      cursorToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const agent = files.find((f) => f.relativePath.includes("agents/"));
    expect(agent?.content).toEqual(
      "---\nname: 'alexia'\ndescription: 'Autonomous agent'\n---\n\n# Alexia\n\nUse @.cursor/rules/01-standards/naming.mdc for rules.\n"
    );
  });

  it("Cursor — commands content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      cursorToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const cmd = files.find((f) => f.relativePath.includes("commands/"));
    expect(cmd?.content).toEqual(
      "---\nname: 'aidd:04:implement'\ndescription: 'Implement a plan'\nargument-hint: 'task description'\n---\n\n# Implement\n\nReference: @.cursor/commands/aidd/04/implement.md\n"
    );
  });

  it("Cursor — rules content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      cursorToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const rule = files.find((f) => f.relativePath.includes("rules/"));
    expect(rule?.content).toEqual(
      "---\ndescription: 'Naming standards'\nglobs: [\"src/**/*.ts\"]\nalwaysApply: false\n---\n\n# Naming\n"
    );
  });

  it("Cursor — skills content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      cursorToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const skill = files.find((f) => f.relativePath.includes("skills/"));
    expect(skill?.content).toEqual("# Commit Skill\n\nUse .cursor/agents/ for agents.\n");
  });

  it("Cursor — config content is passed through unchanged", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      cursorToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const config = files.find((f) => f.relativePath === ".cursor/mcp.json");
    expect(config?.content).toEqual('{"mcpServers":{}}');
  });

  it("Cursor — memoryBank content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      cursorToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const mem = files.find((f) => f.relativePath === "AGENTS.md");
    expect(mem?.content).toEqual(
      "---\nname: agents\ndescription: Memory bank\n---\n\n# AGENTS.md\n\nSee @.cursor/rules/01-standards/naming.mdc\n"
    );
  });

  it("Copilot — agents content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      copilotToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const agent = files.find((f) => f.relativePath.startsWith(".github/agents/"));
    expect(agent?.content).toEqual(
      "---\nname: 'alexia'\ndescription: 'Autonomous agent'\n---\n\n# Alexia\n\nUse [.github/instructions/01-naming.instructions.md](../../.github/instructions/01-naming.instructions.md) for rules.\n"
    );
  });

  it("Copilot — commands content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      copilotToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const cmd = files.find((f) => f.relativePath.startsWith(".github/prompts/"));
    expect(cmd?.content).toEqual(
      "---\nname: 'aidd:04:implement'\ndescription: 'Implement a plan'\nargument-hint: 'task description'\n---\n\n# Implement\n\nReference: [.github/prompts/04-implement.prompt.md](../../.github/prompts/04-implement.prompt.md)\n"
    );
  });

  it("Copilot — rules content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      copilotToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const rule = files.find((f) => f.relativePath.startsWith(".github/instructions/"));
    expect(rule?.content).toEqual("---\napplyTo: 'src/**/*.ts'\n---\n\n# Naming\n");
  });

  it("Copilot — skills content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      copilotToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const skill = files.find((f) => f.relativePath.startsWith(".github/skills/"));
    expect(skill?.content).toEqual("# Commit Skill\n\nUse .github/agents/ for agents.\n");
  });

  it("Copilot — config content is passed through unchanged", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      copilotToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const config = files.find((f) => f.relativePath === ".vscode/mcp.json");
    expect(config?.content).toEqual('{"mcpServers":{}}');
  });

  it("Copilot — memoryBank content is rewritten correctly", async () => {
    hashCounter = 0;
    const files = await generateDistribution(
      snapshotFramework,
      copilotToolConfig,
      "aidd_docs",
      snapshotContentFiles,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    const mem = files.find((f) => f.relativePath === ".github/copilot-instructions.md");
    expect(mem?.content).toEqual(
      "# Copilot Instructions\n\nSee [.github/instructions/01-naming.instructions.md](../.github/instructions/01-naming.instructions.md)\n"
    );
  });

  it("Copilot rewrites @{{TOOLS}}/skills/ reference in body", async () => {
    hashCounter = 0;
    const withRef = new Map([["agents/test.md", "@{{TOOLS}}/skills/commit/SKILL.md"]]);
    const files = await generateDistribution(
      snapshotFramework,
      copilotToolConfig,
      "aidd_docs",
      withRef,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files[0]?.content).toEqual(
      "---\nname: 'undefined'\ndescription: 'undefined'\n---\n[.github/skills/commit/SKILL.md](../../.github/skills/commit/SKILL.md)"
    );
  });

  it("Copilot rewrites @{{TOOLS}}/commands/ reference in body", async () => {
    hashCounter = 0;
    const withRef = new Map([
      [
        "agents/test.md",
        "@{{TOOLS}}/commands/04_code/implement.md and @{{TOOLS}}/rules/01-standards/naming.md",
      ],
    ]);
    const files = await generateDistribution(
      snapshotFramework,
      copilotToolConfig,
      "aidd_docs",
      withRef,
      stubHasher,
      linuxPlatform,
      stubProjectRoot,
      stubFs
    );
    expect(files[0]?.content).toEqual(
      "---\nname: 'undefined'\ndescription: 'undefined'\n---\n[.github/prompts/04-implement.prompt.md](../../.github/prompts/04-implement.prompt.md) and [.github/instructions/01-naming.instructions.md](../../.github/instructions/01-naming.instructions.md)"
    );
  });
});
