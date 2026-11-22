import { describe, expect, it, vi } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-distribution-reader-adapter.js";
import { VersionMismatchError } from "../../../src/shared/domain/shared.error.js";
import { buildAddPlugin } from "../../contexts/installation/testing/build-add-plugin.builder.js";
import { fakeBuildSources } from "../../contexts/installation/testing/fake-build-sources.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { ChoosingPrompter } from "../../shared/testing/choosing-prompter.fake.js";
import { loadDistributionOf } from "../../shared/testing/load-distribution.builder.js";
import { registeredManifestProbes } from "../../shared/testing/registered-manifest-probes.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  type AddPluginFor,
  buildUseCase as buildUseCaseWith,
  EXTRA_PLUGIN_FIXTURE,
  installedSamplePlugin,
  MKT1_DIR,
  MKT2_DIR,
  PLUGIN_FIXTURE,
  PROJECT_ROOT,
  saveLocalMarketplace,
  seedMarketplaceFile,
} from "../testing/install-from-marketplace.builder.js";

const addPluginOver: AddPluginFor = (deps, registry) =>
  buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      loadDistribution: loadDistributionOf(
        deps.pluginFetcher,
        new PluginDistributionReaderAdapter(deps.fs, registeredManifestProbes())
      ),
      marketplaceRegistry: registry,
      ...fakeBuildSources(),
    },
    registeredTools()
  );

const buildUseCase = (options: Parameters<typeof buildUseCaseWith>[1] = {}) =>
  buildUseCaseWith(addPluginOver, options);

