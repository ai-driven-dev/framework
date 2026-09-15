import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginRemoveUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { userScopeFilesSafeToDelete } from "../../../../../src/contexts/framework/application/shared/user-scope-plugin-files.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { HostPluginRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import { resolveHomeDir } from "../../../../../src/kernel/reading/home-dir.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const REF = "test-plugin@real-catalog";
const OTHER = "test-plugin@other-catalog";

for (const toolId of ["codex", "copilot"] as const) {
  describe(`${toolId} targeted user plugin removal`, () => {
    function fixture(
      options: {
        refs?: readonly string[];
        dependents?: readonly string[];
        hostRefs?: ReadonlyMap<string, { enabled: boolean; scope?: "user" | "project" }>;
        available?: boolean;
        failOnUninstall?: boolean;
      } = {}
    ) {
      const refs = options.refs ?? [REF];
      const machine = Manifest.create();
      machine.addTool(toolId, "1.0.0", []);
      machine.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: refs.map((ref) => ({
          alias: ref.split("@")[1],
          hostName: ref.split("@")[1],
        })),
        pluginRefs: [...refs],
        pluginClaims: refs.map((ref) => ({ ref, dependents: [...(options.dependents ?? [])] })),
      });
      const repo = new InMemoryManifestRepository(machine);
      const fs = new InMemoryFileAdapter();
      const activator = new FakeNativePluginActivator({
        available: options.available ?? true,
        failOnUninstall: options.failOnUninstall ? [REF] : [],
      });
      const hostRefs =
        options.hostRefs ??
        new Map(refs.map((ref) => [ref, { enabled: true, scope: "user" as const }]));
      const reader: HostPluginRegistryReader = {
        read: async () => ({ location: "/host/registry", refs: hostRefs }),
      };
      const remove = new PluginRemoveUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        new CapturingLogger(),
        new Map([[toolId, activator]]),
        new Map([[toolId, reader]]),
        undefined,
        new InMemoryMarketplaceRegistry(),
        repo
      );
      return { repo, fs, activator, remove };
    }

    const execute = (remove: PluginRemoveUseCase, pluginName: string) =>
      remove.execute({ pluginName, toolIds: [toolId], projectRoot: "/A", scope: "user" });

    it("refuses B's live exact claim before contacting the host", async () => {
      const f = fixture({ dependents: ["/B"] });
      await expect(execute(f.remove, REF)).rejects.toThrow(/active projects.*\/B/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(
        f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims?.[0]?.dependents
      ).toEqual(["/B"]);
    });

    it("requires an exact ref when names collide across catalogues", async () => {
      const f = fixture({ refs: [REF, OTHER] });
      await expect(execute(f.remove, "test-plugin")).rejects.toThrow(/multiple catalogues.*exact/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toHaveLength(2);
    });

    it("resolves a bare native plugin name when exactly one owned catalogue matches", async () => {
      const f = fixture();
      await execute(f.remove, "test-plugin");
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual([]);
    });

    it("never adopts a foreign preexisting host ref without a canonical claim", async () => {
      const f = fixture({
        refs: [],
        hostRefs: new Map([[REF, { enabled: true, scope: "user" as const }]]),
      });
      await expect(execute(f.remove, REF)).rejects.toThrow(/not installed/i);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
    });

    it("refuses an unavailable host CLI or disabled host ref and retains the claim", async () => {
      for (const options of [
        { available: false },
        { hostRefs: new Map([[REF, { enabled: false, scope: "user" as const }]]) },
        { hostRefs: new Map([[OTHER, { enabled: true, scope: "user" as const }]]) },
      ]) {
        const f = fixture(options);
        await expect(execute(f.remove, REF)).rejects.toThrow(/unavailable|still enabled/);
        expect(f.activator.uninstalledPlugins).toEqual([]);
        expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
          { ref: REF, dependents: [] },
        ]);
      }
    });

    it("retains the machine claim if the host refuses unregister", async () => {
      const f = fixture({ failOnUninstall: true });
      await expect(execute(f.remove, REF)).rejects.toThrow(/not installed/);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    });

    it("unregisters only the exact host ref and removes only its machine projection", async () => {
      const f = fixture({ refs: [REF, OTHER] });
      await execute(f.remove, REF);
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.activator.uninstalledPluginScopes).toEqual(["user"]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: OTHER, dependents: [] },
      ]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual([OTHER]);
    });

    it("passes the host's actual project-labelled ref scope to uninstall", async () => {
      const f = fixture({
        hostRefs: new Map([[REF, { enabled: true, scope: "project" as const }]]),
      });
      await execute(f.remove, REF);
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.activator.uninstalledPluginScopes).toEqual(["project"]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
    });
  });
}

