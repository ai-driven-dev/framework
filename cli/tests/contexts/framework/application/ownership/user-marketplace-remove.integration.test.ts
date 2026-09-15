import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import type { MarketplaceRegistry } from "../../../../../src/contexts/distribution/domain/ports/marketplace-registry.js";
import { NativeHostRegistrationGate } from "../../../../../src/contexts/framework/application/ownership/native-host-registration-gate.js";
import { UserMarketplaceRemoveUseCase } from "../../../../../src/contexts/framework/application/ownership/user-marketplace-remove-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { HostPluginRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import type {
  NativeMarketplaceSource,
  NativeMarketplaceSourceReader,
} from "../../../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const ALIAS = "project-alias";
const HOST = "real-catalog";
const REF = `test-plugin@${HOST}`;
const OPTIONS = { name: ALIAS, projectRoot: "/A", autoConfirm: true, scope: "user" as const };

function proofFor(): NativeMarketplaceSource {
  return {
    kind: "effective-list",
    root: "/exact/host/root",
    sourceType: "github",
    source: "ai-driven-dev/framework",
  };
}

function sourceReader(): NativeMarketplaceSourceReader {
  return {
    read: async () => ({
      location: "/host/catalogues",
      entries: new Map([[HOST, proofFor()]]),
    }),
  };
}

