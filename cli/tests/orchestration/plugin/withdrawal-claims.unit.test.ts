import { describe, expect, it, vi } from "vitest";
import { withdrawalClaimsOf } from "../../../src/orchestration/plugin/withdrawal-claims.js";
import {
  SYNTHETIC_TOOL,
  syntheticCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

type PluginRemovalClaims = Parameters<typeof withdrawalClaimsOf>[0];

function machineClaims(overrides: Partial<PluginRemovalClaims> = {}): PluginRemovalClaims {
  return {
    home: "/home/someone",
    isMachineOwned: async () => false,
    guardMessage: async () => undefined,
    resolveCacheCandidate: async () => null,
    detachNativeRefs: vi.fn(),
    detachUserPlugin: vi.fn(),
    ...overrides,
  };
}

const claude = syntheticCatalog().aiProfile(SYNTHETIC_TOOL);

describe("the claims a host withdrawal is checked against", () => {
  it("asks machine ownership about the tool being withdrawn", async () => {
    const isMachineOwned = vi.fn(async () => true);

    const view = withdrawalClaimsOf(machineClaims({ isMachineOwned }), {
      toolId: SYNTHETIC_TOOL,
      tool: claude,
      projectRoot: "/p",
    });

    expect(await view.isMachineOwned("a@catalog")).toBe(true);
    expect(isMachineOwned).toHaveBeenCalledWith(SYNTHETIC_TOOL, "a@catalog");
  });

  it("asks the guard about the project being removed, through the tool's own reach", async () => {
    const guardMessage = vi.fn(async () => "kept for /other");

    const view = withdrawalClaimsOf(machineClaims({ guardMessage }), {
      toolId: SYNTHETIC_TOOL,
      tool: claude,
      projectRoot: "/p",
    });

    expect(await view.guardMessage("claude", "a@catalog", "framework")).toBe("kept for /other");
    expect(guardMessage).toHaveBeenCalledWith({
      binary: "claude",
      tool: claude,
      ref: "a@catalog",
      marketplaceAlias: "framework",
      projectRoot: "/p",
    });
  });

  it("proves a cache path through the machine's containment check", async () => {
    const resolveCacheCandidate = vi.fn(async () => "/cache/a");

    const view = withdrawalClaimsOf(machineClaims({ resolveCacheCandidate }), {
      toolId: SYNTHETIC_TOOL,
      tool: claude,
      projectRoot: "/p",
    });

    expect(await view.resolveCacheCandidate("/cache", "a", "plugin")).toBe("/cache/a");
    expect(resolveCacheCandidate).toHaveBeenCalledWith("/cache", "a", "plugin");
  });
});
