import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { hostRecord } from "../../shared/testing/host-record-reading.builder.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  CACHE_WITNESS,
  CATALOG,
  canonicallyOwned,
  FOREIGN_REF,
  HOST_CATALOG_WITNESS,
  makeSync,
  PLUGIN_REF,
  PROJECT_ROOT,
} from "../testing/native-provenance.builder.js";

const RECOVERIES = [
  "recovered proof",
  "recovered proof with a shared host alias",
  "foreign source",
  "missing source",
  "foreign ref",
  "unreadable refs",
] as const;
type Recovery = (typeof RECOVERIES)[number];

/** The first read is refused; every later one answers as the named change describes. */
function sourceReaderRefusedOnce(toolId: AiToolId, change: Recovery): HostMarketplaceSources {
  let reads = 0;
  return {
    read: async () => {
      reads += 1;
      if (reads === 1)
        return { location: "host catalogue list", unreadable: "transient permissions error" };
      if (change === "missing source")
        return { location: "host catalogue list", entries: new Map() };
      const root = change === "foreign source" ? "/foreign/catalogue" : `/built/${toolId}`;
      return {
        location: "host catalogue list",
        entries: new Map([
          [CATALOG, { kind: "effective-list" as const, root, sourceType: "local", source: root }],
        ]),
      };
    },
  };
}

function pluginRegistryChangingAfterFirstRead(
  change: Recovery,
  otherRef: string
): HostPluginRegistry {
  let reads = 0;
  return {
    read: async () => {
      reads += 1;
      if (reads > 1 && change === "unreadable refs")
        return { location: "host plugin registry", unreadable: "permission denied" };
      const refs = new Map([
        [PLUGIN_REF, { enabled: true }],
        [otherRef, { enabled: true }],
      ]);
      if (reads > 1 && change === "foreign ref") refs.set(FOREIGN_REF, { enabled: true });
      return { location: "host plugin registry", refs };
    },
  };
}

function siblingRegistration(toolId: AiToolId, sharedAlias: boolean) {
  const root = sharedAlias ? `/built/${toolId}` : "/other";
  return {
    alias: "other-alias",
    hostName: sharedAlias ? CATALOG : "other-catalog",
    provenance: { kind: "effective-list" as const, root, sourceType: "local", source: root },
  };
}

type Fixture = ReturnType<typeof makeSync>;

async function addSiblingPlugin(fixture: Fixture, toolId: AiToolId, alias: string) {
  await fixture.registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: alias,
      source: { kind: "local", path: "/framework" },
      scope: "user",
      addedAt: "2026-09-15T00:00:00Z",
    })
  );
  fixture.projectRepo.getCurrent()?.addPlugin(
    toolId,
    RecordedPlugin.fromMetadata({
      name: "sibling-plugin",
      version: "1.0.0",
      source: { kind: "local", path: "/framework" },
      strict: true,
      scope: "project",
      marketplace: alias,
    })
  );
}

function expectedMachineClaims(otherRef: string, recovered: boolean) {
  return [
    { ref: otherRef, dependents: ["/B"] },
    { ref: PLUGIN_REF, dependents: recovered ? ["/B", PROJECT_ROOT] : ["/B"] },
  ];
}

function expectedProjectRefs(otherRef: string, recovered: boolean, sharedAlias: boolean) {
  const staleRef = `obsolete-plugin@${CATALOG}`;
  return recovered && !sharedAlias ? [otherRef, PLUGIN_REF] : [otherRef, PLUGIN_REF, staleRef];
}

function canonicalTarget(machine: ReturnType<typeof canonicallyOwned>, toolId: AiToolId) {
  const target = hostRecord(machine.records.get(toolId))?.marketplaces[0];
  if (target === undefined) throw new Error("fixture lacks canonical catalogue");
  return target;
}

function expectNoHostMutationExceptRefresh(f: Fixture, recovered: boolean) {
  expect(f.activator.addedMarketplaces).toEqual([]);
  expect(f.activator.removedMarketplaces).toEqual([]);
  expect(f.activator.enabledPlugins).toEqual([]);
  expect(f.activator.refreshedCatalogs).toEqual(recovered ? [CATALOG] : []);
}