for (const toolId of ["codex"] as const) {
  describe(`${toolId} targeted user marketplace removal`, () => {
    async function fixture(
      refs: ReadonlyMap<string, { enabled: boolean; scope?: "project" | "user" }>,
      options: {
        dependents?: readonly string[];
        available?: boolean;
        failOnUninstall?: boolean;
        throwOnRemove?: boolean;
      } = {}
    ) {
      const machine = Manifest.create();
      machine.addTool(toolId, "1.0.0", []);
      machine.setNativeRegistrations(toolId, {
        binary: toolId,
        marketplaces: [{ alias: ALIAS, hostName: HOST, provenance: proofFor() }],
        pluginRefs: [REF],
        pluginClaims: [{ ref: REF, dependents: [...(options.dependents ?? [])] }],
      });
      const repo = new InMemoryManifestRepository(machine);
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        "/A",
        Marketplace.create({
          name: ALIAS,
          source: { kind: "github", repo: "ai-driven-dev/framework" },
          scope: "user",
          addedAt: "2026-09-01T00:00:00.000Z",
        })
      );
      const activator = new FakeNativePluginActivator({
        available: options.available ?? true,
        failOnUninstall: options.failOnUninstall ? [REF] : [],
        throwOnRemove: options.throwOnRemove ?? false,
      });
      const reader: HostPluginRegistryReader = {
        read: async () => ({ location: "/host/registry", refs }),
      };
      const useCase = new UserMarketplaceRemoveUseCase(
        new InMemoryFileAdapter(),
        repo,
        registry,
        new NativeHostRegistrationGate(
          new Map([[toolId, activator]]),
          new Map([[toolId, reader]]),
          new Map([[toolId, sourceReader()]])
        )
      );
      return { repo, registry, activator, useCase };
    }

    const enabled = () => new Map([[REF, { enabled: true, scope: "user" as const }]]);

    it("refuses B's live claim, including with autoConfirm", async () => {
      const f = await fixture(enabled(), { dependents: ["/B"] });
      await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/active projects.*\/B/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(
        f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims?.[0]?.dependents
      ).toEqual(["/B"]);
    });

    it("never treats a project-scope catalogue with the same alias as a user-scope target", async () => {
      const f = await fixture(enabled());
      await f.registry.save(
        "/A",
        Marketplace.create({
          name: ALIAS,
          source: { kind: "github", repo: "ai-driven-dev/framework" },
          scope: "project",
          addedAt: "2026-09-02T00:00:00.000Z",
        })
      );
      await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/Marketplace.*not registered/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    });

    it("rechecks the user catalogue source after taking the machine lock", async () => {
      const f = await fixture(enabled());
      const lockedRepo = {
        path: f.repo.path,
        load: () => f.repo.load(),
        save: (manifest: Manifest) => f.repo.save(manifest),
        delete: () => f.repo.delete(),
        withExclusiveAccess: async <T>(action: () => Promise<T>): Promise<T> => {
          await f.registry.save(
            "/A",
            Marketplace.create({
              name: ALIAS,
              source: { kind: "github", repo: "foreign/changed" },
              scope: "user",
              addedAt: "2026-09-02T00:00:00.000Z",
            })
          );
          return action();
        },
      };
      const useCase = new UserMarketplaceRemoveUseCase(
        new InMemoryFileAdapter(),
        lockedRepo,
        f.registry,
        new NativeHostRegistrationGate(new Map([[toolId, f.activator]]), new Map())
      );
      await expect(useCase.execute(OPTIONS)).rejects.toThrow(
        /changed while waiting for the machine lock/
      );
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    });

    it("requires a canonical user manifest before uninstalling any host ref", async () => {
      const f = await fixture(enabled());
      const absent = new InMemoryManifestRepository();
      const useCase = new UserMarketplaceRemoveUseCase(
        new InMemoryFileAdapter(),
        absent,
        f.registry,
        new NativeHostRegistrationGate(new Map([[toolId, f.activator]]), new Map())
      );
      await expect(useCase.execute(OPTIONS)).rejects.toThrow(/no user manifest/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
    });

    it("refuses a foreign ref in the same host catalogue without mutating either ref", async () => {
      const refs = new Map([
        ...enabled(),
        [`foreign@${HOST}`, { enabled: true, scope: "user" as const }],
      ]);
      const f = await fixture(refs);
      await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(
        /foreign host ref.*foreign@real-catalog/
      );
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.activator.removedMarketplaces).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    });

    it("refuses an unreadable host registry before any host mutation", async () => {
      const f = await fixture(enabled());
      const unreadable = new NativeHostRegistrationGate(
        new Map([[toolId, f.activator]]),
        new Map([
          [
            toolId,
            { read: async () => ({ location: "/host/registry", unreadable: "permission denied" }) },
          ],
        ]),
        new Map([[toolId, sourceReader()]])
      );
      const useCase = new UserMarketplaceRemoveUseCase(
        new InMemoryFileAdapter(),
        f.repo,
        f.registry,
        unreadable
      );
      await expect(useCase.execute(OPTIONS)).rejects.toThrow(/host plugin registry unreadable/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    });

    it("refuses an unavailable host CLI", async () => {
      const f = await fixture(enabled(), { available: false });
      await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/CLI or host registry unavailable/);
      expect(f.activator.uninstalledPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    });

    it("refuses a missing or disabled owned ref", async () => {
      for (const refs of [
        new Map(),
        new Map([[REF, { enabled: false, scope: "user" as const }]]),
      ]) {
        const f = await fixture(refs);
        await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/still enabled/);
        expect(f.activator.uninstalledPlugins).toEqual([]);
        expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
          { ref: REF, dependents: [] },
        ]);
      }
    });

    it("keeps the canonical claim and registry if the host refuses unregister", async () => {
      const f = await fixture(enabled(), { failOnUninstall: true });
      await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/not installed/);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
      expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
      expect(f.activator.removedMarketplaces).toEqual([]);
    });

    it("retains the claim and catalogue record if catalogue removal fails after ref uninstall", async () => {
      const f = await fixture(enabled(), { throwOnRemove: true });
      await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/marketplace remove.*failed/);
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
      expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
    });

    it("retains the machine claim if the local catalogue registry refuses deletion", async () => {
      const f = await fixture(enabled());
      const registry: MarketplaceRegistry = {
        list: (root) => f.registry.list(root),
        save: (root, marketplace) => f.registry.save(root, marketplace),
        delete: async () => {
          throw new Error("registry delete failed");
        },
        updateLastFetched: (root, name, scope, when) =>
          f.registry.updateLastFetched(root, name, scope, when),
        updateVersion: (root, name, scope, version) =>
          f.registry.updateVersion(root, name, scope, version),
      };
      const useCase = new UserMarketplaceRemoveUseCase(
        new InMemoryFileAdapter(),
        {
          path: f.repo.path,
          load: async () => {
            const current = await f.repo.load();
            return current === null ? null : Manifest.fromJSON(current.toJSON());
          },
          save: (manifest) => f.repo.save(manifest),
          delete: () => f.repo.delete(),
        },
        registry,
        new NativeHostRegistrationGate(
          new Map([[toolId, f.activator]]),
          new Map([
            [toolId, { read: async () => ({ location: "/host/registry", refs: enabled() }) }],
          ]),
          new Map([[toolId, sourceReader()]])
        )
      );
      await expect(useCase.execute(OPTIONS)).rejects.toThrow(/registry delete failed/);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
      expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
    });

    it("unregisters the exact ref and real host catalogue after B detaches", async () => {
      const f = await fixture(enabled());
      expect(await f.useCase.execute(OPTIONS)).toMatchObject({ removedPluginCount: 1 });
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.activator.uninstalledPluginScopes).toEqual(["user"]);
      expect(f.activator.removedMarketplaces).toEqual([HOST]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
      expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeUndefined();
    });

    it("uses the host's recorded ref scope rather than guessing user for native uninstall", async () => {
      const f = await fixture(new Map([[REF, { enabled: true, scope: "project" as const }]]));
      await f.useCase.execute(OPTIONS);
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.activator.uninstalledPluginScopes).toEqual(["project"]);
      expect(f.activator.removedMarketplaces).toEqual([HOST]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([]);
    });

    it("preserves a different canonical host catalogue and its dependent ref", async () => {
      const f = await fixture(enabled());
      const current = f.repo.getCurrent();
      const registration = current?.getNativeRegistrations(toolId);
      expect(registration).toBeDefined();
      if (current === null || registration === undefined) throw new Error("fixture lacks registry");
      current.setNativeRegistrations(toolId, {
        ...registration,
        marketplaces: [
          ...registration.marketplaces,
          { alias: "other-alias", hostName: "other-catalog" },
        ],
        pluginRefs: [...registration.pluginRefs, "other-plugin@other-catalog"],
        pluginClaims: [
          ...(registration.pluginClaims ?? []),
          { ref: "other-plugin@other-catalog", dependents: ["/B"] },
        ],
      });
      expect(await f.useCase.execute(OPTIONS)).toMatchObject({ removedPluginCount: 1 });
      expect(f.activator.uninstalledPlugins).toEqual([REF]);
      expect(f.activator.removedMarketplaces).toEqual([HOST]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
        { ref: "other-plugin@other-catalog", dependents: ["/B"] },
      ]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginRefs).toEqual([
        "other-plugin@other-catalog",
      ]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.marketplaces).toEqual([
        { alias: "other-alias", hostName: "other-catalog" },
      ]);
    });
  });
}

