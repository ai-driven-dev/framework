import { describe, expect, it, vi } from "vitest";
import { SyncNativeActivation } from "../../../src/orchestration/sync/sync-native-activation.js";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";

const _CATALOG = catalogOf();
const OUTCOME = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [{ scope: "claude", message: "claude CLI refused" }],
  failed: true,
};

describe("SyncNativeActivation", () => {
  it("re-drives every registered marketplace when none is named, and hands back what the sync reported", async () => {
    const syncSettings = { execute: vi.fn().mockResolvedValue(OUTCOME) };

    const outcome = await new SyncNativeActivation(syncSettings).execute({
      projectRoot: "/project",
    });

    expect(syncSettings.execute).toHaveBeenCalledWith({
      projectRoot: "/project",
      marketplaceNames: undefined,
    });
    expect(outcome).toBe(OUTCOME);
  });

  it("narrows the sync to the marketplaces it is given", async () => {
    const syncSettings = { execute: vi.fn().mockResolvedValue(OUTCOME) };

    await new SyncNativeActivation(syncSettings).execute({
      projectRoot: "/project",
      marketplaceNames: ["market-b"],
    });

    expect(syncSettings.execute).toHaveBeenCalledWith({
      projectRoot: "/project",
      marketplaceNames: ["market-b"],
    });
  });
});
