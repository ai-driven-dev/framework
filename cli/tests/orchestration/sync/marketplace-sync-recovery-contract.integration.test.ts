import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FileHash } from "../../../src/shared/domain/file-hash.js";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../src/shared/domain/layout/aidd-layout.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { hostRecord } from "../../shared/testing/host-record-reading.builder.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
  syntheticNativeCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  ADD_ERROR,
  ALIAS,
  BUILT,
  CLEAN_RUN,
  HOST,
  OLD,
  RECLAIM,
  REF,
  RecoveringActivator,
  ROOT,
  recovery,
} from "../testing/recovery-contract.builder.js";

const tool = SYNTHETIC_TOOL;

const firstSourceOf = (record: Parameters<typeof hostRecord>[0]) =>
  hostRecord(record)?.marketplaces[0]?.provenance;

const REAL = { tools: syntheticNativeCatalog(tool), toolId: tool };

describe("marketplace sync recovery preserves public ownership and failure outcomes", () => {
  it.each(["project", "user"] as const)(
    "reclaims an owned dead catalogue at its marketplace's %s scope",
    async (scope) => {
      const { activator, result, manifest, logger } = await recovery({ ...REAL, scope });
      expect(activator).toBeInstanceOf(RecoveringActivator);
      if (!(activator instanceof RecoveringActivator))
        throw new Error("expected recovery activator");
      expect(activator.adds).toEqual([
        { source: BUILT, scope },
        { source: BUILT, scope },
      ]);
      expect(activator.removals).toEqual([{ name: HOST, scope, force: true }]);
      expect(activator.enabledPlugins).toEqual([REF]);
      expect(result).toEqual({
        activated: [tool],
        binaryMissing: [],
        warnings: [RECLAIM],
        errors: [],
        failed: false,
      });
      expect(logger.warnMessages).toEqual([RECLAIM]);
      expect(manifest.getNativeRegistrations(tool)).toEqual({
        binary: tool,
        marketplaces: [
          { alias: ALIAS, hostName: HOST, provenance: { kind: "registry", source: BUILT } },
        ],
        pluginRefs: [REF],
      });
    }
  );

  it("recognizes the original project path even when its directory and project root no longer resolve", async () => {
    const { activator, result } = await recovery({ ...REAL, realpathFails: [OLD, ROOT] });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.enabledPlugins).toEqual([REF]);
    expect(result.warnings).toEqual([RECLAIM]);
    expect(result.errors).toEqual([]);
  });

  it("recognizes an owned vanished user cache using the unresolved user root", async () => {
    const userRoot = "/users/alice/aidd";
    const source = userBuiltMarketplaceDir({
      userConfigDir: userRoot,
      cliVersion: "1.0.0",
      marketplaceName: ALIAS,
      target: tool,
    });
    const { activator, result } = await recovery({
      ...REAL,
      source,
      userRoot,
      realpathFails: [source, userRoot],
    });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.enabledPlugins).toEqual([REF]);
    expect(result.warnings).toEqual([RECLAIM]);
    expect(result.errors).toEqual([]);
  });

  it.each(["live", "unknown"] as const)(
    "reports the add refusal for a %s registration without force-removing it",
    async (state) => {
      const { activator, result } = await recovery({ ...REAL, state });
      expect(activator.forcedRemovals).toEqual([]);
      expect(activator.addedMarketplaces).toEqual([]);
      expect(result.warnings).toEqual([
        `Native plugin activation — register marketplace '${HOST}' skipped: marketplace is already added from a different source; remove it before adding this source`,
      ]);
      expect(result.errors).toEqual([]);
    }
  );

  it.each([
    "/foreign/cache",
    builtMarketplaceDir(ROOT, "different-marketplace", tool),
    builtMarketplaceDir(ROOT, ALIAS, SECOND_SYNTHETIC_TOOL),
    userBuiltMarketplaceDir({
      userConfigDir: "/users/alice/aidd",
      cliVersion: "1.0.0",
      marketplaceName: ALIAS,
      target: tool,
    }),
  ])(
    "refuses force removal for a source outside this catalogue's recognized cache: %s",
    async (source) => {
      const { activator, result, manifest } = await recovery({ ...REAL, source });
      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.enabledPlugins).toEqual([REF]);
      expect(result.warnings).toEqual([
        `Native plugin activation — catalogue '${HOST}' host catalogue source is unproven; host registration left untouched. ${ADD_ERROR}`,
      ]);
      expect(firstSourceOf(manifest.getNativeRegistrations(tool))).toEqual({
        kind: "registry",
        source,
      });
    }
  );

  it("keeps a failed remove recoverable and records the still-owned original source", async () => {
    const { activator, result, manifest, logger } = await recovery({ ...REAL, failure: "remove" });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(result.warnings).toEqual([
      RECLAIM,
      `Native plugin activation — unregister stale marketplace '${HOST}' skipped: remove denied`,
    ]);
    expect(logger.warnMessages).toEqual(result.warnings);
    expect(result.errors).toEqual([]);
    expect(firstSourceOf(manifest.getNativeRegistrations(tool))).toEqual({
      kind: "registry",
      source: OLD,
    });
  });

  it("reports a failed retry separately from a successful forced remove", async () => {
    const { activator, result, logger } = await recovery({ ...REAL, failure: "retry" });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result.warnings).toEqual([
      RECLAIM,
      `Native plugin activation — register marketplace '${HOST}' skipped: retry denied`,
    ]);
    expect(logger.warnMessages).toEqual(result.warnings);
    expect(result.errors).toEqual([]);
  });

  it("returns a retry crash as a hard tool error and preserves earlier manifest ownership", async () => {
    const { activator, result, manifest } = await recovery({ ...REAL, failure: "crash" });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result).toEqual({
      activated: [],
      binaryMissing: [],
      warnings: [RECLAIM],
      errors: [{ scope: tool, error: new Error("retry crashed") }],
      failed: true,
    });
    expect(firstSourceOf(manifest.getNativeRegistrations(tool))).toEqual({
      kind: "registry",
      source: OLD,
    });
  });

  it.each(["absent", "foreign"] as const)(
    "does not reclaim when the source becomes %s between the failed add and recovery",
    async (sourceAfterCollision) => {
      const { activator, result, manifest } = await recovery({ ...REAL, sourceAfterCollision });
      expect(activator.removedMarketplaces).toEqual([]);
      expect(activator.enabledPlugins).toEqual([]);
      expect(result.warnings).toEqual([
        `Native plugin activation — catalogue '${HOST}' collides with unproven AIDD ownership; host registration left untouched. ${ADD_ERROR}`,
      ]);
      expect(manifest.getNativeRegistrations(tool)?.marketplaces).toEqual([
        { alias: ALIAS, hostName: HOST, provenance: { kind: "registry", source: OLD } },
      ]);
      expect(result.errors).toEqual([]);
    }
  );

  it("reports the foreign plugin that appeared after add failed and leaves the host untouched", async () => {
    const foreign = `other@${HOST}`;
    const { activator, result } = await recovery({
      ...REAL,
      plugins: [
        { location: "host plugins", refs: new Map() },
        { location: "host plugins", refs: new Map([[foreign, { enabled: true }]]) },
      ],
    });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(result.warnings).toEqual([
      `Native plugin activation — catalogue '${HOST}' collides with unproven AIDD ownership and foreign ref '${foreign}'; host registration left untouched. ${ADD_ERROR}`,
    ]);
    expect(result.errors).toEqual([]);
  });

  it("refuses recovery when the host marketplace registry disappears after the failed add", async () => {
    const owned = { location: "host marketplaces", entries: new Map([[HOST, OLD]]) };
    const { activator, result } = await recovery({
      ...REAL,
      host: new FakeHostMarketplaceRegistry(owned, owned, {
        location: "host marketplaces",
        absent: true,
      }),
    });
    expect(activator.removedMarketplaces).toEqual([]);
    expect(result.warnings).toEqual([
      `Native plugin activation — catalogue '${HOST}' host catalogue source is unproven; host registration left untouched. ${ADD_ERROR}`,
    ]);
    expect(result.errors).toEqual([]);
  });

  it("preserves an enabled project-owned ref without a machine manifest or another install", async () => {
    const { activator, result, manifest } = await recovery({
      ...REAL,
      ownRefs: [REF],
      plugins: [{ location: "host plugins", refs: new Map([[REF, { enabled: true }]]) }],
    });
    expect(activator.removedMarketplaces).toEqual([HOST]);
    expect(activator.enabledPlugins).toEqual([]);
    expect(manifest.getNativeRegistrations(tool)?.pluginRefs).toEqual([REF]);
    expect(result.errors).toEqual([]);
  });

  it("does not resave the manifest after a repeated sync produces identical native ownership and settings", async () => {
    const { activator, result, useCase, repo, fs, manifest } = await recovery({
      ...REAL,
      settings: JSON.stringify({
        enabledPlugins: { [`review@${ALIAS}`]: true },
        permissions: { allow: ["Read"] },
      }),
    });
    expect(result.errors).toEqual([]);
    const saveCount = repo.saveCount;
    const second = await useCase.execute({ projectRoot: ROOT });
    expect(second).toEqual({ activated: [tool], ...CLEAN_RUN });
    expect(repo.saveCount).toBe(saveCount);
    expect(activator.addedMarketplaces).toEqual([BUILT]);
    expect(manifest.getToolFiles(tool)[0]?.hash.value).toBe(
      FileHash.of(await fs.readFile(resolve(ROOT, `.${tool}/settings.json`))).value
    );
  });

  it.each(["null", "[]", "false", '"user value"'])(
    "rebuilds managed settings from a JSON root that is not a settings object: %s",
    async (settings) => {
      const { fs, manifest, result, logger } = await recovery({ ...REAL, settings });
      const content = await fs.readFile(resolve(ROOT, `.${tool}/settings.json`));
      expect(JSON.parse(content)).toEqual({ enabledPlugins: { [`review@${ALIAS}`]: true } });
      expect(manifest.getToolFiles(tool)[0]?.hash.value).toBe(FileHash.of(content).value);
      expect(logger.warnMessages).toEqual([RECLAIM]);
      expect(result.errors).toEqual([]);
    }
  );

  it("evicts only the obsolete marketplace key from otherwise empty managed settings", async () => {
    const { fs, manifest, result } = await recovery({
      ...REAL,
      settings: JSON.stringify({
        extraKnownMarketplaces: {},
        permissions: { allow: ["Read"] },
        enabledPlugins: { [`review@${ALIAS}`]: false, "personal@external": true },
      }),
    });
    const content = await fs.readFile(resolve(ROOT, `.${tool}/settings.json`));
    expect(JSON.parse(content)).toEqual({
      permissions: { allow: ["Read"] },
      enabledPlugins: { [`review@${ALIAS}`]: false, "personal@external": true },
    });
    expect(manifest.getToolFiles(tool)[0]?.hash.value).toBe(FileHash.of(content).value);
    expect(result.errors).toEqual([]);
  });
});
