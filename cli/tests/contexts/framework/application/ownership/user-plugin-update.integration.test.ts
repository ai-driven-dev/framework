import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { describe, expect, it } from "vitest";
import { NativeHostRegistrationGate } from "../../../../../src/contexts/framework/application/ownership/native-host-registration-gate.js";
import { UserPluginDistributionLoader } from "../../../../../src/contexts/framework/application/ownership/user-plugin-distribution-loader.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { UserPluginUpdateUseCase } from "../../../../../src/contexts/framework/application/ownership/user-plugin-update-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistributionReaderAdapter } from "../../../../../src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.js";
import type { HostPluginRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { FakeNativePluginActivator } from "../../../../helpers/ports/fake-native-plugin-activator.js";
import { FixturePluginFetcher } from "../../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";

const REF = "test-plugin@real-catalog";
const OTHER = "test-plugin@other-catalog";

function fixture(
  toolId: "codex" | "copilot",
  options: {
    refs?: readonly string[];
    dependents?: readonly string[];
    available?: boolean;
    hostRefs?: ReadonlyMap<string, { enabled: boolean; scope?: "project" | "user" }>;
    failOnUpdate?: boolean;
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
      provenance: { kind: "registry" as const, source: "/previous/aidd/source" },
    })),
    pluginRefs: [...refs],
    pluginClaims: refs.map((ref) => ({ ref, dependents: [...(options.dependents ?? [])] })),
  });
  const repo = new InMemoryManifestRepository(machine);
  const fs = new InMemoryFileAdapter();
  const activator = new FakeNativePluginActivator({
    available: options.available ?? true,
    failOnUpdate: options.failOnUpdate ? [REF] : [],
  });
  const hostRefs =
    options.hostRefs ??
    new Map(refs.map((ref) => [ref, { enabled: true, scope: "user" as const }]));
  const reader: HostPluginRegistryReader = {
    read: async () => ({ location: "/host/registry", refs: hostRefs }),
  };
  const logger = new CapturingLogger();
  const update = new UserPluginUpdateUseCase(
    repo,
    new UserPluginFileUpdater(
      fs,
      new UserPluginDistributionLoader(
        new FixturePluginFetcher(),
        new PluginDistributionReaderAdapter(fs)
      ),
      new DeterministicHasher()
    ),
    logger,
    new NativeHostRegistrationGate(new Map([[toolId, activator]]), new Map([[toolId, reader]]))
  );
  const execute = (pluginName: string | readonly string[]) =>
    update.execute({
      pluginNames: typeof pluginName === "string" ? [pluginName] : [...pluginName],
      toolIds: [toolId],
      projectRoot: "/A",
      scope: "user",
    });
  const executeAll = () => update.execute({ toolIds: [toolId], projectRoot: "/A", scope: "user" });
  return { repo, activator, logger, execute, executeAll };
}

describe("targeted machine native plugin update", () => {
  it("Copilot retains exact AIDD claims when its installed binary cannot prove the source", async () => {
    const f = fixture("copilot", { refs: [REF, OTHER], dependents: ["/A", "/B"] });
    await expect(f.execute(REF)).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.getCurrent()?.getNativeRegistrations("copilot")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
      { ref: OTHER, dependents: ["/A", "/B"] },
    ]);
    expect(f.repo.saveCount).toBe(0);
  });

  it("refuses ambiguous catalogue names before updating any ref", async () => {
    const f = fixture("copilot", { refs: [REF, OTHER] });
    await expect(f.execute("test-plugin")).rejects.toThrow(/Multiple native catalogues.*exact/);
    expect(f.activator.updatedPlugins).toEqual([]);
  });

  it("resolves a bare native plugin name but refuses update without current source proof", async () => {
    const f = fixture("copilot", { refs: [REF], dependents: ["/B"] });
    await expect(f.execute("test-plugin")).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.getCurrent()?.getNativeRegistrations("copilot")?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/B"] },
    ]);
  });

  it("does not adopt a foreign enabled host ref without a machine claim", async () => {
    const f = fixture("copilot", { refs: [], hostRefs: new Map([[REF, { enabled: true }]]) });
    await expect(f.execute(REF)).rejects.toThrow(/not installed/);
    expect(f.activator.updatedPlugins).toEqual([]);
  });

  it("all-target update is a no-op when this machine owns no plugins or native refs", async () => {
    const f = fixture("copilot", { refs: [] });
    expect(await f.executeAll()).toEqual([]);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.saveCount).toBe(0);
  });

  it("refuses an unavailable CLI or disabled host ref, retaining canonical claims", async () => {
    for (const options of [
      { available: false },
      { hostRefs: new Map([[REF, { enabled: false }]]) },
    ]) {
      const f = fixture("copilot", options);
      await expect(f.execute(REF)).rejects.toThrow(
        /CLI and readable host registry|not provably enabled/
      );
      expect(f.activator.updatedPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations("copilot")?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    }
  });

  it("Codex refuses targeted update because its verified binary has no update verb", async () => {
    const f = fixture("codex");
    await expect(f.execute(REF)).rejects.toThrow(/does not support targeted native plugin update/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.getCurrent()?.getNativeRegistrations("codex")?.pluginClaims).toEqual([
      { ref: REF, dependents: [] },
    ]);
  });

  it("does not touch a project-scope record when selected Copilot source is unproved", async () => {
    const f = fixture("copilot", { refs: [REF, OTHER] });
    const machine = f.repo.getCurrent();
    if (machine === null) throw new Error("fixture missing machine manifest");
    machine.addPlugin(
      "copilot",
      InstalledPlugin.fromMetadata(
        "project-plugin",
        "0.0.1",
        { kind: "local", path: "/fixture" },
        false,
        "project"
      )
    );
    await expect(f.execute(REF)).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(machine.getPlugins("copilot").map((plugin) => plugin.name)).toEqual(["project-plugin"]);
  });

  it("refuses two selected Copilot refs before updating either without current source proof", async () => {
    const f = fixture("copilot", { refs: [REF, OTHER] });
    await expect(f.execute([REF, OTHER])).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
  });

  it("preflights every selected host ref before the first update", async () => {
    const f = fixture("copilot", {
      refs: [REF, OTHER],
      hostRefs: new Map([
        [REF, { enabled: true, scope: "user" }],
        [OTHER, { enabled: false, scope: "user" }],
      ]),
    });
    await expect(f.execute([REF, OTHER])).rejects.toThrow(/not provably enabled/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.saveCount).toBe(0);
  });

  it("all-target Copilot update refuses an unproved catalogue and preserves project records", async () => {
    const f = fixture("copilot");
    const machine = f.repo.getCurrent();
    if (machine === null) throw new Error("fixture missing machine manifest");
    machine.addPlugin(
      "copilot",
      InstalledPlugin.fromMetadata(
        "project-plugin",
        "0.0.1",
        { kind: "local", path: "/fixture" },
        false,
        "project"
      ).withFiles(new Map([["skills/project/SKILL.md", "hash"]]))
    );
    await expect(f.executeAll()).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(machine.getPlugins("copilot").map((plugin) => plugin.name)).toEqual(["project-plugin"]);
  });

  it("does not reach Copilot's update verb when its current source cannot be proven", async () => {
    const f = fixture("copilot", { failOnUpdate: true });
    await expect(f.execute(REF)).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.saveCount).toBe(0);
    expect(f.repo.getCurrent()?.getNativeRegistrations("copilot")?.pluginClaims).toEqual([
      { ref: REF, dependents: [] },
    ]);
  });
});