describe("Copilot 1.0.83 targeted user marketplace removal", () => {
  it("refuses an otherwise claimed and enabled catalogue without a verified current source, preserving settings and claims", async () => {
    const machine = Manifest.create();
    machine.addTool("copilot", "1.0.83", []);
    machine.setNativeRegistrations("copilot", {
      binary: "copilot",
      marketplaces: [
        {
          alias: ALIAS,
          hostName: HOST,
          provenance: { kind: "registry", source: "/previous/aidd/source" },
        },
      ],
      pluginRefs: [REF],
      pluginClaims: [{ ref: REF, dependents: [] }],
    });
    const repo = new InMemoryManifestRepository(machine);
    const registry = new InMemoryMarketplaceRegistry();
    const marketplace = Marketplace.create({
      name: ALIAS,
      source: { kind: "github", repo: "ai-driven-dev/framework" },
      scope: "user",
      addedAt: "2026-09-01T00:00:00.000Z",
    });
    await registry.save("/A", marketplace);
    const fs = new InMemoryFileAdapter();
    fs.setFile("/A/copilot-user-note.md", "user bytes");
    const activator = new FakeNativePluginActivator({ available: true });
    const gate = new NativeHostRegistrationGate(
      new Map([["copilot", activator]]),
      new Map([
        [
          "copilot",
          {
            read: async () => ({
              location: "/host/registry",
              refs: new Map([[REF, { enabled: true, scope: "user" as const }]]),
            }),
          },
        ],
      ])
    );
    const useCase = new UserMarketplaceRemoveUseCase(fs, repo, registry, gate);

    await expect(useCase.execute(OPTIONS)).rejects.toThrow(/host source reader unavailable/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(repo.saveCount).toBe(0);
    expect(repo.getCurrent()?.getNativeRegistrations("copilot")?.pluginClaims).toEqual([
      { ref: REF, dependents: [] },
    ]);
    expect(repo.getCurrent()?.getNativeRegistrations("copilot")?.marketplaces).toEqual([
      {
        alias: ALIAS,
        hostName: HOST,
        provenance: { kind: "registry", source: "/previous/aidd/source" },
      },
    ]);
    expect(await registry.list("/A")).toEqual([marketplace]);
    expect(fs.getFile("/A/copilot-user-note.md")).toBe("user bytes");
  });
});

describe("Cursor targeted user marketplace removal", () => {
  async function fixture(
    options: { claim?: boolean; dependents?: readonly string[]; escape?: boolean } = {}
  ) {
    const machine = Manifest.create();
    machine.addTool("cursor", "1.0.0", []);
    const path = "sample-plugin/skills/demo/SKILL.md";
    if (options.claim !== false) {
      machine.addPlugin(
        "cursor",
        InstalledPlugin.fromJSON({
          name: "sample-plugin",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: { [path]: createHash("md5").update("bytes").digest("hex") },
          scope: "user",
          marketplace: ALIAS,
          dependents: [...(options.dependents ?? [])],
        })
      );
    }
    const repo = new InMemoryManifestRepository(machine);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      "/A",
      Marketplace.create({
        name: ALIAS,
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        scope: "user",
        addedAt: "2026-09-01T00:00:00.000Z",
      })
    );
    const fs = new InMemoryFileAdapter();
    const pluginDir = join(homedir(), ".cursor/plugins/local/sample-plugin");
    const foreign = "/foreign/sample-plugin";
    fs.setFile(join(options.escape ? foreign : pluginDir, "skills/demo/SKILL.md"), "bytes");
    if (options.escape) fs.setSymlink(pluginDir, foreign);
    const useCase = new UserMarketplaceRemoveUseCase(
      fs,
      repo,
      registry,
      new NativeHostRegistrationGate(new Map(), new Map())
    );
    return { repo, registry, fs, useCase, path, pluginDir, foreign };
  }

  it("refuses a foreign user catalogue with no canonical plugin claim", async () => {
    const f = await fixture({ claim: false });
    await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/Cannot prove AIDD ownership/);
    expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
    expect(f.repo.getCurrent()?.getPlugins("cursor")).toEqual([]);
  });

  it("refuses B's live file claim before deleting any bytes", async () => {
    const f = await fixture({ dependents: ["/B"] });
    await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/active projects.*\/B/);
    expect(f.fs.getFile(join(f.pluginDir, "skills/demo/SKILL.md"))).toBe("bytes");
    expect(f.repo.getCurrent()?.getPlugins("cursor")).toHaveLength(1);
  });

  it("refuses a symlinked plugin directory outside the user boundary", async () => {
    const f = await fixture({ escape: true });
    await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/tracked file outside its boundary/);
    expect(f.fs.getFile(join(f.foreign, "skills/demo/SKILL.md"))).toBe("bytes");
    expect(f.repo.getCurrent()?.getPlugins("cursor")).toHaveLength(1);
  });

  it("does not sweep another catalogue or a project-scoped record from the machine manifest", async () => {
    const f = await fixture();
    f.repo.getCurrent()?.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "other-plugin",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: {},
        scope: "user",
        marketplace: "other-alias",
        dependents: [],
      })
    );
    f.repo.getCurrent()?.addPlugin(
      "cursor",
      InstalledPlugin.fromJSON({
        name: "project-plugin",
        source: { kind: "local", path: "/fixture" },
        version: "1.0.0",
        strict: false,
        files: {},
        scope: "project",
        marketplace: ALIAS,
        dependents: [],
      })
    );
    expect(await f.useCase.execute(OPTIONS)).toMatchObject({ removedPluginCount: 1 });
    expect(
      f.repo
        .getCurrent()
        ?.getPlugins("cursor")
        .map((plugin) => plugin.name)
    ).toEqual(["other-plugin", "project-plugin"]);
  });

  it("deletes exactly the owned user files and canonical record", async () => {
    const f = await fixture();
    expect(await f.useCase.execute(OPTIONS)).toMatchObject({ removedPluginCount: 1 });
    expect(f.fs.getFile(join(f.pluginDir, "skills/demo/SKILL.md"))).toBeUndefined();
    expect(f.repo.getCurrent()?.getPlugins("cursor")).toEqual([]);
    expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeUndefined();
  });

  it("refuses to remove a user-edited script and leaves marketplace and machine claim retryable", async () => {
    const f = await fixture();
    const path = join(f.pluginDir, "skills/demo/SKILL.md");
    f.fs.setFile(path, "user-edited bytes");
    await expect(f.useCase.execute(OPTIONS)).rejects.toThrow(/edited.*SKILL.md|SKILL.md.*edited/);
    expect(f.fs.getFile(path)).toBe("user-edited bytes");
    expect(f.repo.getCurrent()?.getPlugins("cursor")).toHaveLength(1);
    expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
  });
});
