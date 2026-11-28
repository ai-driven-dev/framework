import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import type { ToolRecords } from "../../../src/contexts/installation/contract/records/scope-records.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { hostRecord } from "../../shared/testing/host-record-reading.builder.js";
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
  seedClaudeNativeRegistrations,
  seedManifestWithNativeRegistrations,
  seedMarketplaceRegistry,
} from "../testing/clean-project.builder.js";
import { HOST, hostCacheRoot, hostCatalog } from "../testing/synthetic-hosts.builder.js";

const AT_PROJECT = atProject(hostCatalog());
const CleanWithKnownHostSource = knownHostSourceCleaner(hostCatalog(), HOST);

function addUnclaimedCatalogueToCodex(records: ToolRecords): void {
  records.set(HOST.codex, {
    binary: BINARY,
    marketplaces: [
      ...(hostRecord(records.get(HOST.codex))?.marketplaces ?? []),
      {
        alias: "other",
        hostName: "other-host",
        provenance: {
          kind: "effective-list",
          root: "/some/built/path",
          sourceType: "local",
          source: "/some/built/path",
        },
      },
    ],
    pluginRefs: [REF, "unclaimed@other-host"],
  });
}

async function referencesFromProjects(
  fs: InMemoryFileAdapter,
  roots: readonly string[]
): Promise<UserSourceReferencesAdapter> {
  for (const root of roots) fs.setFile(join(root, "marker"), "project");
  const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
  for (const root of roots) await references.addReference("1.0.0", root);
  return references;
}

