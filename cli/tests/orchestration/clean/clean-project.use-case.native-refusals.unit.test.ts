import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import type { ToolRecords } from "../../../src/contexts/installation/contract/records/scope-records.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import {
  atProject,
  BINARY,
  knownHostSourceCleaner,
  MARKETPLACE,
  PROJECT_ROOT,
  REF,
  seedManifestWithNativeRegistrations,
  seedMarketplaceRegistry,
} from "../testing/clean-project.builder.js";
import { HOST, hostCacheRoot, hostCatalog } from "../testing/synthetic-hosts.builder.js";

const AT_PROJECT = atProject(hostCatalog());
const CleanWithKnownHostSource = knownHostSourceCleaner(hostCatalog(), HOST);

describe("clean: native registration refusals", () => {
  describe("undoing a host's own native registration", () => {
    it("refuses a repointed native catalogue before shared reference or local deletion", async () => {
      const manifest = Manifest.create();
      manifest.addTool(HOST.codex, "1.0.0", []);
      const records: ToolRecords = new Map();
      records.set(HOST.codex, {
        binary: BINARY,
        marketplaces: [
          {
            alias: MARKETPLACE,
            hostName: MARKETPLACE,
            provenance: {
              kind: "effective-list",
              root: "/aidd/built",
              sourceType: "local",
              source: "/aidd/built",
            },
          },
        ],
        pluginRefs: [REF],
      });
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      fs.setFile(join(PROJECT_ROOT, "marker"), "keep");
      fs.setFile("/other-project/marker", "keep");
      const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
      await references.addReference("1.0.0", PROJECT_ROOT);
      await references.addReference("1.0.0", "/other-project");
      const activator = new FakeHostActions({ available: true });
      const sourceReader: HostMarketplaceSources = {
        read: async () => ({
          location: "fake codex host",
          entries: new Map([
            [
              MARKETPLACE,
              {
                kind: "effective-list" as const,
                root: "/foreign/built",
                sourceType: "local",
                source: "/foreign/built",
              },
            ],
          ]),
        }),
      };
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(manifest, PROJECT_ROOT, records),
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        seedMarketplaceRegistry(),
        undefined,
        new Map(),
        () => "/fake-home",
        references,
        new Map(),
        undefined,
        new Map([[HOST.codex, sourceReader]])
      );

      await expect(useCase.execute({ ...AT_PROJECT, force: true })).rejects.toThrow("differs");

      expect(await references.listAllReferencingProjects()).toContain(PROJECT_ROOT);
      expect(await references.listAllReferencingProjects()).toContain("/other-project");
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(fs.getFile(join(PROJECT_ROOT, "marker"))).toBe("keep");
    });

    it("refuses a foreign enabled ref inside an otherwise AIDD-owned catalogue", async () => {
      const manifest = Manifest.create();
      manifest.addTool(HOST.codex, "1.0.0", []);
      const records: ToolRecords = new Map();
      records.set(HOST.codex, {
        binary: BINARY,
        marketplaces: [
          {
            alias: MARKETPLACE,
            hostName: MARKETPLACE,
            provenance: {
              kind: "effective-list",
              root: "/some/built/path",
              sourceType: "local",
              source: "/some/built/path",
            },
          },
        ],
        pluginRefs: [REF],
      });
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      fs.setFile(join(PROJECT_ROOT, "marker"), "keep");
      fs.setFile("/other-project/marker", "keep");
      const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
      await references.addReference("1.0.0", PROJECT_ROOT);
      await references.addReference("1.0.0", "/other-project");
      const activator = new FakeHostActions({ available: true });
      const hostRefs = new FakeHostPluginRegistry({
        location: "fake codex plugins",
        refs: new Map([
          [REF, { enabled: true }],
          ["foreign@aidd-framework", { enabled: true }],
        ]),
      });
      const useCase = new CleanWithKnownHostSource(
        fs,
        new InMemoryManifestRepository(manifest, PROJECT_ROOT, records),
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        seedMarketplaceRegistry(),
        undefined,
        new Map(),
        () => "/fake-home",
        references,
        new Map([[HOST.codex, hostRefs]])
      );

      await expect(useCase.execute({ ...AT_PROJECT, force: true })).rejects.toThrow("foreign");

      expect(await references.listAllReferencingProjects()).toContain(PROJECT_ROOT);
      expect(await references.listAllReferencingProjects()).toContain("/other-project");
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(fs.getFile(join(PROJECT_ROOT, "marker"))).toBe("keep");
    });

    it("leaves an unclaimed machine-global ref enabled while removing its empty project catalogue", async () => {
      const { manifest, records } = seedManifestWithNativeRegistrations(HOST);
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT, records);
      const activator = new FakeHostActions({ available: true });
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        seedMarketplaceRegistry()
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([MARKETPLACE]);
      expect(manifestRepo.getCurrent()).toBeNull();
    });

    it("leaves both an unclaimed machine-global ref and its shared catalogue registered", async () => {
      const { manifest, records } = seedManifestWithNativeRegistrations(HOST);
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT, records);
      const activator = new FakeHostActions({ available: true });
      const registry = new InMemoryMarketplaceRegistry();
      registry.seed(
        PROJECT_ROOT,
        Marketplace.create({
          name: MARKETPLACE,
          source: { kind: "local", path: "/shared/built/path" },
          scope: "user",
          addedAt: "2026-01-01T00:00:00.000Z",
        })
      );
      const logger = new CapturingLogger();
      const HOME = "/fake-home";
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        logger,
        new UpdateGitignore(fs),
        new Map([[BINARY, activator]]),
        registry,
        undefined,
        new Map(),
        () => HOME
      );

      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(logger.warnMessages.join("\n")).toContain("no canonical machine claim");
      // The message must name all three survivors: the host's own registration,
      // `userConfigDir()/marketplaces.json`, and the tool's own plugin cache.
      const message = logger.warnMessages.find(
        (m) => m.includes(MARKETPLACE) && m.includes("shared by every project")
      );
      expect(message).toBeDefined();
      expect(message).toContain("userConfigDir()/marketplaces.json");
      expect(message).toContain(join(hostCacheRoot("codex", HOME), MARKETPLACE));
    });
  });
});
