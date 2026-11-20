import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertGlobalFilesWritable,
  readGlobalPluginFiles,
} from "../../../../../src/contexts/installation/application/plugin/global-plugin-files.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import type { IsWithinUserScope } from "../../../../../src/contexts/machine-claims/contract/user-scope-containment.js";
import { FileHash, InstallationFile } from "../../../../../src/shared/domain/file.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

/** The machine-claims answer for a path it judges inside the user directory. */
const insideUserScope: IsWithinUserScope = () => true;
/** The machine-claims answer for a path it judges outside the user directory. */
const outsideUserScope: IsWithinUserScope = () => false;

const BUILT = "/cache/built/opencode";

function distribution(name: string, agents: string[]): PluginDistribution {
  const files = agents.map((relativePath) => ({ relativePath, content: "agent" }));
  return new PluginDistribution({
    manifest: { name, version: "1.0.0", strict: true },
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

describe("readGlobalPluginFiles", () => {
  it("reads the plugin's skills and the agents its source ships, keyed under the user directory", async () => {
    const files = await readGlobalPluginFiles(
      tree,
      BUILT,
      registeredTools().aiProfile(TOOL.opencode),
      distribution("aidd-dev", ["agents/reviewer.md", "agents/nested/ignored.md", "skills/x.md"])
    );

    expect(files.map((file) => [file.relativePath, file.content])).toEqual([
      ["agents/aidd-dev-reviewer.md", "reviewer"],
      ["skills/aidd-dev/01-plan/SKILL.md", "skill"],
    ]);
  });

  it("reads nothing for a plugin whose source ships no agent and no skill in the tree", async () => {
    const files = await readGlobalPluginFiles(
      tree,
      BUILT,
      registeredTools().aiProfile(TOOL.opencode),
      distribution("aidd-qa", [])
    );

    expect(files).toEqual([]);
  });

  it("reads nothing for a tool that copies no global file, which has no directory to write either", async () => {
    await expect(
      assertGlobalFilesWritable(
        new InMemoryFileAdapter(),
        registeredTools().aiProfile(TOOL.claude),
        undefined,
        "aidd-dev",
        [],
        "/h",
        insideUserScope
      )
    ).rejects.toThrow("claude: no machine-scope directory is declared.");
  });

  it("reads nothing for a tool that copies no global file", async () => {
    const files = await readGlobalPluginFiles(
      tree,
      BUILT,
      registeredTools().aiProfile(TOOL.claude),
      distribution("aidd-dev", ["agents/reviewer.md"])
    );

    expect(files).toEqual([]);
  });
});

describe("assertGlobalFilesWritable", () => {
  const HOME = "/home/me";
  const DIR = join(HOME, ".config", "opencode");
  const under = (...parts: string[]) => join(DIR, ...parts);
  const file = (relativePath: string, content = "new") =>
    new InstallationFile({ relativePath, content, hash: FileHash.of(content) });

  it("returns the user directory when every path stays inside it", async () => {
    const fs = new InMemoryFileAdapter({});

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredTools().aiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/a.md")],
        HOME,
        insideUserScope
      )
    ).resolves.toBe(DIR);
  });

  it.each(["/etc/passwd", "agents/../../escape.md", "agents\\a.md"])(
    "refuses the path %s that is not a plain relative path",
    async (path) => {
      const fs = new InMemoryFileAdapter({});

      await expect(
        assertGlobalFilesWritable(
          fs,
          registeredTools().aiProfile(TOOL.opencode),
          undefined,
          "aidd-dev",
          [file(path)],
          HOME,
          outsideUserScope
        )
      ).rejects.toThrow(`opencode: 'aidd-dev' path '${path}' escapes ${DIR}.`);
    }
  );

  it("refuses a parent that resolves outside the user directory", async () => {
    const fs = new InMemoryFileAdapter({ [under("agents", "kept.md")]: "x" }, ["/elsewhere"]);
    fs.setSymlink(under("agents"), "/elsewhere");

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredTools().aiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/a.md")],
        HOME,
        outsideUserScope
      )
    ).rejects.toThrow(`opencode: 'aidd-dev' parent '${under("agents")}' escapes ${DIR}.`);
  });

  it.each(["mine", "new"])("refuses an unowned file holding %s bytes", async (content) => {
    const fs = new InMemoryFileAdapter({ [under("agents", "a.md")]: content });

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredTools().aiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/a.md")],
        HOME,
        insideUserScope
      )
    ).rejects.toThrow(
      `opencode: '${under("agents", "a.md")}' already exists and was not installed by aidd`
    );
  });

  it("allows rewriting a file the plugin owns", async () => {
    const fs = new InMemoryFileAdapter({ [under("agents", "owned.md")]: "old" });
    const owned = InstalledPlugin.fromMetadata(
      "aidd-dev",
      "1.0.0",
      { kind: "local", path: "/fw/plugins/aidd-dev" },
      true,
      "user"
    ).withFiles(new Map([["agents/owned.md", "0".repeat(32)]]));

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredTools().aiProfile(TOOL.opencode),
        owned,
        "aidd-dev",
        [file("agents/owned.md")],
        HOME,
        insideUserScope
      )
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
      assertGlobalFilesWritable(
        fs,
        registeredTools().aiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/deep/a.md")],
        "/home/me",
        insideUserScope
      )
    ).resolves.toBe(DIR);
  });

  it("refuses a missing file below a parent link resolving outside the user directory", async () => {
    const fs = new InMemoryFileAdapter({ "/elsewhere/keep": "x" });
    fs.setSymlink(join(DIR, "agents"), "/elsewhere");

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredTools().aiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/deep/a.md")],
        "/home/me",
        outsideUserScope
      )
    ).rejects.toThrow(`opencode: 'aidd-dev' parent '${join(DIR, "agents")}' escapes ${DIR}.`);
  });
});