describe("clean: shared source machine claims", () => {
  describe("undoing a host's own native registration", () => {
    describe("machine claims survive project cleanup", () => {
      it("names shared-source dependents only on refs belonging to that source", async () => {
        const { manifest, records } = seedManifestWithNativeRegistrations(HOST);
        addUnclaimedCatalogueToCodex(records);
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const references = await referencesFromProjects(fs, [
          PROJECT_ROOT,
          "/project-b",
          "/project-c",
        ]);
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/some/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: "other",
            source: { kind: "local", path: "/some/built/path" },
            scope: "project",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        const activator = new FakeHostActions({ available: true });
        const logger = new CapturingLogger();
        const useCase = new CleanWithKnownHostSource(
          fs,
          new InMemoryManifestRepository(manifest, PROJECT_ROOT, records),
          logger,
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          registry,
          undefined,
          new Map(),
          () => "/fake-home",
          references,
          undefined,
          new InMemoryManifestRepository(Manifest.create(), "/fake-home")
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual(["other-host"]);
        expect(await references.listAllReferencingProjects()).toEqual(["/project-b", "/project-c"]);
        expect(logger.warnMessages.slice(0, 2)).toEqual([
          `${HOST.codex}: '${REF}' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean. Still needed by /project-b, /project-c.`,
          `${HOST.codex}: 'unclaimed@other-host' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean.`,
        ]);
      });

      it("keeps canonical refs and reports remaining dependents", async () => {
        const others = ["/project-b", "/project-c"];
        const suffix = " Still needed by /project-b, /project-c.";
        const { manifest, records } = seedManifestWithNativeRegistrations(HOST);
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        fs.setFile(join(PROJECT_ROOT, "marker"), "project");
        const cachePath = join(
          hostCacheRoot("codex", "/fake-home"),
          "aidd-framework",
          "plugin.json"
        );
        fs.setFile(cachePath, "cache");
        const extraRef = "another@aidd-framework";
        const machine = Manifest.create();
        machine.addTool(HOST.codex, "1.0.0", []);
        const machineRecords: ToolRecords = new Map();
        machineRecords.set(HOST.codex, {
          binary: BINARY,
          marketplaces: records.get(HOST.codex)?.marketplaces ?? [],
          pluginRefs: [REF, extraRef],
          pluginClaims: [
            { ref: REF, dependents: [PROJECT_ROOT, ...others] },
            { ref: extraRef, dependents: [PROJECT_ROOT, ...others] },
            { ref: "unrelated@other-host", dependents: ["/unrelated"] },
          ],
        });
        const machineRepo = new InMemoryManifestRepository(machine, "/fake-home", machineRecords);
        const projectRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT, records);
        const activator = new FakeHostActions({ available: true });
        const logger = new CapturingLogger();
        const hostRefs = new FakeHostPluginRegistry({
          location: "Codex machine refs",
          refs: new Map([
            [REF, { enabled: true }],
            [extraRef, { enabled: true }],
          ]),
        });
        const useCase = new CleanWithKnownHostSource(
          fs,
          projectRepo,
          logger,
          new UpdateGitignore(fs),
          new Map([[BINARY, activator]]),
          seedMarketplaceRegistry(),
          undefined,
          new Map(),
          () => "/fake-home",
          undefined,
          new Map([[HOST.codex, hostRefs]]),
          machineRepo
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(activator.removedMarketplaces).toEqual([]);
        expect(fs.getFile(cachePath)).toBe("cache");
        expect(projectRepo.getCurrent()).toBeNull();
        expect(machineRepo.records.get(HOST.codex)?.pluginClaims).toEqual([
          { ref: REF, dependents: others },
          { ref: extraRef, dependents: [PROJECT_ROOT, ...others] },
          { ref: "unrelated@other-host", dependents: ["/unrelated"] },
        ]);
        expect(logger.warnMessages).toEqual([
          `${HOST.codex}: '${REF}' is an AIDD-owned machine plugin ref — left enabled; project claim detached after local clean.${suffix}`,
          `${HOST.codex}: '${MARKETPLACE}' carries AIDD-owned machine plugin refs — left registered for explicit user-scope removal.${suffix}`,
          `${HOST.codex}: cache for '${MARKETPLACE}' left in place, its own removal was not confirmed: ${join(hostCacheRoot("codex", "/fake-home"), MARKETPLACE)}`,
        ]);
      });

      it.each([undefined, { binary: BINARY, marketplaces: [], pluginRefs: [] }])(
        "removes an empty project catalogue when the machine has no matching claims: %j",
        async (machineRegistrations) => {
          const machine = Manifest.create();
          machine.addTool(HOST.codex, "1.0.0", []);
          const machineRecords: ToolRecords = new Map();
          if (machineRegistrations !== undefined)
            machineRecords.set(HOST.codex, machineRegistrations);
          const { manifest, records } = seedManifestWithNativeRegistrations(HOST);
          const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
          const logger = new CapturingLogger();
          const activator = new FakeHostActions({ available: true });
          const useCase = new CleanWithKnownHostSource(
            fs,
            new InMemoryManifestRepository(manifest, PROJECT_ROOT, records),
            logger,
            new UpdateGitignore(fs),
            new Map([[BINARY, activator]]),
            seedMarketplaceRegistry(),
            undefined,
            new Map(),
            () => "/fake-home",
            undefined,
            undefined,
            new InMemoryManifestRepository(machine, "/fake-home", machineRecords)
          );

          await useCase.execute({ ...AT_PROJECT, force: true });

          expect(activator.removedMarketplaces).toEqual([MARKETPLACE]);
          expect(logger.warnMessages).toEqual([
            `${HOST.codex}: '${REF}' has no canonical machine claim — left enabled for manual reconciliation; project claim detached after local clean.`,
          ]);
        }
      );
    });

    describe("unproven Claude refs in a shared source", () => {
      async function sharedClaudeRegistry(): Promise<InMemoryMarketplaceRegistry> {
        const registry = new InMemoryMarketplaceRegistry();
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name: MARKETPLACE,
            source: { kind: "local", path: "/some/built/path" },
            scope: "user",
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
        return registry;
      }

      it("warns about a ref whose host catalogue was not recorded", async () => {
        const { manifest, records } = seedClaudeNativeRegistrations(HOST);
        records.set(HOST.claude, {
          binary: HOST.claude,
          marketplaces: records.get(HOST.claude)?.marketplaces ?? [],
          pluginRefs: ["orphan@unrecorded"],
        });
        const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
        const logger = new CapturingLogger();
        const activator = new FakeHostActions({ available: true });
        const useCase = new CleanWithKnownHostSource(
          fs,
          new InMemoryManifestRepository(manifest, PROJECT_ROOT, records),
          logger,
          new UpdateGitignore(fs),
          new Map([[HOST.claude, activator]]),
          await sharedClaudeRegistry()
        );

        await useCase.execute({ ...AT_PROJECT, force: true });

        expect(activator.uninstalledPlugins).toEqual([]);
        expect(logger.warnMessages[0]).toBe(
          `${HOST.claude}: 'orphan@unrecorded' has no recorded host catalogue — left enabled.`
        );
      });

      it.each([false, true])(
        "uninstalls this project's ref beside another ref on its catalogue, claimed by a machine: %s",
        async (claimed) => {
          const extraRef = "machine-plugin@aidd-framework";
          const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
          fs.setFile(join(PROJECT_ROOT, "marker"), "project");
          const machine = Manifest.create();
          machine.addTool(HOST.claude, "1.0.0", []);
          const machineRecords: ToolRecords = new Map();
          machineRecords.set(HOST.claude, {
            binary: HOST.claude,
            marketplaces: [],
            pluginRefs: [extraRef],
            pluginClaims: claimed ? [{ ref: extraRef, dependents: ["/other-project"] }] : [],
          });
          const { manifest, records } = seedClaudeNativeRegistrations(HOST);
          const hostRefs = new FakeHostPluginRegistry({
            location: "Claude refs fixture",
            refs: new Map([
              [REF, { enabled: true, scope: "project" }],
              [extraRef, { enabled: true, scope: "user" }],
            ]),
          });
          const logger = new CapturingLogger();
          const activator = new FakeHostActions({ available: true });
          const useCase = new CleanWithKnownHostSource(
            fs,
            new InMemoryManifestRepository(manifest, PROJECT_ROOT, records),
            logger,
            new UpdateGitignore(fs),
            new Map([[HOST.claude, activator]]),
            await sharedClaudeRegistry(),
            undefined,
            new Map(),
            () => "/fake-home",
            undefined,
            new Map([[HOST.claude, hostRefs]]),
            new InMemoryManifestRepository(machine, "/fake-home", machineRecords)
          );

          await useCase.execute({ ...AT_PROJECT, force: true });

          expect(activator.uninstalledPlugins).toEqual([REF]);
          expect(activator.removedMarketplaces).toEqual([]);
          expect(logger.warnMessages.some((message) => message.includes("foreign host ref"))).toBe(
            false
          );
        }
      );
    });
  });
});
