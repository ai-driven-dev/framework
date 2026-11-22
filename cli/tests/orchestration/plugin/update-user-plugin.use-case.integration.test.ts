import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-distribution-reader-adapter.js";
import { RefreshHostPlugin } from "../../../src/contexts/host-registration/application/refresh-host-plugin.use-case.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { PluginMaterializer } from "../../../src/contexts/installation/application/plugin/plugin-materializer.js";
import { UpdateUserPluginFiles } from "../../../src/contexts/installation/application/plugin/update-user-plugin-files.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { isStrictlyWithinUserScope } from "../../../src/contexts/machine-claims/domain/user-scope-containment.js";
import { UpdateUserPlugin } from "../../../src/orchestration/plugin/update-user-plugin.use-case.js";
import { PluginDistribution } from "../../../src/shared/domain/plugin/plugin-distribution.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { fakeBuiltDeps } from "../../contexts/installation/testing/fake-build-sources.fake.js";
import { userScopeFileGuard } from "../../contexts/installation/testing/user-scope-file-guard.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { FixturePluginFetcher } from "../../shared/testing/fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { loadDistributionOf } from "../../shared/testing/load-distribution.builder.js";
import { manifestProbesOf } from "../../shared/testing/manifest-probes-of.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";

const { copilot, cursor } = TOOL;

const REF = "test-plugin@real-catalog";
const OTHER = "test-plugin@other-catalog";

