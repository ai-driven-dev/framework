import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostMarketplaceSources } from "../../contexts/host-registration/testing/fake-host-marketplace-sources.fake.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { fakeEnsureBuiltMarketplace } from "../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { hostRecord } from "../../shared/testing/host-record-reading.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { marketplaceSync } from "../../shared/testing/marketplace-sync.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { ownedNativeSettings } from "../testing/owned-native-settings.builder.js";
import { CLEAN_RUN, ROOT } from "../testing/recovery-contract.builder.js";

const firstSourceOf = (record: Parameters<typeof hostRecord>[0]) =>
  hostRecord(record)?.marketplaces[0]?.provenance;

const REAL = { tools: registeredTools(), copilot: TOOL.copilot };

describe("proven native catalogues update declarative settings only when required", () => {
  it("projects enabled refs from two distinct owned Copilot catalogues into the tracked shared settings", async () => {
    const f = await ownedNativeSettings({ ...REAL, names: ["first", "second"] });
    const result = await f.sync.execute({ projectRoot: ROOT });
    const content = await f.fs.readFile(resolve(ROOT, f.settingsPath));
    expect(result).toEqual({ activated: ["copilot"], ...CLEAN_RUN });
    expect(JSON.parse(content)).toEqual({
      permissions: { allow: ["Read"] },
      enabledPlugins: { "review-first@first-catalog": true, "review-second@second-catalog": true },
    });
    expect(f.projectRepo.getCurrent()?.getToolFiles(TOOL.copilot)[0]?.hash.value).toBe(
      FileHash.of(content).value
    );
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations(TOOL.copilot)).toEqual({
      binary: "copilot",
      marketplaces: f.registrations,
      pluginRefs: f.refs,
    });
    expect(f.activator.addedMarketplaces).toEqual([]);
    expect(f.activator.enabledPlugins).toEqual([]);
    expect(f.projectRepo.saveCount).toBe(1);
    expect(f.machineRepo.saveCount).toBe(0);
  });

  it("persists a missing declarative ref's hash even when native and machine ownership are already unchanged", async () => {
    const f = await ownedNativeSettings({ ...REAL });
    await f.sync.execute({ projectRoot: ROOT });
    const content = await f.fs.readFile(resolve(ROOT, f.settingsPath));
    expect(JSON.parse(content).enabledPlugins).toEqual({ "review-first@first-catalog": true });
    expect(f.projectRepo.getCurrent()?.getToolFiles(TOOL.copilot)[0]?.hash.value).toBe(
      FileHash.of(content).value
    );
    expect(f.projectRepo.saveCount).toBe(1);
    expect(f.machineRepo.saveCount).toBe(0);
    await f.sync.execute({ projectRoot: ROOT });
    expect(f.projectRepo.saveCount).toBe(1);
    expect(f.machineRepo.saveCount).toBe(0);
  });

  it("leaves malformed Copilot settings untouched without parsing warnings when no native refs are proven", async () => {
    const settings = "{ personalSetting: true,";
    const f = await ownedNativeSettings({ ...REAL, withPlugins: false, settings });
    const result = await f.sync.execute({ projectRoot: ROOT });
    expect(result).toEqual({ activated: ["copilot"], ...CLEAN_RUN });
    expect(await f.fs.readFile(resolve(ROOT, f.settingsPath))).toBe(settings);
    expect(f.logger.warnMessages).toEqual([]);
    expect(f.projectRepo.saveCount).toBe(0);
    expect(f.machineRepo.saveCount).toBe(0);
  });

  it("re-registers an owned Codex local source whose cached root differs from its original build path", async () => {
    const f = await ownedNativeSettings({
      ...REAL,
      toolId: TOOL.codex,
      cachedRoot: "/host/cache/copied-marketplace",
    });
    const result = await f.sync.execute({ projectRoot: ROOT });
    expect(result).toEqual({ activated: ["codex"], ...CLEAN_RUN });
    expect(f.activator.addedMarketplaces).toEqual(["/built/codex/first"]);
    expect(f.activator.removedMarketplaces).toEqual([]);
    expect(f.activator.enabledPlugins).toEqual([]);
    expect(firstSourceOf(f.projectRepo.getCurrent()?.getNativeRegistrations(TOOL.codex))).toEqual({
      kind: "effective-list",
      root: "/built/codex/first",
      sourceType: "local",
      source: "/built/codex/first",
    });
    expect(firstSourceOf(f.machineRepo.getCurrent()?.getNativeRegistrations(TOOL.codex))).toEqual({
      kind: "effective-list",
      root: "/built/codex/first",
      sourceType: "local",
      source: "/built/codex/first",
    });
    expect(f.machineRepo.saveCount).toBe(1);
  });

  it("persists a second catalogue's updated source while retaining an already identical first catalogue", async () => {
    const f = await ownedNativeSettings({
      ...REAL,
      toolId: TOOL.codex,
      names: ["first", "second"],
      cachedCatalogue: "second",
      cachedRoot: "/host/cache/second-copy",
    });
    const result = await f.sync.execute({ projectRoot: ROOT });
    expect(result.errors).toEqual([]);
    expect(f.activator.addedMarketplaces).toEqual(["/built/codex/second"]);
    const expected = f.registrations.map((registration) => ({
      ...registration,
      provenance: { ...registration.provenance, root: registration.provenance.source },
    }));
    expect(f.projectRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.marketplaces).toEqual(
      expected
    );
    expect(f.machineRepo.getCurrent()?.getNativeRegistrations(TOOL.codex)?.marketplaces).toEqual(
      expected
    );
    expect(f.projectRepo.saveCount).toBe(1);
    expect(f.machineRepo.saveCount).toBe(1);
  });
});