describe("InstallFromMarketplace: matches and versions", () => {
  describe("choosing among several matches", () => {
    const entryIn = (version?: string) => ({
      name: "sample-plugin",
      source: { kind: "local", path: PLUGIN_FIXTURE },
      ...(version === undefined ? {} : { version }),
    });

    it("lets an interactive user pick among the marketplaces that match", async () => {
      const prompter = new ChoosingPrompter("mkt2 — ?");
      const { useCase, deps, registry } = await buildUseCase({ prompter });
      seedMarketplaceFile(deps.fs, MKT1_DIR, [entryIn("1.0.0")]);
      seedMarketplaceFile(deps.fs, MKT2_DIR, [entryIn()]);
      await saveLocalMarketplace(registry, "mkt1", MKT1_DIR);
      await saveLocalMarketplace(registry, "mkt2", MKT2_DIR);

      const result = await useCase.execute({
        pluginName: "sample-plugin",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: true,
      });

      expect(result.marketplaceName).toBe("mkt2");
      expect(prompter.selectCalls).toStrictEqual([
        {
          message: "Multiple matches for 'sample-plugin'. Select one:",
          choiceNames: ["mkt1 — 1.0.0", "mkt2 — ?"],
        },
      ]);
    });

    it("names every matching marketplace when refusing a non-interactive install", async () => {
      const { useCase, deps, registry } = await buildUseCase();
      seedMarketplaceFile(deps.fs, MKT1_DIR, [entryIn("1.0.0")]);
      seedMarketplaceFile(deps.fs, MKT2_DIR, [entryIn("1.0.0")]);
      await saveLocalMarketplace(registry, "mkt1", MKT1_DIR);
      await saveLocalMarketplace(registry, "mkt2", MKT2_DIR);

      await expect(
        useCase.execute({
          pluginName: "sample-plugin",
          toolIds: [TOOL.claude],
          projectRoot: PROJECT_ROOT,
          interactive: false,
        })
      ).rejects.toThrow(
        expect.objectContaining({ plugin: "sample-plugin", marketplaces: ["mkt1", "mkt2"] })
      );
    });

    it("matches a catalog entry by name alone", async () => {
      const { useCase, deps, registry } = await buildUseCase();
      seedMarketplaceFile(deps.fs, MKT1_DIR, [
        { name: "extra-plugin", source: { kind: "local", path: EXTRA_PLUGIN_FIXTURE } },
        entryIn("1.0.0"),
      ]);
      await saveLocalMarketplace(registry, "mkt1", MKT1_DIR);

      const result = await useCase.execute({
        pluginName: "sample-plugin",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(result.entry.name).toBe("sample-plugin");
    });

    it("passes over a marketplace that has no catalog", async () => {
      const { useCase, deps, registry } = await buildUseCase();
      seedMarketplaceFile(deps.fs, MKT1_DIR, [entryIn("1.0.0")]);
      await saveLocalMarketplace(registry, "no-catalog", "/no-catalog");
      await saveLocalMarketplace(registry, "mkt1", MKT1_DIR);

      const result = await useCase.execute({
        pluginName: "sample-plugin",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(result.marketplaceName).toBe("mkt1");
    });
  });

  describe("version policy", () => {
    it("throws VersionMismatchError with strict policy (default) when catalog version differs from requested", async () => {
      const { useCase, deps, registry } = await buildUseCase();
      seedMarketplaceFile(deps.fs, MKT1_DIR, [
        {
          name: "sample-plugin",
          source: { kind: "local", path: PLUGIN_FIXTURE },
          version: "2.0.0",
        },
      ]);
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "mkt1",
          source: { kind: "local", path: MKT1_DIR },
          scope: "project",
          addedAt: "2026-04-29T10:00:00.000Z",
        })
      );

      await expect(
        useCase.execute({
          pluginName: "sample-plugin",
          version: "1.0.0",
          toolIds: [TOOL.claude],
          projectRoot: PROJECT_ROOT,
          interactive: false,
        })
      ).rejects.toThrow(VersionMismatchError);
    });

    it("succeeds and logs info with prefer-catalog policy when catalog version differs from requested", async () => {
      const { useCase, deps, registry } = await buildUseCase();
      const infoSpy = vi.spyOn(deps.logger, "info");
      seedMarketplaceFile(deps.fs, MKT1_DIR, [
        {
          name: "sample-plugin",
          source: { kind: "local", path: PLUGIN_FIXTURE },
          version: "2.0.0",
        },
      ]);
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "mkt1",
          source: { kind: "local", path: MKT1_DIR },
          scope: "project",
          addedAt: "2026-04-29T10:00:00.000Z",
        })
      );

      await expect(
        useCase.execute({
          pluginName: "sample-plugin",
          version: "1.0.0",
          requestedVersionPolicy: "prefer-catalog",
          toolIds: [TOOL.claude],
          projectRoot: PROJECT_ROOT,
          interactive: false,
        })
      ).resolves.toBeDefined();
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("2.0.0"));
      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("1.0.0"));
    });

    it("does not log info with prefer-catalog policy when catalog and requested versions match", async () => {
      const { useCase, deps, registry } = await buildUseCase();
      const infoSpy = vi.spyOn(deps.logger, "info");
      seedMarketplaceFile(deps.fs, MKT1_DIR, [
        {
          name: "sample-plugin",
          source: { kind: "local", path: PLUGIN_FIXTURE },
          version: "1.0.0",
        },
      ]);
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name: "mkt1",
          source: { kind: "local", path: MKT1_DIR },
          scope: "project",
          addedAt: "2026-04-29T10:00:00.000Z",
        })
      );

      await useCase.execute({
        pluginName: "sample-plugin",
        version: "1.0.0",
        requestedVersionPolicy: "prefer-catalog",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      const driftCalls = infoSpy.mock.calls.filter(
        (args) => typeof args[0] === "string" && args[0].includes("differs from")
      );
      expect(driftCalls).toHaveLength(0);
    });
  });

  describe("requested version against the catalog", () => {
    it("accepts a requested version equal to the catalog's", async () => {
      const { useCase, deps, registry } = await buildUseCase();
      seedMarketplaceFile(deps.fs, MKT1_DIR, [
        {
          name: "sample-plugin",
          source: { kind: "local", path: PLUGIN_FIXTURE },
          version: "1.0.0",
        },
      ]);
      await saveLocalMarketplace(registry, "mkt1", MKT1_DIR);

      await useCase.execute({
        pluginName: "sample-plugin",
        version: "1.0.0",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(installedSamplePlugin(deps)?.version).toBe("1.0.0");
    });

    it("logs nothing under prefer-catalog when no version was requested", async () => {
      const logger = new CapturingLogger();
      const { useCase, deps, registry } = await buildUseCase({ logger });
      seedMarketplaceFile(deps.fs, MKT1_DIR, [
        {
          name: "sample-plugin",
          source: { kind: "local", path: PLUGIN_FIXTURE },
          version: "2.0.0",
        },
      ]);
      await saveLocalMarketplace(registry, "mkt1", MKT1_DIR);

      await useCase.execute({
        pluginName: "sample-plugin",
        requestedVersionPolicy: "prefer-catalog",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(logger.allMessages).toStrictEqual([]);
    });

    it("tolerates having no logger when the catalog version differs under prefer-catalog", async () => {
      const { useCase, deps, registry } = await buildUseCase({ logger: null });
      seedMarketplaceFile(deps.fs, MKT1_DIR, [
        {
          name: "sample-plugin",
          source: { kind: "local", path: PLUGIN_FIXTURE },
          version: "2.0.0",
        },
      ]);
      await saveLocalMarketplace(registry, "mkt1", MKT1_DIR);

      await useCase.execute({
        pluginName: "sample-plugin",
        version: "1.0.0",
        requestedVersionPolicy: "prefer-catalog",
        toolIds: [TOOL.claude],
        projectRoot: PROJECT_ROOT,
        interactive: false,
      });

      expect(installedSamplePlugin(deps)?.marketplace).toBe("mkt1");
    });
  });
});
