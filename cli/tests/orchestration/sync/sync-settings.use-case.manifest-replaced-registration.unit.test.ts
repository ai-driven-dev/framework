import { describe, expect, it } from "vitest";
import { registeredAiId, registeredCatalog } from "../../shared/testing/catalog-of.builder.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { hostRecord } from "../../shared/testing/host-record-reading.builder.js";
import {
  FRAMEWORK_ONLY,
  MARKETPLACE,
  manifestWrites,
  ownedMachineEntry,
  PLUGIN,
  PROJECT_ROOT,
} from "../testing/manifest-writes.builder.js";

const { build, recorded } = manifestWrites(registeredCatalog(), registeredAiId("claude"));

describe("when a recorded registration is replaced", () => {
  it("once its marketplaces differ, same binary and same refs", async () => {
    const { useCase, manifest } = await build({
      existingRegistrations: {
        binary: "claude",
        marketplaces: [{ alias: "stale", hostName: "stale" }],
        pluginRefs: [],
      },
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(recorded(manifest)).toStrictEqual(FRAMEWORK_ONLY);
  });

  it("once a marketplace's hostName alone moved", async () => {
    const { useCase, manifest } = await build({
      existingRegistrations: {
        binary: "claude",
        marketplaces: [{ alias: MARKETPLACE, hostName: "old-host" }],
        pluginRefs: [],
      },
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(recorded(manifest)).toStrictEqual(FRAMEWORK_ONLY);
  });

  it("once a plugin ref appears where none was recorded", async () => {
    const activator = new FakeHostActions({ available: true });
    const { useCase, manifest } = await build({
      withPlugin: true,
      activator,
      existingRegistrations: FRAMEWORK_ONLY,
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(recorded(manifest)).toStrictEqual({
      ...FRAMEWORK_ONLY,
      pluginRefs: [`${PLUGIN}@${MARKETPLACE}`],
    });
  });

  it("compares every recorded marketplace, not only the first", async () => {
    const { useCase, manifest } = await build({
      marketplaceNames: ["market-a", "market-b"],
      existingRegistrations: {
        binary: "claude",
        marketplaces: [
          { alias: "market-a", hostName: "market-a" },
          { alias: "stale", hostName: "stale" },
        ],
        pluginRefs: [],
      },
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(recorded(manifest)).toStrictEqual({
      binary: "claude",
      marketplaces: [
        {
          alias: "market-a",
          hostName: "market-a",
          provenance: { kind: "registry", source: "/built/market-a/claude" },
        },
        {
          alias: "market-b",
          hostName: "market-b",
          provenance: { kind: "registry", source: "/built/market-b/claude" },
        },
      ],
      pluginRefs: [],
    });
  });

  it("records no marketplace whose build failed, this run having registered nothing for it", async () => {
    const { useCase, manifest } = await build({
      marketplaceNames: [MARKETPLACE, "broken"],
      failingBuilds: ["broken"],
      existingRegistrations: {
        binary: "claude",
        marketplaces: [{ alias: "retired", hostName: "retired-catalog" }],
        pluginRefs: [],
      },
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(hostRecord(recorded(manifest))?.marketplaces).toStrictEqual(FRAMEWORK_ONLY.marketplaces);
  });

  it("keeps a marketplace an earlier run registered when its build now fails", async () => {
    const { useCase, manifest } = await build({
      marketplaceNames: [MARKETPLACE, "broken"],
      failingBuilds: ["broken"],
      existingMachineRegistrations: ownedMachineEntry("broken", "broken-catalog"),
      existingRegistrations: {
        binary: "claude",
        marketplaces: [{ alias: "broken", hostName: "broken-catalog" }],
        pluginRefs: [],
      },
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(hostRecord(recorded(manifest))?.marketplaces).toStrictEqual([
      ...FRAMEWORK_ONLY.marketplaces,
      { alias: "broken", hostName: "broken-catalog" },
    ]);
  });
});
