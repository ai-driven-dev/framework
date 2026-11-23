import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertGlobalFilesWritable,
  readGlobalPluginFiles,
} from "../../../../../../src/contexts/installation/application/plugin/files/global-plugin-files.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../../src/shared/domain/installation-file.js";
import type { PathContainment } from "../../../../../../src/shared/domain/paths.model.js";
import { PluginDistribution } from "../../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

/** The machine-claims answer for a path it judges inside the user directory. */
const insideUserScope: PathContainment = () => true;
/** The machine-claims answer for a path it judges outside the user directory. */
const outsideUserScope: PathContainment = () => false;

const BUILT = "/cache/built/opencode";

function distribution(name: string, agents: string[]): PluginDistribution {
  const files = agents.map((relativePath) => ({ relativePath, content: "agent" }));
  return new PluginDistribution({
    manifest: { name: parsePluginName(name), version: "1.0.0", strict: true },
    format: TOOL.claude,
    files,
    components: { skills: [], commands: [], agents: files, rules: [], hooks: [], mcp: [] },
  });
}

const tree = new InMemoryFileAdapter({
  [`${BUILT}/.opencode/skills/aidd-dev/01-plan/SKILL.md`]: "skill",
  [`${BUILT}/.opencode/agents/aidd-dev-reviewer.md`]: "reviewer",
  [`${BUILT}/.opencode/agents/aidd-dev-tools-reviewer.md`]: "another plugin's",
  [`${BUILT}/.opencode/agents/aidd-pm-reviewer.md`]: "another plugin's",
  [`${BUILT}/.opencode/commands/aidd-dev-plan.md`]: "command",
});

describe("reading a plugin's global files", () => {
  it("reads the plugin's skills and the agents its source ships, keyed under the user directory", async () => {
    const files = await readGlobalPluginFiles(tree, {
      builtDir: BUILT,
      tool: registeredTools().aiProfile(TOOL.opencode),
      dist: distribution("aidd-dev", [
        "agents/reviewer.md",
        "agents/nested/ignored.md",
        "skills/x.md",
      ]),
    });

    expect(files.map((file) => [file.relativePath, file.content])).toEqual([
      ["agents/aidd-dev-reviewer.md", "reviewer"],
      ["skills/aidd-dev/01-plan/SKILL.md", "skill"],
    ]);
  });

  it("reads nothing for a plugin whose source ships no agent and no skill in the tree", async () => {
    const files = await readGlobalPluginFiles(tree, {
      builtDir: BUILT,
      tool: registeredTools().aiProfile(TOOL.opencode),
      dist: distribution("aidd-qa", []),
    });

    expect(files).toEqual([]);
  });

  it("reads nothing for a tool that copies no global file, which has no directory to write either", async () => {
    await expect(
      assertGlobalFilesWritable({
        fs: new InMemoryFileAdapter(),
        tool: registeredTools().aiProfile(TOOL.claude),
        plugin: undefined,
        pluginName: "aidd-dev",
        files: [],
        homedir: "/h",
        isWithinUserScope: insideUserScope,
      })
    ).rejects.toThrow("claude: no machine-scope directory is declared.");
  });

  it("reads nothing for a tool that copies no global file", async () => {
    const files = await readGlobalPluginFiles(tree, {
      builtDir: BUILT,
      tool: registeredTools().aiProfile(TOOL.claude),
      dist: distribution("aidd-dev", ["agents/reviewer.md"]),
    });

    expect(files).toEqual([]);
  });
});

