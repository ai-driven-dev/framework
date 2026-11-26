import { describe, expect, it } from "vitest";
import { HostRegistryMarketplaceSourceReaderAdapter } from "../../../../../src/contexts/host-registration/infrastructure/marketplace/host-registry-marketplace-source-reader-adapter.js";

describe("host registry marketplace source reader", () => {
  it("maps Claude's readable marketplace registry to exact file sources", async () => {
    const reader = new HostRegistryMarketplaceSourceReaderAdapter({
      read: async () => ({
        location: "/home/.claude/plugins/known_marketplaces.json",
        entries: new Map([["aidd-framework", "/project-a/.aidd/cache/built"]]),
      }),
    });

    const reading = await reader.read("/project-b");

    expect(reading.entries?.get("aidd-framework")).toEqual({
      kind: "registry",
      source: "/project-a/.aidd/cache/built",
    });
  });

  it("distinguishes Claude's missing registry from an unreadable one", async () => {
    for (const [hostReading, expected] of [
      [{ location: "/known", absent: true as const }, "absent"],
      [{ location: "/known", unreadable: "EACCES" }, "unreadable"],
    ] as const) {
      const reading = await new HostRegistryMarketplaceSourceReaderAdapter({
        read: async () => hostReading,
      }).read("/project-b");

      if (expected === "absent") expect(reading.entries?.size).toBe(0);
      else expect(reading.unreadable).toContain("EACCES");
    }
  });
});
