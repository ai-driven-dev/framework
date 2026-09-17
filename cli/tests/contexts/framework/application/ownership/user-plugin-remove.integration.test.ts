import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginRemoveUseCase } from "../../../../../src/contexts/framework/application/plugin/plugin-remove-use-case.js";
import { userScopeFilesSafeToDelete } from "../../../../../src/contexts/framework/application/shared/user-scope-plugin-files.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { HostPluginRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";
import { resolveHomeDir } from "../../../../../src/kernel/reading/home-dir.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const REF = "test-plugin@real-catalog";
const OTHER = "test-plugin@other-catalog";

function sourceFor(toolId: "codex" | "copilot", catalogue: string): NativeMarketplaceSource {
  return toolId === "codex"
    ? {
        kind: "effective-list",
        root: `/host/${catalogue}`,
        sourceType: "github",
        source: `ai-driven-dev/${catalogue}`,
      }
    : { kind: "registry", source: `https://github.com/ai-driven-dev/${catalogue}.git` };
}

for (const toolId of ["codex", "copilot"] as const) {
  describe(`${toolId} targeted user plugin removal`, () => {
    function fixture(
      options: {
        refs?: readonly string[];
        dependents?: readonly string[];
        hostRefs?: ReadonlyMap<string, { enabled: boolean; scope?: "user" | "project" }>;
        available?: boolean;
        failOnUninstall?: boolean;
        sourceMismatch?: boolean;
        sourceUnavailable?: boolean;
        legacy?: boolean;
        hostRegistryUnavailable?: boolean;
        hostRegistryUnreadable?: boolean;
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
          ...(options.legacy ? {} : { provenance: sourceFor(toolId, ref.split("@")[1]) }),
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
        read: async () =>
          options.hostRegistryUnreadable
            ? { location: "/host/registry", unreadable: "invalid host registry" }
            : { location: "/host/registry", refs: hostRefs },
      };
      const sources = {
        read: async () => ({
          location: "/host/catalogues",
          entries: new Map(
            refs.map((ref) => {
              const catalogue = ref.split("@")[1];
              return [
                catalogue,
                options.sourceMismatch && ref === REF
                  ? sourceFor(toolId, "foreign-source")
                  : sourceFor(toolId, catalogue),
              ] as const;
            })
          ),
        }),
      };
      const remove = new PluginRemoveUseCase(
        fs,
        new InMemoryManifestRepository(Manifest.create()),
        new CapturingLogger(),
        new Map([[toolId, activator]]),
        options.hostRegistryUnavailable ? new Map() : new Map([[toolId, reader]]),
        undefined,
        new InMemoryMarketplaceRegistry(),
        repo,
        options.sourceUnavailable ? new Map() : new Map([[toolId, sources]])
      );
      return { machine, repo, fs, activator, remove };
    }

    const execute = (remove: PluginRemoveUseCase, pluginName: string) =>
      remove.execute({ pluginName, toolIds: [toolId], projectRoot: "/A", scope: "user" });

    it.each([{ hostRegistryUnavailable: true }, { hostRegistryUnreadable: true }])(
      "retains all ownership data when the host registry cannot be measured: %j",
      async (options) => {
        const f = fixture(options);
        const before = f.machine.toJSON();

        await expect(execute(f.remove, REF)).rejects.toThrow(/unavailable|still enabled/);

        expect(f.activator.uninstalledPlugins).toStrictEqual([]);
        expect(f.repo.saveCount).toBe(0);
        expect(f.machine.toJSON()).toStrictEqual(before);
      }
    );

    it.each(["missing", "duplicate"] as const)(
      "refuses a %s exact catalogue proof before unregistering",
      async (mode) => {
        const f = fixture();
        f.machine.setNativeRegistrations(toolId, {
          binary: toolId,
          marketplaces:
            mode === "missing"
              ? []
              : [
                  {
                    alias: "first",
                    hostName: "real-catalog",
                    provenance: sourceFor(toolId, "real-catalog"),
                  },
                  {
                    alias: "second",
                    hostName: "real-catalog",
                    provenance: sourceFor(toolId, "real-catalog"),
                  },
                ],
          pluginRefs: [REF],
          pluginClaims: [{ ref: REF, dependents: [] }],
        });
        const before = f.machine.toJSON();

        await expect(execute(f.remove, REF)).rejects.toThrow(
          /exact canonical catalogue source proof/
        );

        expect(f.activator.uninstalledPlugins).toStrictEqual([]);
        expect(f.repo.saveCount).toBe(0);
        expect(f.machine.toJSON()).toStrictEqual(before);
      }
    );

    it("reads dependents inside the repository's exclusive-access boundary", async () => {
      const f = fixture();
      let acquired = false;
      Object.assign(f.repo, {
        withExclusiveAccess: async (operation: () => Promise<void>) => {
          acquired = true;
          f.machine.setNativeRegistrations(toolId, {
            binary: toolId,
            marketplaces: [
              {
                alias: "real-catalog",
                hostName: "real-catalog",
                provenance: sourceFor(toolId, "real-catalog"),
              },
            ],
            pluginRefs: [REF],
            pluginClaims: [{ ref: REF, dependents: ["/B"] }],
          });
          return operation();
        },
      });

      await expect(execute(f.remove, REF)).rejects.toThrow(/active projects.*\/B/);

      expect(acquired).toBe(true);
      expect(f.activator.uninstalledPlugins).toStrictEqual([]);
      expect(f.repo.saveCount).toBe(0);
      expect(f.machine.getNativeRegistrations(toolId)?.pluginClaims).toStrictEqual([
        { ref: REF, dependents: ["/B"] },
      ]);
    });

    it("uses user scope when the enabled host ref has no scope label", async () => {
      const f = fixture({ hostRefs: new Map([[REF, { enabled: true }]]) });

      await execute(f.remove, REF);

      expect(f.activator.uninstalledPlugins).toStrictEqual([REF]);
      expect(f.activator.uninstalledPluginScopes).toStrictEqual(["user"]);
      expect(f.machine.getNativeRegistrations(toolId)?.pluginClaims).toStrictEqual([]);
      expect(f.repo.saveCount).toBe(1);
    });

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

    it("refuses to uninstall an enabled native ref when its host catalogue source changed", async () => {
      const f = fixture({ sourceMismatch: true });
      await expect(execute(f.remove, REF)).rejects.toThrow(/source differs|source.*changed/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    });

    it("refuses no source reader and legacy unproven source instead of trusting an enabled ref", async () => {
      for (const options of [{ sourceUnavailable: true }, { legacy: true }]) {
        const f = fixture(options);
        await expect(execute(f.remove, REF)).rejects.toThrow(
          /source reader unavailable|legacy claim/
        );
        expect(f.activator.uninstalledPlugins).toEqual([]);
        expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
          { ref: REF, dependents: [] },
        ]);
      }
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
        files: {
          "sample-plugin/plugin.json": createHash("md5").update("owned bytes").digest("hex"),
        },
        scope: "user",
        dependents: [],
      })
    );
    const repo = new InMemoryManifestRepository(machine);
    const fs = new InMemoryFileAdapter();
    const path = join(homedir(), ".cursor/plugins/local/sample-plugin/plugin.json");
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
    fs.setFile(path, "user-edited plugin.json");
    await expect(
      remove.execute({
        pluginName: "sample-plugin",
        toolIds: ["cursor"],
        projectRoot: "/A",
        scope: "user",
      })
    ).rejects.toThrow(/edited.*plugin.json|plugin.json.*edited/);
    expect(fs.getFile(path)).toBe("user-edited plugin.json");
    expect(repo.getCurrent()?.getPlugins("cursor")).toHaveLength(1);
    fs.setFile(path, "owned bytes");
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
