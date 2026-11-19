import { describe, expect, it, vi } from "vitest";
import type { PluginRemovalClaims } from "../../../src/contexts/installation/application/removal/project-plugin-withdrawal.js";
import { withdrawalClaimsOf } from "../../../src/orchestration/plugin/withdrawal-claims.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.js";

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

const claude = registeredTools().aiProfile(TOOL.claude);

describe("the claims a host withdrawal is checked against", () => {
  it("asks machine ownership about the tool being withdrawn", async () => {
    const isMachineOwned = vi.fn(async () => true);

    const view = withdrawalClaimsOf(machineClaims({ isMachineOwned }), {
      toolId: TOOL.claude,
      tool: claude,
      projectRoot: "/p",
    });

    expect(await view.isMachineOwned("a@catalog")).toBe(true);
    expect(isMachineOwned).toHaveBeenCalledWith(TOOL.claude, "a@catalog");
  });

  it("asks the guard about the project being removed, through the tool's own reach", async () => {
    const guardMessage = vi.fn(async () => "kept for /other");

    const view = withdrawalClaimsOf(machineClaims({ guardMessage }), {
      toolId: TOOL.claude,
      tool: claude,
      projectRoot: "/p",
    });

    expect(await view.guardMessage("claude", "a@catalog", "framework")).toBe("kept for /other");
    expect(guardMessage).toHaveBeenCalledWith("claude", claude, "a@catalog", "framework", "/p");
  });

  it("proves a cache path through the machine's containment check", async () => {
    const resolveCacheCandidate = vi.fn(async () => "/cache/a");

    const view = withdrawalClaimsOf(machineClaims({ resolveCacheCandidate }), {
      toolId: TOOL.claude,
      tool: claude,
      projectRoot: "/p",
    });

    expect(await view.resolveCacheCandidate("/cache", "a", "plugin")).toBe("/cache/a");
    expect(resolveCacheCandidate).toHaveBeenCalledWith("/cache", "a", "plugin");
  });
});