describe("Cursor user plugin boundary", () => {
  it("removes exactly an AIDD-owned file and its canonical user record", async () => {
    const machine = Manifest.create();
    machine.addTool("cursor", "1.0.0", []);
    machine.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "sample-plugin",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: { "sample-plugin/skills/demo/SKILL.md": "abc" },
        scope: "user",
        dependents: [],
      })
    );
    const repo = new InMemoryManifestRepository(machine);
    const fs = new InMemoryFileAdapter();
    const path = join(homedir(), ".cursor/plugins/local/sample-plugin/skills/demo/SKILL.md");
    fs.setFile(path, "owned bytes");
    const remove = new PluginRemoveUseCase(
      fs,
      new InMemoryManifestRepository(Manifest.create()),
      new CapturingLogger(),
      new Map(),
      new Map(),
      undefined,
      new InMemoryMarketplaceRegistry(),
      repo
    );
    await remove.execute({
      pluginName: "sample-plugin",
      toolIds: ["cursor"],
      projectRoot: "/A",
      scope: "user",
    });
    expect(fs.getFile(path)).toBeUndefined();
    expect(repo.getCurrent()?.getPlugins("cursor")).toEqual([]);
  });

  it("keeps its canonical record and foreign bytes if a tracked file resolves outside the plugin directory", async () => {
    const relativePath = "sample-plugin/skills/demo/SKILL.md";
    const machine = Manifest.create();
    machine.addTool("cursor", "1.0.0", []);
    machine.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "sample-plugin",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: { [relativePath]: "abc" },
        scope: "user",
        dependents: [],
      })
    );
    const repo = new InMemoryManifestRepository(machine);
    const fs = new InMemoryFileAdapter();
    const pluginDir = join(homedir(), ".cursor/plugins/local/sample-plugin");
    const foreignPath = "/foreign/sample-plugin";
    fs.setFile(join(foreignPath, "skills/demo/SKILL.md"), "foreign bytes");
    fs.setSymlink(pluginDir, foreignPath);
    const owned = machine.getPlugins("cursor")[0];
    expect(owned.files.size).toBe(1);
    expect(
      (
        await userScopeFilesSafeToDelete(
          fs,
          new CapturingLogger(),
          owned,
          "cursor",
          resolveHomeDir()
        )
      ).size
    ).toBe(0);
    const remove = new PluginRemoveUseCase(
      fs,
      new InMemoryManifestRepository(Manifest.create()),
      new CapturingLogger(),
      new Map(),
      new Map(),
      undefined,
      new InMemoryMarketplaceRegistry(),
      repo
    );
    await expect(
      remove.execute({
        pluginName: "sample-plugin",
        toolIds: ["cursor"],
        projectRoot: "/A",
        scope: "user",
      })
    ).rejects.toThrow(/tracked file escaped its boundary/);
    expect(fs.getFile(join(foreignPath, "skills/demo/SKILL.md"))).toBe("foreign bytes");
    expect(repo.getCurrent()?.getPlugins("cursor")).toHaveLength(1);
  });
});
