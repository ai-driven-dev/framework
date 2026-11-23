import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { RegistrationRecords } from "../../../../src/contexts/installation/ports/record/registration-records.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import { hostWithdrawal } from "../../../shared/testing/host-withdrawal.builder.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { saying } from "../../../shared/testing/saying.builder.js";
import {
  SYNTHETIC_UPDATING_NATIVE_TOOL,
  SYNTHETIC_USER_PLUGINS,
  SYNTHETIC_USER_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../../shared/testing/synthetic-native-tool.builder.js";
import { ALIAS, HOST, options, REF } from "../../testing/user-marketplace-removal.builder.js";
import { userMarketplaceRemover } from "../../testing/user-marketplace-remover.builder.js";

describe("updating native tool targeted user marketplace removal", () => {
  it("refuses an otherwise claimed and enabled catalogue without a verified current source, preserving settings and claims", async () => {
    const machine = Manifest.create();
    machine.addTool(SYNTHETIC_UPDATING_NATIVE_TOOL, "1.0.0", []);
    const records: RegistrationRecords = new Map([
      [
        SYNTHETIC_UPDATING_NATIVE_TOOL,
        {
          binary: SYNTHETIC_UPDATING_NATIVE_TOOL,
          marketplaces: [
            {
              alias: ALIAS,
              hostName: HOST,
              provenance: { kind: "registry", source: "/previous/aidd/source" },
            },
          ],
          pluginRefs: [REF],
          pluginClaims: [{ ref: REF, dependents: [] }],
        },
      ],
    ]);
    const repo = new InMemoryManifestRepository(machine, undefined, records);
    const registry = new InMemoryMarketplaceRegistry();
    const marketplace = Marketplace.create({
      name: ALIAS,
      source: { kind: "github", repo: "ai-driven-dev/framework" },
      scope: "user",
      addedAt: "2026-09-01T00:00:00.000Z",
    });
    await registry.save("/A", marketplace);
    const fs = new InMemoryFileAdapter();
    fs.setFile("/A/user-note.md", "user bytes");
    const activator = new FakeHostActions({ available: true });
    const gate = hostWithdrawal(
      new Map([[SYNTHETIC_UPDATING_NATIVE_TOOL, activator]]),
      new Map([
        [
          SYNTHETIC_UPDATING_NATIVE_TOOL,
          {
            read: async () => ({
              location: "/host/registry",
              refs: new Map([[REF, { enabled: true, scope: "user" as const }]]),
            }),
          },
        ],
      ])
    );
    const useCase = userMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      fs,
      repo,
      registry,
      gate
    );

    await expect(useCase.execute(options())).rejects.toThrow(/host source reader unavailable/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(repo.saveCount).toBe(0);
    expect(repo.recordSaveCount).toBe(0);
    expect(repo.records.get(SYNTHETIC_UPDATING_NATIVE_TOOL)?.pluginClaims).toEqual([
      { ref: REF, dependents: [] },
    ]);
    expect(repo.records.get(SYNTHETIC_UPDATING_NATIVE_TOOL)?.marketplaces).toEqual([
      {
        alias: ALIAS,
        hostName: HOST,
        provenance: { kind: "registry", source: "/previous/aidd/source" },
      },
    ]);
    expect(await registry.list("/A")).toEqual([marketplace]);
    expect(fs.getFile("/A/user-note.md")).toBe("user bytes");
  });
});

describe("user-scope tool targeted user marketplace removal", () => {
  async function fixture(
    options: { claim?: boolean; dependents?: readonly string[]; escape?: boolean } = {}
  ) {
    const machine = Manifest.create();
    machine.addTool(SYNTHETIC_USER_TOOL, "1.0.0", []);
    const path = "sample-plugin/skills/demo/SKILL.md";
    if (options.claim !== false) {
      machine.addPlugin(
        SYNTHETIC_USER_TOOL,
        RecordedPlugin.fromJSON({
          name: "sample-plugin",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: { [path]: FileHash.of("bytes").value },
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
    const pluginDir = join(SYNTHETIC_USER_PLUGINS(homedir()), "sample-plugin");
    const foreign = "/foreign/sample-plugin";
    fs.setFile(join(options.escape ? foreign : pluginDir, "skills/demo/SKILL.md"), "bytes");
    if (options.escape) fs.setSymlink(pluginDir, foreign);
    const useCase = userMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      fs,
      repo,
      registry,
      hostWithdrawal(new Map(), new Map())
    );
    return { repo, registry, fs, useCase, path, pluginDir, foreign };
  }

  it("refuses a foreign user catalogue with no canonical plugin claim", async () => {
    const f = await fixture({ claim: false });
    await expect(f.useCase.execute(options())).rejects.toThrow(/Cannot prove AIDD ownership/);
    expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
    expect(f.repo.getCurrent()?.getPlugins(SYNTHETIC_USER_TOOL)).toEqual([]);
  });

  it("refuses B's live file claim before deleting any bytes", async () => {
    const f = await fixture({ dependents: ["/B"] });
    await expect(f.useCase.execute(options())).rejects.toThrow(saying(/active projects.*\/B/));
    expect(f.fs.getFile(join(f.pluginDir, "skills/demo/SKILL.md"))).toBe("bytes");
    expect(f.repo.getCurrent()?.getPlugins(SYNTHETIC_USER_TOOL)).toHaveLength(1);
  });

  it("refuses a symlinked plugin directory outside the user boundary", async () => {
    const f = await fixture({ escape: true });
    await expect(f.useCase.execute(options())).rejects.toThrow(/tracked file outside its boundary/);
    expect(f.fs.getFile(join(f.foreign, "skills/demo/SKILL.md"))).toBe("bytes");
    expect(f.repo.getCurrent()?.getPlugins(SYNTHETIC_USER_TOOL)).toHaveLength(1);
  });

  it("does not sweep another catalogue or a project-scoped record from the machine manifest", async () => {
    const f = await fixture();
    f.repo.getCurrent()?.addPlugin(
      SYNTHETIC_USER_TOOL,
      RecordedPlugin.fromJSON({
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
      SYNTHETIC_USER_TOOL,
      RecordedPlugin.fromJSON({
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
    expect(await f.useCase.execute(options())).toMatchObject({ removedPluginCount: 1 });
    expect(
      f.repo
        .getCurrent()
        ?.getPlugins(SYNTHETIC_USER_TOOL)
        .map((plugin) => plugin.name)
    ).toEqual(["other-plugin", "project-plugin"]);
  });

  it("deletes exactly the owned user files and canonical record", async () => {
    const f = await fixture();
    expect(await f.useCase.execute(options())).toMatchObject({ removedPluginCount: 1 });
    expect(f.fs.getFile(join(f.pluginDir, "skills/demo/SKILL.md"))).toBeUndefined();
    expect(f.repo.getCurrent()?.getPlugins(SYNTHETIC_USER_TOOL)).toEqual([]);
    expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeUndefined();
  });

  it("refuses to remove a user-edited script and leaves marketplace and machine claim retryable", async () => {
    const f = await fixture();
    const path = join(f.pluginDir, "skills/demo/SKILL.md");
    f.fs.setFile(path, "user-edited bytes");
    await expect(f.useCase.execute(options())).rejects.toMatchObject({
      code: "edited-after-install",
    });
    expect(f.fs.getFile(path)).toBe("user-edited bytes");
    expect(f.repo.getCurrent()?.getPlugins(SYNTHETIC_USER_TOOL)).toHaveLength(1);
    expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
  });
});