describe.each([SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL] as const)(
  "%s native marketplace provenance across refused reads",
  (toolId) => {
    it.each(RECOVERIES)(
      "preserves existing projections after an initial source-read refusal followed by %s",
      async (change) => {
        const recovered = change.startsWith("recovered proof");
        const sharedAlias = change === "recovered proof with a shared host alias";
        const machine = canonicallyOwned(toolId);
        const target = canonicalTarget(machine, toolId);
        const otherRef = sharedAlias ? `sibling-plugin@${CATALOG}` : "aidd-dev@other-catalog";
        const other = siblingRegistration(toolId, sharedAlias);
        machine.records.set(toolId, {
          binary: toolId,
          marketplaces: [other, target],
          pluginRefs: [otherRef],
          pluginClaims: [
            { ref: otherRef, dependents: ["/B"] },
            { ref: PLUGIN_REF, dependents: ["/B"] },
          ],
        });
        const f = makeSync(toolId, {
          machine,
          sourceReader: sourceReaderRefusedOnce(toolId, change),
          hostReader: pluginRegistryChangingAfterFirstRead(change, otherRef),
        });
        if (sharedAlias) await addSiblingPlugin(f, toolId, other.alias);
        f.projectRepo.records.set(toolId, {
          binary: toolId,
          marketplaces: [other, target],
          pluginRefs: [otherRef, PLUGIN_REF, `obsolete-plugin@${CATALOG}`],
        });

        const result = await f.useCase.execute({
          projectRoot: PROJECT_ROOT,
          marketplaceNames: [CATALOG],
        });

        expect(result.errors).toEqual([]);
        expect(result.warnings.join(" ")).toContain("transient permissions error");
        expectNoHostMutationExceptRefresh(f, recovered);
        expect(f.projectRepo.records.get(toolId)).toEqual({
          binary: toolId,
          marketplaces: [other, target],
          pluginRefs: expectedProjectRefs(otherRef, recovered, sharedAlias),
        });
        expect(f.machineRepo.records.get(toolId)).toEqual({
          binary: toolId,
          marketplaces: [other, target],
          pluginRefs: [otherRef],
          pluginClaims: expectedMachineClaims(otherRef, recovered),
        });
        expect(f.machineRepo.saveCount).toBe(recovered ? 1 : 0);
        expect(f.fs.getFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
        expect(f.fs.getFile(HOST_CATALOG_WITNESS)).toBe(f.hostCatalogBytes);
      }
    );

    it.each(["foreign source", "unreadable source", "foreign ref", "unreadable refs"] as const)(
      "does not refresh or enable after the host changes to %s during sync",
      async (change) => {
        let sourceReads = 0;
        let registryReads = 0;
        const sourceReader: HostMarketplaceSources = {
          read: async () => {
            sourceReads += 1;
            if (sourceReads > 1 && change === "unreadable source")
              return { location: "host catalogue list", unreadable: "permission denied" };
            const root =
              sourceReads > 1 && change === "foreign source"
                ? "/someone-elses/catalogue"
                : `/built/${toolId}`;
            return {
              location: "host catalogue list",
              entries: new Map([
                [
                  CATALOG,
                  {
                    kind: "effective-list" as const,
                    root,
                    sourceType: "local",
                    source: root,
                  },
                ],
              ]),
            };
          },
        };
        const hostReader: HostPluginRegistry = {
          read: async () => {
            registryReads += 1;
            if (registryReads > 1 && change === "unreadable refs")
              return { location: "host plugin registry", unreadable: "permission denied" };
            return {
              location: "host plugin registry",
              refs: new Map(
                registryReads > 1 && change === "foreign ref"
                  ? [[FOREIGN_REF, { enabled: true }]]
                  : []
              ),
            };
          },
        };
        const fixture = makeSync(toolId, {
          machine: canonicallyOwned(toolId),
          sourceReader,
          hostReader,
        });

        await fixture.useCase.execute({ projectRoot: PROJECT_ROOT });

        expect(fixture.activator.addedMarketplaces).toEqual([]);
        expect(fixture.activator.removedMarketplaces).toEqual([]);
        expect(fixture.activator.refreshedCatalogs).toEqual([]);
        expect(fixture.activator.enabledPlugins).toEqual([]);
        expect(fixture.machineRepo.records.get(toolId)?.pluginRefs).toEqual([]);
        expect(fixture.machineRepo.records.get(toolId)?.pluginClaims ?? []).toEqual([
          { ref: PLUGIN_REF, dependents: [PROJECT_ROOT] },
        ]);
        expect(await fixture.fs.readFile(HOST_CATALOG_WITNESS)).toBe(fixture.hostCatalogBytes);
        expect(await fixture.fs.readFile(CACHE_WITNESS)).toBe("foreign bytes stay byte-for-byte");
      }
    );
  }
);
