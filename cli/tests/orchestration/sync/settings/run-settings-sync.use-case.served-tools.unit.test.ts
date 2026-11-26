import { describe, expect, it, vi } from "vitest";
import type { SyncContext } from "../../../../src/contexts/installation/application/sync/load-sync-context.use-case.js";
import { RunSettingsSync } from "../../../../src/orchestration/sync/settings/run-settings-sync.use-case.js";
import { aManifest } from "../../../contexts/installation/testing/manifest.builder.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("reporting what a settings sync activated", () => {
  it("names the tools whose host took plugins through its own server beside the ones registered", async () => {
    const context: SyncContext = {
      manifest: aManifest().withTool(SYNTHETIC_TOOL, []).build(),
      records: new Map(),
      marketplaces: [],
      toolIds: [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL],
      save: async () => {},
    };
    const sync = new RunSettingsSync({
      loadContext: { execute: async () => context },
      settingsFiles: { execute: async () => false },
      activateNativeTools: {
        execute: async () => ({
          outcomes: new Map(),
          served: [SECOND_SYNTHETIC_TOOL],
          binaryMissing: [],
          warnings: [],
          errors: [],
        }),
      },
      recordActivation: { execute: vi.fn(async () => {}) },
      claims: {
        claimedRefs: () => [],
        machine: async () => new Map(),
        persistedProject: async () => new Map(),
      },
    });

    const result = await sync.execute({ projectRoot: "/project", scope: "user" });

    expect(result.activated).toEqual([SECOND_SYNTHETIC_TOOL]);
  });
});
