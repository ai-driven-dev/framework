import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { NativeHostRegistrationGate } from "../../../src/contexts/host-registration/application/native-host-registration-gate.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";
import { ALIAS, HOST, options, REF } from "../testing/user-marketplace-removal.builder.js";
import { userMarketplaceRemover } from "../testing/user-marketplace-remover.builder.js";

describe("Copilot 1.0.83 targeted user marketplace removal", () => {
  it("refuses an otherwise claimed and enabled catalogue without a verified current source, preserving settings and claims", async () => {
    const machine = Manifest.create();
    machine.addTool(TOOL.copilot, "1.0.83", []);
    machine.setNativeRegistrations(TOOL.copilot, {
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
    const activator = new FakeHostActions({ available: true });
    const gate = new NativeHostRegistrationGate(
      new Map([[TOOL.copilot, activator]]),
      new Map([
        [
          TOOL.copilot,
          {
            read: async () => ({
              location: "/host/registry",
              refs: new Map([[REF, { enabled: true, scope: "user" as const }]]),
            }),
          },
        ],
      ])
    );
    const useCase = userMarketplaceRemover(registeredTools(), fs, repo, registry, gate);

    await expect(useCase.execute(options())).rejects.toThrow(/host source reader unavailable/);

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(repo.saveCount).toBe(0);
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.copilot)?.pluginClaims).toEqual([
      { ref: REF, dependents: [] },
    ]);
    expect(repo.getCurrent()?.getNativeRegistrations(TOOL.copilot)?.marketplaces).toEqual([
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
    machine.addTool(TOOL.cursor, "1.0.0", []);
    const path = "sample-plugin/skills/demo/SKILL.md";
    if (options.claim !== false) {
      machine.addPlugin(
        TOOL.cursor,
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
    const pluginDir = join(homedir(), ".cursor/plugins/local/sample-plugin");
    const foreign = "/foreign/sample-plugin";
    fs.setFile(join(options.escape ? foreign : pluginDir, "skills/demo/SKILL.md"), "bytes");
    if (options.escape) fs.setSymlink(pluginDir, foreign);
    const useCase = userMarketplaceRemover(
      registeredTools(),
      fs,
      repo,
      registry,
      new NativeHostRegistrationGate(new Map(), new Map())
    );
    return { repo, registry, fs, useCase, path, pluginDir, foreign };
  }

  it("refuses a foreign user catalogue with no canonical plugin claim", async () => {
    const f = await fixture({ claim: false });
    await expect(f.useCase.execute(options())).rejects.toThrow(/Cannot prove AIDD ownership/);
    expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
    expect(f.repo.getCurrent()?.getPlugins(TOOL.cursor)).toEqual([]);
  });

  it("refuses B's live file claim before deleting any bytes", async () => {
    const f = await fixture({ dependents: ["/B"] });
    await expect(f.useCase.execute(options())).rejects.toThrow(saying(/active projects.*\/B/));
    expect(f.fs.getFile(join(f.pluginDir, "skills/demo/SKILL.md"))).toBe("bytes");
    expect(f.repo.getCurrent()?.getPlugins(TOOL.cursor)).toHaveLength(1);
  });

  it("refuses a symlinked plugin directory outside the user boundary", async () => {
    const f = await fixture({ escape: true });
    await expect(f.useCase.execute(options())).rejects.toThrow(/tracked file outside its boundary/);
    expect(f.fs.getFile(join(f.foreign, "skills/demo/SKILL.md"))).toBe("bytes");
    expect(f.repo.getCurrent()?.getPlugins(TOOL.cursor)).toHaveLength(1);
  });

  it("does not sweep another catalogue or a project-scoped record from the machine manifest", async () => {
    const f = await fixture();
    f.repo.getCurrent()?.addPlugin(
      TOOL.cursor,
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
      TOOL.cursor,
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
        ?.getPlugins(TOOL.cursor)
        .map((plugin) => plugin.name)
    ).toEqual(["other-plugin", "project-plugin"]);
  });

  it("deletes exactly the owned user files and canonical record", async () => {
    const f = await fixture();
    expect(await f.useCase.execute(options())).toMatchObject({ removedPluginCount: 1 });
    expect(f.fs.getFile(join(f.pluginDir, "skills/demo/SKILL.md"))).toBeUndefined();
    expect(f.repo.getCurrent()?.getPlugins(TOOL.cursor)).toEqual([]);
    expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeUndefined();
  });

  it("refuses to remove a user-edited script and leaves marketplace and machine claim retryable", async () => {
    const f = await fixture();
    const path = join(f.pluginDir, "skills/demo/SKILL.md");
    f.fs.setFile(path, "user-edited bytes");
    await expect(f.useCase.execute(options())).rejects.toThrow(/edited.*SKILL.md|SKILL.md.*edited/);
    expect(f.fs.getFile(path)).toBe("user-edited bytes");
    expect(f.repo.getCurrent()?.getPlugins(TOOL.cursor)).toHaveLength(1);
    expect((await f.registry.list("/A")).find((entry) => entry.name === ALIAS)).toBeDefined();
  });
});
