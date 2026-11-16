import { describe, expect, it, vi } from "vitest";
import { SyncNativeActivation } from "../../../src/orchestration/sync/sync-native-activation.js";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";

const CATALOG = catalogOf();
const OUTCOME = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [{ scope: "claude", message: "claude CLI refused" }],
};

describe("SyncNativeActivation", () => {
  it("re-drives every registered marketplace when none is named, and hands back what the sync reported", async () => {
    const syncSettings = { execute: vi.fn().mockResolvedValue(OUTCOME) };

    const outcome = await new SyncNativeActivation(syncSettings).execute({
      projectRoot: "/project",
      tools: CATALOG,
    });

    expect(syncSettings.execute).toHaveBeenCalledWith({
      projectRoot: "/project",
      tools: CATALOG,
      marketplaceNames: undefined,
    });
    expect(outcome).toEqual({ ...OUTCOME, failed: true });
  });

  it("reports the activation as not failed when the sync raised no error", async () => {
    const clean = { ...OUTCOME, activated: ["claude"], errors: [] };
    const syncSettings = { execute: vi.fn().mockResolvedValue(clean) };

    const outcome = await new SyncNativeActivation(syncSettings).execute({
      projectRoot: "/project",
      tools: CATALOG,
    });

    expect(outcome.failed).toBe(false);
  });

  it("narrows the sync to the marketplaces it is given", async () => {
    const syncSettings = { execute: vi.fn().mockResolvedValue(OUTCOME) };

    await new SyncNativeActivation(syncSettings).execute({
      projectRoot: "/project",
      tools: CATALOG,
      marketplaceNames: ["market-b"],
    });

    expect(syncSettings.execute).toHaveBeenCalledWith({
      projectRoot: "/project",
      tools: CATALOG,
      marketplaceNames: ["market-b"],
    });
  });
});