describe("before writing global files", () => {
  const HOME = "/home/me";
  const DIR = join(HOME, ".config", "opencode");
  const under = (...parts: string[]) => join(DIR, ...parts);
  const file = (relativePath: string, content = "new") =>
    new InstallationFile({ relativePath, content, hash: FileHash.of(content) });

  it("returns the user directory when every path stays inside it", async () => {
    const fs = new InMemoryFileAdapter({});

    await expect(
      assertGlobalFilesWritable({
        fs,
        tool: registeredTools().aiProfile(TOOL.opencode),
        plugin: undefined,
        pluginName: "aidd-dev",
        files: [file("agents/a.md")],
        homedir: HOME,
        isWithinUserScope: insideUserScope,
      })
    ).resolves.toBe(DIR);
  });

  it.each(["/etc/passwd", "agents/../../escape.md", "agents\\a.md"])(
    "refuses the path %s that is not a plain relative path",
    async (path) => {
      const fs = new InMemoryFileAdapter({});

      await expect(
        assertGlobalFilesWritable({
          fs,
          tool: registeredTools().aiProfile(TOOL.opencode),
          plugin: undefined,
          pluginName: "aidd-dev",
          files: [file(path)],
          homedir: HOME,
          isWithinUserScope: outsideUserScope,
        })
      ).rejects.toThrow(`opencode: 'aidd-dev' path '${path}' escapes ${DIR}.`);
    }
  );

  it("refuses a parent that resolves outside the user directory", async () => {
    const fs = new InMemoryFileAdapter({ [under("agents", "kept.md")]: "x" }, ["/elsewhere"]);
    fs.setSymlink(under("agents"), "/elsewhere");

    await expect(
      assertGlobalFilesWritable({
        fs,
        tool: registeredTools().aiProfile(TOOL.opencode),
        plugin: undefined,
        pluginName: "aidd-dev",
        files: [file("agents/a.md")],
        homedir: HOME,
        isWithinUserScope: outsideUserScope,
      })
    ).rejects.toThrow(`opencode: 'aidd-dev' parent '${under("agents")}' escapes ${DIR}.`);
  });

  it.each(["mine", "new"])("refuses an unowned file holding %s bytes", async (content) => {
    const fs = new InMemoryFileAdapter({ [under("agents", "a.md")]: content });

    await expect(
      assertGlobalFilesWritable({
        fs,
        tool: registeredTools().aiProfile(TOOL.opencode),
        plugin: undefined,
        pluginName: "aidd-dev",
        files: [file("agents/a.md")],
        homedir: HOME,
        isWithinUserScope: insideUserScope,
      })
    ).rejects.toThrow(
      `opencode: '${under("agents", "a.md")}' already exists and was not installed by aidd`
    );
  });

  it("allows rewriting a file the plugin owns", async () => {
    const fs = new InMemoryFileAdapter({ [under("agents", "owned.md")]: "old" });
    const owned = RecordedPlugin.fromMetadata({
      name: "aidd-dev",
      version: "1.0.0",
      source: { kind: "local", path: "/fw/plugins/aidd-dev" },
      strict: true,
      scope: "user",
    }).withFiles(new Map([["agents/owned.md", "0".repeat(32)]])).plugin;

    await expect(
      assertGlobalFilesWritable({
        fs,
        tool: registeredTools().aiProfile(TOOL.opencode),
        plugin: owned,
        pluginName: "aidd-dev",
        files: [file("agents/owned.md")],
        homedir: HOME,
        isWithinUserScope: insideUserScope,
      })
    ).resolves.toBe(DIR);
  });
});

describe("assertGlobalFilesWritable on a filesystem that rejects a missing path", () => {
  const DIR = join("/home/me", ".config", "opencode");
  const file = (relativePath: string) =>
    new InstallationFile({ relativePath, content: "new", hash: FileHash.of("new") });

  it("allows a file whose parents are missing once the user directory resolves", async () => {
    const fs = new InMemoryFileAdapter({});

    await expect(
      assertGlobalFilesWritable({
        fs,
        tool: registeredTools().aiProfile(TOOL.opencode),
        plugin: undefined,
        pluginName: "aidd-dev",
        files: [file("agents/deep/a.md")],
        homedir: "/home/me",
        isWithinUserScope: insideUserScope,
      })
    ).resolves.toBe(DIR);
  });

  it("refuses a missing file below a parent link resolving outside the user directory", async () => {
    const fs = new InMemoryFileAdapter({ "/elsewhere/keep": "x" });
    fs.setSymlink(join(DIR, "agents"), "/elsewhere");

    await expect(
      assertGlobalFilesWritable({
        fs,
        tool: registeredTools().aiProfile(TOOL.opencode),
        plugin: undefined,
        pluginName: "aidd-dev",
        files: [file("agents/deep/a.md")],
        homedir: "/home/me",
        isWithinUserScope: outsideUserScope,
      })
    ).rejects.toThrow(`opencode: 'aidd-dev' parent '${join(DIR, "agents")}' escapes ${DIR}.`);
  });
});