function fixture(
  toolId: AiToolId,
  options: {
    refs?: readonly string[];
    dependents?: readonly string[];
    available?: boolean;
    hostRefs?: ReadonlyMap<string, { enabled: boolean; scope?: Scope }>;
    failOnUpdate?: boolean;
    installed?: RecordedPlugin;
    distribution?: PluginDistribution;
    ownsSource?: boolean;
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
  if (options.installed) machine.addPlugin(toolId, options.installed);
  const repo = new InMemoryManifestRepository(machine);
  const fs = new InMemoryFileAdapter();
  const activator = new FakeHostActions({
    available: options.available ?? true,
    failOnUpdate: options.failOnUpdate ? [REF] : [],
  });
  const hostRefs =
    options.hostRefs ??
    new Map(refs.map((ref) => [ref, { enabled: true, scope: "user" as const }]));
  const reader: HostPluginRegistry = {
    read: async () => ({ location: "/host/registry", refs: hostRefs }),
  };
  const sources: HostMarketplaceSources = {
    read: async () => ({
      location: "/host/sources",
      entries: new Map([
        [REF.split("@")[1], { kind: "registry", source: "/previous/aidd/source" }],
      ]),
    }),
  };
  const logger = new CapturingLogger();
  const distribution = options.distribution;
  const update = new UpdateUserPlugin(
    new UpdateUserPluginFiles(
      {
        repo,
        materializer: new PluginMaterializer({
          fs,
          loadDistribution: loadDistributionOf(
            new FixturePluginFetcher(),
            distribution
              ? { read: async () => distribution }
              : new PluginDistributionReaderAdapter(fs, manifestProbesOf(registeredTools()))
          ),
          guard: userScopeFileGuard,
          builtDeps: fakeBuiltDeps(fs),
        }),
        logger,
      },
      registeredTools()
    ),
    new RefreshHostPlugin(
      new Map([[toolId, activator]]),
      new Map([[toolId, reader]]),
      options.ownsSource ? new Map([[toolId, sources]]) : undefined
    ),
    isStrictlyWithinUserScope,
    registrationRecordRules
  );
  const execute = (pluginName: string | readonly string[], rebuild?: boolean) =>
    update.execute({
      pluginNames: typeof pluginName === "string" ? [pluginName] : [...pluginName],
      toolIds: [toolId],
      projectRoot: "/A",
      scope: "user",
      rebuild,
    });
  const executeAll = () =>
    update.execute({
      toolIds: [toolId],
      projectRoot: "/A",
      scope: "user",
    });
  return { repo, activator, logger, execute, executeAll };
}

function currentDistribution(version: string) {
  const skill = { relativePath: "skills/demo/SKILL.md", content: "# Skill" };
  return new PluginDistribution({
    manifest: { name: "sample-plugin", version },
    format: TOOL.claude,
    files: [skill],
    components: { commands: [], agents: [], rules: [], skills: [skill], hooks: [], mcp: [] },
  });
}

describe("targeted machine native plugin update", () => {
  it("Copilot retains exact AIDD claims when its installed binary cannot prove the source", async () => {
    const f = fixture(copilot, { refs: [REF, OTHER], dependents: ["/A", "/B"] });
    await expect(f.execute(REF)).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.getCurrent()?.getNativeRegistrations(copilot)?.pluginClaims).toEqual([
      { ref: REF, dependents: ["/A", "/B"] },
      { ref: OTHER, dependents: ["/A", "/B"] },
    ]);
    expect(f.repo.saveCount).toBe(0);
  });

  it("refuses ambiguous catalogue names before updating any ref", async () => {
    const f = fixture(copilot, { refs: [REF, OTHER] });
    await expect(f.execute("test-plugin")).rejects.toThrow(/Multiple native catalogues.*exact/);
    expect(f.activator.updatedPlugins).toEqual([]);
  });

  it.each([
    ["a bare native plugin name", [REF], "test-plugin"],
    [
      "a bare name beside another targeted plugin",
      [REF, "other-plugin@real-catalog"],
      ["test-plugin", "other-plugin"],
    ],
  ])("resolves %s but refuses update without current source proof", async (_why, refs, names) => {
    const f = fixture(copilot, { refs, dependents: ["/B"] });
    await expect(f.execute(names)).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.getCurrent()?.getNativeRegistrations(copilot)?.pluginClaims).toEqual(
      refs.map((ref) => ({ ref, dependents: ["/B"] }))
    );
  });

  it("does not adopt a foreign enabled host ref without a machine claim", async () => {
    const f = fixture(copilot, { refs: [], hostRefs: new Map([[REF, { enabled: true }]]) });
    await expect(f.execute(REF)).rejects.toThrow(saying(/not installed/));
    expect(f.activator.updatedPlugins).toEqual([]);
  });

  it("all-target update is a no-op when this machine owns no plugins or native refs", async () => {
    const f = fixture(copilot, { refs: [] });
    expect(await f.executeAll()).toEqual([]);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.saveCount).toBe(0);
  });

  it("refuses an unavailable CLI or disabled host ref, retaining canonical claims", async () => {
    for (const options of [
      { available: false },
      { hostRefs: new Map([[REF, { enabled: false }]]) },
    ]) {
      const f = fixture(copilot, options);
      await expect(f.execute(REF)).rejects.toThrow(
        /CLI and readable host registry|not provably enabled/
      );
      expect(f.activator.updatedPlugins).toEqual([]);
      expect(f.repo.getCurrent()?.getNativeRegistrations(copilot)?.pluginClaims).toEqual([
        { ref: REF, dependents: [] },
      ]);
    }
  });

  it.each([
    ["Codex, whose verified binary has no update verb", TOOL.codex],
    ["Cursor, which has no native activation at all", cursor],
  ])("refuses targeted update for %s", async (_why, toolId) => {
    const f = fixture(toolId);
    await expect(f.execute(REF)).rejects.toThrow(/does not support targeted native plugin update/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.getCurrent()?.getNativeRegistrations(toolId)?.pluginClaims).toEqual([
      { ref: REF, dependents: [] },
    ]);
  });

  it("does not touch a project-scope record when selected Copilot source is unproved", async () => {
    const f = fixture(copilot, { refs: [REF, OTHER] });
    const machine = f.repo.getCurrent();
    if (machine === null) throw new Error("fixture missing machine manifest");
    machine.addPlugin(
      copilot,
      RecordedPlugin.fromMetadata({
        name: "project-plugin",
        version: "0.0.1",
        source: { kind: "local", path: "/fixture" },
        strict: false,
        scope: "project",
      })
    );
    await expect(f.execute(REF)).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(machine.getPlugins(copilot).map((plugin) => plugin.name)).toEqual(["project-plugin"]);
  });

  it("refuses two selected Copilot refs before updating either without current source proof", async () => {
    const f = fixture(copilot, { refs: [REF, OTHER] });
    await expect(f.execute([REF, OTHER])).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
  });

  it("preflights every selected host ref before the first update", async () => {
    const f = fixture(copilot, {
      refs: [REF, OTHER],
      ownsSource: true,
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
    const f = fixture(copilot);
    const machine = f.repo.getCurrent();
    if (machine === null) throw new Error("fixture missing machine manifest");
    machine.addPlugin(
      copilot,
      RecordedPlugin.fromMetadata({
        name: "project-plugin",
        version: "0.0.1",
        source: { kind: "local", path: "/fixture" },
        strict: false,
        scope: "project",
      }).withFiles(new Map([["skills/project/SKILL.md", "hash"]]))
    );
    await expect(f.executeAll()).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(machine.getPlugins(copilot).map((plugin) => plugin.name)).toEqual(["project-plugin"]);
  });

  it("does not reach Copilot's update verb when its current source cannot be proven", async () => {
    const f = fixture(copilot, { failOnUpdate: true });
    await expect(f.execute(REF)).rejects.toThrow(/host source reader unavailable/);
    expect(f.activator.updatedPlugins).toEqual([]);
    expect(f.repo.saveCount).toBe(0);
    expect(f.repo.getCurrent()?.getNativeRegistrations(copilot)?.pluginClaims).toEqual([
      { ref: REF, dependents: [] },
    ]);
  });

  it("names the refs it cannot find when a rebuild leaves no native claim to update", async () => {
    const f = fixture(copilot);
    await expect(f.execute(REF, true)).rejects.toThrow(saying(`Plugin '${REF}' is not installed.`));
    expect(f.activator.updatedPlugins).toEqual([]);
  });

  it("rebuilds an installed user plugin that is already current, and only when asked", async () => {
    const installed = RecordedPlugin.fromMetadata({
      name: "sample-plugin",
      version: "1.0.0",
      source: { kind: "local", path: "/source" },
      strict: false,
      scope: "user",
    });
    const f = fixture(cursor, { refs: [], installed, distribution: currentDistribution("1.0.0") });
    expect(await f.execute("sample-plugin")).toEqual([]);
    expect(await f.execute("sample-plugin", true)).toEqual(["sample-plugin"]);
  });
});
