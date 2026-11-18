import { describe, expect, it, vi } from "vitest";
import {
  type PluginRemovalClaims,
  ProjectPluginWithdrawal,
} from "../../../../../src/contexts/installation/application/removal/project-plugin-withdrawal.js";
import type { HostWithdrawal } from "../../../../../src/contexts/installation/ports/native-host.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

describe("ProjectPluginWithdrawal.canDetachRef", () => {
  it("keeps an unconfirmed ref of a machine-wide tool that no machine claim owns", async () => {
    const host: HostWithdrawal<unknown> = {
      assertProjectSource: vi.fn(),
      proveClaimedRef: vi.fn(),
      uninstallProven: vi.fn(),
      execute: vi.fn(),
    };
    const claims: PluginRemovalClaims = {
      home: "/home/someone",
      isMachineOwned: async () => false,
      guardMessage: vi.fn(),
      resolveCacheCandidate: vi.fn(),
      detachNativeRefs: vi.fn(),
      detachUserPlugin: vi.fn(),
    };
    // Cursor enables a plugin machine-wide, so only a machine claim could let its ref go.
    const cursor = registeredTools().aiProfile(TOOL.cursor);

    expect(
      await new ProjectPluginWithdrawal(host, claims).canDetachRef(
        TOOL.cursor,
        cursor,
        false,
        "aidd-dev@framework"
      )
    ).toBe(false);
  });
});
