import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertGlobalFilesWritable,
  readGlobalPluginFiles,
} from "../../../../../src/contexts/framework/application/ownership/global-plugin-files.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { InstallationFile } from "../../../../../src/shared/domain/file.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { registeredAiProfile, TOOL } from "../../../tools/testing/catalog-of.js";

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
      new DeterministicHasher(),
      BUILT,
      registeredAiProfile(TOOL.opencode),
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
      new DeterministicHasher(),
      BUILT,
      registeredAiProfile(TOOL.opencode),
      distribution("aidd-qa", [])
    );

    expect(files).toEqual([]);
  });

  it("reads nothing for a tool that copies no global file, which has no directory to write either", async () => {
    await expect(
      assertGlobalFilesWritable(
        new InMemoryFileAdapter(),
        registeredAiProfile(TOOL.claude),
        undefined,
        "aidd-dev",
        [],
        "/h"
      )
    ).rejects.toThrow("claude: no machine-scope directory is declared.");
  });

  it("reads nothing for a tool that copies no global file", async () => {
    const files = await readGlobalPluginFiles(
      tree,
      new DeterministicHasher(),
      BUILT,
      registeredAiProfile(TOOL.claude),
      distribution("aidd-dev", ["agents/reviewer.md"])
    );

    expect(files).toEqual([]);
  });
});

describe("assertGlobalFilesWritable", () => {
  const hasher = new DeterministicHasher();
  const HOME = "/home/me";
  const DIR = join(HOME, ".config", "opencode");
  const under = (...parts: string[]) => join(DIR, ...parts);
  const file = (relativePath: string, content = "new") =>
    new InstallationFile({ relativePath, content, hash: hasher.hash(content) });

  it("returns the user directory when every path stays inside it", async () => {
    const fs = new InMemoryFileAdapter({}, hasher);

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredAiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/a.md")],
        HOME
      )
    ).resolves.toBe(DIR);
  });

  it.each(["/etc/passwd", "agents/../../escape.md", "agents\\a.md"])(
    "refuses the path %s that is not a plain relative path",
    async (path) => {
      const fs = new InMemoryFileAdapter({}, hasher);

      await expect(
        assertGlobalFilesWritable(
          fs,
          registeredAiProfile(TOOL.opencode),
          undefined,
          "aidd-dev",
          [file(path)],
          HOME
        )
      ).rejects.toThrow(`opencode: 'aidd-dev' path '${path}' escapes ${DIR}.`);
    }
  );

  it("refuses a parent that resolves outside the user directory", async () => {
    const fs = new InMemoryFileAdapter({ [under("agents", "kept.md")]: "x" }, hasher);
    fs.setSymlink(under("agents"), "/elsewhere");

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredAiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/a.md")],
        HOME
      )
    ).rejects.toThrow(`opencode: 'aidd-dev' parent '${under("agents")}' escapes ${DIR}.`);
  });

  it.each(["mine", "new"])("refuses an unowned file holding %s bytes", async (content) => {
    const fs = new InMemoryFileAdapter({ [under("agents", "a.md")]: content }, hasher);

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredAiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/a.md")],
        HOME
      )
    ).rejects.toThrow(
      `opencode: '${under("agents", "a.md")}' already exists and was not installed by aidd`
    );
  });

  it("allows rewriting a file the plugin owns", async () => {
    const fs = new InMemoryFileAdapter({ [under("agents", "owned.md")]: "old" }, hasher);
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
        registeredAiProfile(TOOL.opencode),
        owned,
        "aidd-dev",
        [file("agents/owned.md")],
        HOME
      )
    ).resolves.toBe(DIR);
  });
});

describe("assertGlobalFilesWritable on a filesystem that rejects a missing path", () => {
  const hasher = new DeterministicHasher();
  const DIR = join("/home/me", ".config", "opencode");
  const file = (relativePath: string) =>
    new InstallationFile({ relativePath, content: "new", hash: hasher.hash("new") });

  it("allows a file whose parents are missing once the user directory resolves", async () => {
    const fs = new InMemoryFileAdapter({}, hasher).rejectMissingRealpath();

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredAiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/deep/a.md")],
        "/home/me"
      )
    ).resolves.toBe(DIR);
  });

  it("refuses a missing file below a parent link resolving outside the user directory", async () => {
    const fs = new InMemoryFileAdapter({ "/elsewhere/keep": "x" }, hasher).rejectMissingRealpath();
    fs.setSymlink(join(DIR, "agents"), "/elsewhere");

    await expect(
      assertGlobalFilesWritable(
        fs,
        registeredAiProfile(TOOL.opencode),
        undefined,
        "aidd-dev",
        [file("agents/deep/a.md")],
        "/home/me"
      )
    ).rejects.toThrow(`opencode: 'aidd-dev' parent '${join(DIR, "agents")}' escapes ${DIR}.`);
  });
});