describe("shared framework references follow any successful native tool outcome", () => {
  it.each(["project", "user"] as const)(
    "records references according to the requested %s activation scope despite another tool's refusal",
    async (scope) => {
      const project = aManifest().withTool(TOOL.claude, []).withTool(TOOL.codex, []).build();
      const registry = new InMemoryMarketplaceRegistry();
      await registry.save(
        ROOT,
        Marketplace.create({
          name: "aidd-framework",
          source: { kind: "local", path: "/framework" },
          scope: "user",
          addedAt: "2026-09-15T00:00:00Z",
        })
      );
      const fs = new InMemoryFileAdapter(
        {
          "/built/claude/.claude-plugin/marketplace.json": JSON.stringify({
            name: "aidd-framework",
            plugins: [],
          }),
          "/built/codex/.agents/plugins/marketplace.json": JSON.stringify({
            name: "aidd-framework",
            plugins: [],
          }),
        },
        ["/real/project"]
      );
      fs.setSymlink(ROOT, "/real/project");
      const claude = new FakeHostActions({ available: true });
      const codex = new FakeHostActions({ available: true });
      const recorded: Array<{ version: string; projectRoot: string }> = [];
      const references: UserSourceReferences = {
        addReference: async (version, projectRoot) => {
          recorded.push({ version, projectRoot });
        },
        removeReference: async () => undefined,
        listAllReferencingProjects: async () => [],
      };
      const sync = marketplaceSync({
        tools: registeredTools(),
        fs,
        manifestRepo: new InMemoryManifestRepository(project),
        marketplaceRegistry: registry,
        logger: new CapturingLogger(),
        activators: new Map([
          [TOOL.claude, claude],
          [TOOL.codex, codex],
        ]),
        ensureBuilt: fakeEnsureBuiltMarketplace(),
        userSourceReferences: references,
        currentVersion: "2.0.0",
        hostPluginRegistries: new Map([
          [TOOL.claude, { read: async () => ({ location: "host plugins", refs: new Map() }) }],
          [TOOL.codex, { read: async () => ({ location: "host plugins", refs: new Map() }) }],
        ]),
        nativeSources: new Map<AiToolId, HostMarketplaceSources>([
          [
            TOOL.claude,
            new FakeHostMarketplaceSources(claude, "registry", () => "aidd-framework", new Map()),
          ],
          [
            TOOL.codex,
            {
              read: async () => ({
                location: "host sources",
                entries: new Map([["aidd-framework", null]]),
              }),
            },
          ],
        ]),
      });
      const result = await sync.execute({ projectRoot: ROOT, scope });
      expect(result.activated).toEqual(["claude", "codex"]);
      expect(result.errors).toEqual([]);
      expect(result.warnings.join(" ")).toContain("host source unproven");
      expect(claude.addedMarketplaces).toEqual(["/built/claude"]);
      expect(codex.addedMarketplaces).toEqual([]);
      expect(recorded).toEqual(
        scope === "project" ? [{ version: "2.0.0", projectRoot: "/real/project" }] : []
      );
    }
  );
});
