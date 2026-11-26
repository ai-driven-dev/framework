import { describe, expect, it, vi } from "vitest";
import { SyncNativeActivation } from "../../../../src/orchestration/sync/settings/sync-native-activation.use-case.js";
import {
  SECOND_SYNTHETIC_TOOL as SERVED_TOOL,
  SYNTHETIC_TOOL,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

const OUTCOME = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [{ scope: "claude", message: "claude CLI refused" }],
  failed: true,
};

describe("syncing native activation", () => {
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

  it("brings the plugins a host's server holds up to date on the machine, for the served tools alone", async () => {
    const syncSettings = { execute: vi.fn().mockResolvedValue(OUTCOME) };

    const outcome = await new SyncNativeActivation(syncSettings, [SERVED_TOOL]).execute({
      projectRoot: "/project",
      served: "all",
    });

    expect(syncSettings.execute).toHaveBeenCalledWith({
      projectRoot: "/project",
      scope: "user",
      toolIds: [SERVED_TOOL],
    });
    expect(outcome).toBe(OUTCOME);
  });

  it("narrows to the served tools among those asked for", async () => {
    const syncSettings = { execute: vi.fn().mockResolvedValue(OUTCOME) };

    await new SyncNativeActivation(syncSettings, [SERVED_TOOL]).execute({
      projectRoot: "/project",
      served: [SYNTHETIC_TOOL, SERVED_TOOL],
    });

    expect(syncSettings.execute).toHaveBeenCalledWith(
      expect.objectContaining({ toolIds: [SERVED_TOOL] })
    );
  });

  it("does nothing when none of the tools asked for is served", async () => {
    const syncSettings = { execute: vi.fn().mockResolvedValue(OUTCOME) };

    const outcome = await new SyncNativeActivation(syncSettings, [SERVED_TOOL]).execute({
      projectRoot: "/project",
      served: [SYNTHETIC_TOOL],
    });

    expect(syncSettings.execute).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ activated: [], failed: false });
  });
});
