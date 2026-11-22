import { describe, expect, it, vi } from "vitest";
import type { SyncSettingsResult } from "../../../../src/orchestration/domain/sync-settings.model.js";
import { SyncSettings } from "../../../../src/orchestration/sync/settings/sync-settings.use-case.js";
import type { Lock } from "../../../../src/shared/ports/lock.js";

const RESULT: SyncSettingsResult = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [],
  failed: false,
};

function machineManifest(): Lock & { locked: number } {
  return {
    locked: 0,
    async withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
      this.locked++;
      return action();
    },
  };
}

const run = () => ({ execute: vi.fn(async () => RESULT) });

describe("running a settings sync under the machine manifest's lock", () => {
  it("holds the machine manifest's lock for a project-scope run", async () => {
    const lock = machineManifest();

    expect(await new SyncSettings(run(), lock).execute({ projectRoot: "/p" })).toBe(RESULT);
    expect(lock.locked).toBe(1);
  });

  it("does not lock again for a user-scope run, which already works on that manifest", async () => {
    const lock = machineManifest();

    await new SyncSettings(run(), lock).execute({ projectRoot: "/p", scope: "user" });

    expect(lock.locked).toBe(0);
  });

  it("runs unlocked when no machine manifest is kept", async () => {
    expect(await new SyncSettings(run(), undefined).execute({ projectRoot: "/p" })).toBe(RESULT);
  });
});
