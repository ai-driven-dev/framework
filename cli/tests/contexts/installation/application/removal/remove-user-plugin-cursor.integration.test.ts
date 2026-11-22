import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { userScopeFilesSafeToDelete } from "../../../../../src/composition/machine-claims.js";
import { homeDirResolver } from "../../../../../src/composition/user-config-dir.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeMarketplaceRegistry } from "../../testing/fake-marketplace-registry.fake.js";
import { aManifest } from "../../testing/manifest.builder.js";
import { userPluginRemover } from "../../testing/plugin-remover.builder.js";

describe("Cursor user plugin boundary", () => {
  it("removes exactly an AIDD-owned file and its canonical user record", async () => {
    const machine = aManifest()
      .withTool(TOOL.cursor, [])
      .withPlugin(
        TOOL.cursor,
        RecordedPlugin.fromJSON({
          name: "sample-plugin",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {
            "sample-plugin/plugin.json": FileHash.of("owned bytes").value,
          },
          scope: "user",
          dependents: [],
        })
      )
      .build();
    const repo = new InMemoryManifestRepository(machine);
    const fs = new InMemoryFileAdapter();
    const path = join(homedir(), ".cursor/plugins/local/sample-plugin/plugin.json");
    fs.setFile(path, "owned bytes");
    const remove = userPluginRemover({
      fs,
      marketplaceRegistry: new FakeMarketplaceRegistry(),
      userManifestRepo: repo,
    });
    fs.setFile(path, "user-edited plugin.json");
    await expect(
      remove.execute({
        pluginName: "sample-plugin",
        toolIds: [TOOL.cursor],
        projectRoot: "/A",
      })
    ).rejects.toMatchObject({ code: "edited-after-install" });
    expect(fs.getFile(path)).toBe("user-edited plugin.json");
    expect(repo.getCurrent()?.getPlugins(TOOL.cursor)).toHaveLength(1);
    fs.setFile(path, "owned bytes");
    await remove.execute({
      pluginName: "sample-plugin",
      toolIds: [TOOL.cursor],
      projectRoot: "/A",
    });
    expect(fs.getFile(path)).toBeUndefined();
    expect(repo.getCurrent()?.getPlugins(TOOL.cursor)).toEqual([]);
  });

  it("keeps its canonical record and foreign bytes if a tracked file resolves outside the plugin directory", async () => {
    const relativePath = "sample-plugin/skills/demo/SKILL.md";
    const machine = aManifest()
      .withTool(TOOL.cursor, [])
      .withPlugin(
        TOOL.cursor,
        RecordedPlugin.fromJSON({
          name: "sample-plugin",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: { [relativePath]: "abc" },
          scope: "user",
          dependents: [],
        })
      )
      .build();
    const repo = new InMemoryManifestRepository(machine);
    const fs = new InMemoryFileAdapter();
    const pluginDir = join(homedir(), ".cursor/plugins/local/sample-plugin");
    const foreignPath = "/foreign/sample-plugin";
    fs.setFile(join(foreignPath, "skills/demo/SKILL.md"), "foreign bytes");
    fs.setSymlink(pluginDir, foreignPath);
    const owned = machine.getPlugins(TOOL.cursor)[0];
    expect(owned.files.size).toBe(1);
    expect(
      (
        await userScopeFilesSafeToDelete(
          { fs, logger: new CapturingLogger(), home: homeDirResolver()() },
          owned,
          registeredTools().aiProfile(TOOL.cursor)
        )
      ).size
    ).toBe(0);
    const remove = userPluginRemover({
      fs,
      marketplaceRegistry: new FakeMarketplaceRegistry(),
      userManifestRepo: repo,
    });
    await expect(
      remove.execute({
        pluginName: "sample-plugin",
        toolIds: [TOOL.cursor],
        projectRoot: "/A",
      })
    ).rejects.toThrow(/tracked file escaped its boundary/);
    expect(fs.getFile(join(foreignPath, "skills/demo/SKILL.md"))).toBe("foreign bytes");
    expect(repo.getCurrent()?.getPlugins(TOOL.cursor)).toHaveLength(1);
  });
});
