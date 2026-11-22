import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertUserPluginWritable } from "../../../../../../src/contexts/installation/application/plugin/files/assert-user-plugin-writable.js";
import type { InstalledPlugin } from "../../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { RecordedPlugin } from "../../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../../src/shared/domain/installation-file.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { userScopeFileGuard } from "../../../testing/user-scope-file-guard.fake.js";

const HOME = "/home/u";
const BASE = join(HOME, ".cursor/plugins/local");
const FILE = InstallationFile.hashing("sample-plugin/skills/demo/SKILL.md", "# Skill");

function plugin(): InstalledPlugin {
  return RecordedPlugin.fromMetadata({
    name: "sample-plugin",
    version: "1.0.0",
    source: { kind: "local", path: "/source" },
    strict: false,
    scope: "user",
  }).plugin;
}

function write(owned: InstalledPlugin) {
  return {
    plugin: owned,
    tool: registeredTools().aiProfile(TOOL.cursor),
    files: [FILE],
    home: HOME,
    isWithinUserScope: () => true,
  };
}

describe("assertUserPluginWritable", () => {
  it("creates the plugin directory and accepts a first install", async () => {
    const fs = new InMemoryFileAdapter();

    await expect(
      assertUserPluginWritable({ fs, guard: userScopeFileGuard }, write(plugin()))
    ).resolves.toBeUndefined();
  });

  it("refuses to overwrite an existing file the plugin does not own", async () => {
    const fs = new InMemoryFileAdapter({ [join(BASE, FILE.relativePath)]: "user content" });

    await expect(
      assertUserPluginWritable({ fs, guard: userScopeFileGuard }, write(plugin()))
    ).rejects.toThrow("has untracked existing file");
  });

  it("accepts a file the plugin already records", async () => {
    const fs = new InMemoryFileAdapter({ [join(BASE, FILE.relativePath)]: "old" });
    const owned = plugin().withFiles(new Map([[FILE.relativePath, FileHash.of("old").value]]));

    await expect(
      assertUserPluginWritable({ fs, guard: userScopeFileGuard }, write(owned))
    ).resolves.toBeUndefined();
  });
});
