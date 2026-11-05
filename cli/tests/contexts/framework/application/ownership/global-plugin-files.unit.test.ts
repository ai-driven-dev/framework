import { join } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import {
  assertGlobalFilesWritable,
  readGlobalPluginFiles,
} from "../../../../../src/contexts/framework/application/ownership/global-plugin-files.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";

const BUILT = "/cache/built/opencode";

function distribution(name: string, agents: string[]): PluginDistribution {
  const files = agents.map((relativePath) => ({ relativePath, content: "agent" }));
  return new PluginDistribution({
    manifest: { name, version: "1.0.0", strict: true },
    format: "claude",
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
      "opencode",
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
      "opencode",
      distribution("aidd-qa", [])
    );

    expect(files).toEqual([]);
  });

  it("reads nothing for a tool that copies no global file, which has no directory to write either", async () => {
    await expect(
      assertGlobalFilesWritable(
        new InMemoryFileAdapter(),
        "claude",
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
      "claude",
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
      assertGlobalFilesWritable(fs, "opencode", undefined, "aidd-dev", [file("agents/a.md")], HOME)
    ).resolves.toBe(DIR);
  });

  it.each(["/etc/passwd", "agents/../../escape.md", "agents\\a.md"])(
    "refuses the path %s that is not a plain relative path",
    async (path) => {
      const fs = new InMemoryFileAdapter({}, hasher);

      await expect(
        assertGlobalFilesWritable(fs, "opencode", undefined, "aidd-dev", [file(path)], HOME)
      ).rejects.toThrow(`opencode: 'aidd-dev' path '${path}' escapes ${DIR}.`);
    }
  );

  it("refuses a parent that resolves outside the user directory", async () => {
    const fs = new InMemoryFileAdapter({ [under("agents", "kept.md")]: "x" }, hasher);
    fs.setSymlink(under("agents"), "/elsewhere");

    await expect(
      assertGlobalFilesWritable(fs, "opencode", undefined, "aidd-dev", [file("agents/a.md")], HOME)
    ).rejects.toThrow(`opencode: 'aidd-dev' parent '${under("agents")}' escapes ${DIR}.`);
  });

  it("refuses to overwrite a file it does not own that holds other bytes", async () => {
    const fs = new InMemoryFileAdapter({ [under("agents", "a.md")]: "mine" }, hasher);

    await expect(
      assertGlobalFilesWritable(fs, "opencode", undefined, "aidd-dev", [file("agents/a.md")], HOME)
    ).rejects.toThrow(
      `opencode: '${under("agents", "a.md")}' already exists and was not installed by aidd`
    );
  });

  it("adopts a file already holding the same bytes, and rewrites a file the plugin owns", async () => {
    const fs = new InMemoryFileAdapter(
      { [under("agents", "same.md")]: "new", [under("agents", "owned.md")]: "old" },
      hasher
    );
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
        "opencode",
        owned,
        "aidd-dev",
        [file("agents/same.md"), file("agents/owned.md")],
        HOME
      )
    ).resolves.toBe(DIR);
  });
});
