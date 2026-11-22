import { describe, expect, it } from "vitest";
import type { RegistrationRecordData } from "../../../../src/contexts/installation/ports/record/registration-records.js";
import { builtMarketplaceDir } from "../../../../src/shared/domain/layout/aidd-layout.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import { hostRecord } from "../../../shared/testing/host-record-reading.builder.js";
import {
  SYNTHETIC_NATIVE_TOOL,
  syntheticSyncCatalog,
} from "../../../shared/testing/synthetic-native-tool.builder.js";
import {
  FRAMEWORK_ONLY,
  MARKETPLACE,
  manifestWrites,
  ownedMachineEntry,
  PLUGIN,
  PROJECT_ROOT,
} from "../../testing/manifest-writes.builder.js";

const { build, recorded } = manifestWrites(syntheticSyncCatalog(), SYNTHETIC_NATIVE_TOOL);

describe("a marketplace the host refused is not this project's to remove", () => {
  function refusingHost(registrationState: "live" | "dead"): FakeHostActions {
    return new FakeHostActions({
      available: true,
      conflictOnAdd: true,
      registrationState,
    });
  }

  it("records no marketplace the host kept under another registration", async () => {
    const { useCase, manifestRepo } = await build({ activator: refusingHost("live") });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(hostRecord(recorded(manifestRepo))?.marketplaces).toStrictEqual([]);
  });

  it("keeps a marketplace an earlier run registered when the host now refuses it", async () => {
    const { useCase, manifestRepo } = await build({
      activator: refusingHost("live"),
      existingMachineRegistrations: ownedMachineEntry(MARKETPLACE, MARKETPLACE),
      existingRegistrations: {
        binary: SYNTHETIC_NATIVE_TOOL,
        marketplaces: [{ alias: MARKETPLACE, hostName: MARKETPLACE }],
        pluginRefs: [],
      },
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(hostRecord(recorded(manifestRepo))?.marketplaces).toStrictEqual([
      { alias: MARKETPLACE, hostName: MARKETPLACE },
    ]);
  });

  it("records no marketplace it failed to take back from a dead registration", async () => {
    const activator = new FakeHostActions({
      available: true,
      conflictOnAdd: true,
      registrationState: "dead",
      throwOnRemove: true,
    });
    const { useCase, manifestRepo } = await build({ activator });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(hostRecord(recorded(manifestRepo))?.marketplaces).toStrictEqual([]);
  });

  it("records a marketplace this run took back from a dead registration", async () => {
    const { useCase, manifestRepo } = await build({
      activator: refusingHost("dead"),
      existingMachineRegistrations: ownedMachineEntry(
        MARKETPLACE,
        MARKETPLACE,
        builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, SYNTHETIC_NATIVE_TOOL)
      ),
      hostRegisteredSource: builtMarketplaceDir(PROJECT_ROOT, MARKETPLACE, SYNTHETIC_NATIVE_TOOL),
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(hostRecord(recorded(manifestRepo))?.marketplaces).toStrictEqual(
      FRAMEWORK_ONLY.marketplaces
    );
  });
});

describe("registration changes isolated from the catalogue provenance", () => {
  it.each([
    ["binary", { ...FRAMEWORK_ONLY, binary: "old-cli" }],
    [
      "alias",
      {
        ...FRAMEWORK_ONLY,
        marketplaces: [{ ...FRAMEWORK_ONLY.marketplaces[0], alias: "old-alias" }],
      },
    ],
    [
      "host name",
      {
        ...FRAMEWORK_ONLY,
        marketplaces: [{ ...FRAMEWORK_ONLY.marketplaces[0], hostName: "old-host" }],
      },
    ],
    [
      "source",
      {
        ...FRAMEWORK_ONLY,
        marketplaces: [
          {
            alias: MARKETPLACE,
            hostName: MARKETPLACE,
            provenance: { kind: "registry", source: `/built/old/${SYNTHETIC_NATIVE_TOOL}` },
          },
        ],
      },
    ],
    ["removed ref", { ...FRAMEWORK_ONLY, pluginRefs: [`retired@${MARKETPLACE}`] }],
  ] satisfies [string, RegistrationRecordData][])(
    "persists a changed %s even when every other recorded field agrees",
    async (_field, existingRegistrations) => {
      const { useCase, manifestRepo } = await build({ existingRegistrations });

      await useCase.execute({ projectRoot: PROJECT_ROOT });

      expect(recorded(manifestRepo)).toStrictEqual(FRAMEWORK_ONLY);
      expect(manifestRepo.saves).toBe(1);
      expect(recorded(manifestRepo)).toStrictEqual(FRAMEWORK_ONLY);
    }
  );

  it("preserves clean dependents when replacing a registration", async () => {
    const pluginClaims = [{ ref: `${PLUGIN}@${MARKETPLACE}`, dependents: ["/another-project"] }];
    const { useCase, manifestRepo } = await build({
      existingRegistrations: { ...FRAMEWORK_ONLY, binary: "old-cli", pluginClaims },
    });

    await useCase.execute({ projectRoot: PROJECT_ROOT });

    expect(recorded(manifestRepo)).toStrictEqual({ ...FRAMEWORK_ONLY, pluginClaims });
    expect(manifestRepo.saves).toBe(1);
  });

  it("keeps failed-build plugin refs without claiming an unrelated suffix", async () => {
    const failed = { alias: "broken", hostName: "broken-catalog" };
    const { useCase, manifestRepo, activator } = await build({
      marketplaceNames: [MARKETPLACE, "broken"],
      failingBuilds: ["broken"],
      existingRegistrations: {
        ...FRAMEWORK_ONLY,
        marketplaces: [failed],
        pluginRefs: ["kept@broken-catalog", "retired@not-broken-catalog"],
      },
    });

    const result = await useCase.execute({
      projectRoot: PROJECT_ROOT,
    });

    expect(result.errors).toStrictEqual([]);
    expect(recorded(manifestRepo)).toStrictEqual({
      ...FRAMEWORK_ONLY,
      marketplaces: [...FRAMEWORK_ONLY.marketplaces, failed],
      pluginRefs: ["kept@broken-catalog"],
    });
    expect(activator.removedMarketplaces).toStrictEqual([]);
    expect(activator.uninstalledPlugins).toStrictEqual([]);
  });
});
