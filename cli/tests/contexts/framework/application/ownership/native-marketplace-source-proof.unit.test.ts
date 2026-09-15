import { describe, expect, it } from "vitest";
import {
  assertNoForeignNativeRefs,
  inspectNativeMarketplaceSource,
} from "../../../../../src/contexts/framework/application/ownership/native-marketplace-source-proof.js";
import type { NativeMarketplaceRegistration } from "../../../../../src/contexts/framework/domain/manifest/native-registrations.js";
import type { HostPluginRegistryReader } from "../../../../../src/contexts/tools/domain/ports/host-plugin-registry-reader.js";
import type {
  NativeMarketplaceSource,
  NativeMarketplaceSourceReader,
} from "../../../../../src/contexts/tools/domain/ports/native-marketplace-source-reader.js";

const SOURCE: NativeMarketplaceSource = {
  kind: "effective-list",
  root: "/home/.codex/plugins/marketplaces/real-catalog",
  sourceType: "local",
  source: "/project-a/.aidd/cache/built",
};
const claim: NativeMarketplaceRegistration = {
  alias: "local-alias",
  hostName: "real-catalog",
  provenance: SOURCE,
};

function reader(
  entries?: ReadonlyMap<string, NativeMarketplaceSource | null>
): NativeMarketplaceSourceReader {
  return { read: async () => ({ location: "codex marketplace list --json", entries }) };
}

describe("current native marketplace source proof", () => {
  it("refuses foreign same-catalogue refs even when a canonical owned ref is enabled", async () => {
    let requestedRoot = "";
    const host: HostPluginRegistryReader = {
      read: async (projectRoot) => {
        requestedRoot = projectRoot;
        return {
          location: "host plugins",
          refs: new Map([
            ["mine@real-catalog", { enabled: true }],
            ["foreign@real-catalog", { enabled: true }],
            ["other@other-catalog", { enabled: true }],
          ]),
        };
      },
    };
    await expect(
      assertNoForeignNativeRefs(host, "real-catalog", new Set(["mine@real-catalog"]), "/project-b")
    ).rejects.toThrow(/foreign host ref 'foreign@real-catalog'/);
    expect(requestedRoot).toBe("/project-b");
  });

  it("fails closed on unreadable or missing host plugin readers, but accepts explicit absence", async () => {
    await expect(
      assertNoForeignNativeRefs(undefined, "real-catalog", new Set(), "/project-b")
    ).rejects.toThrow(/reader unavailable/);
    await expect(
      assertNoForeignNativeRefs(
        { read: async () => ({ location: "host plugins", unreadable: "EACCES" }) },
        "real-catalog",
        new Set(),
        "/project-b"
      )
    ).rejects.toThrow(/EACCES/);
    await expect(
      assertNoForeignNativeRefs(
        {
          read: async () => {
            throw new Error("EACCES");
          },
        },
        "real-catalog",
        new Set(),
        "/project-b"
      )
    ).rejects.toThrow(/real-catalog.*host plugin registry read failed.*EACCES/);
    expect(
      await assertNoForeignNativeRefs(
        { read: async () => ({ location: "host plugins", absent: true }) },
        "real-catalog",
        new Set(),
        "/project-b"
      )
    ).toEqual(new Map());
  });

  it("returns exact host ref states when all same-catalogue refs are AIDD-owned", async () => {
    const refs = new Map([
      ["mine@real-catalog", { enabled: true, scope: "user" as const }],
      ["other@other-catalog", { enabled: true }],
    ]);
    expect(
      await assertNoForeignNativeRefs(
        { read: async () => ({ location: "host plugins", refs }) },
        "real-catalog",
        new Set(["mine@real-catalog"]),
        "/project-b"
      )
    ).toEqual(refs);
  });
  it("treats a readable missing name as fresh absence, not ownership", async () => {
    const result = await inspectNativeMarketplaceSource(reader(new Map()), "/project-b", claim);

    expect(result.status).toBe("absent");
  });

  it("refuses a named foreign source despite an old canonical same-name claim", async () => {
    for (const changed of [
      { ...SOURCE, source: "/foreign/catalog" },
      { ...SOURCE, root: "/foreign/cache" },
      { ...SOURCE, sourceType: "git" },
    ]) {
      const result = await inspectNativeMarketplaceSource(
        reader(new Map([[claim.hostName, changed]])),
        "/project-b",
        claim
      );

      expect(result.status).toBe("unproven");
      expect(result.reason).toContain("real-catalog");
      expect(result.reason).toContain("current host source differs");
    }
  });

  it("refuses legacy claims, unknown named sources, and unreadable hosts", async () => {
    const legacy = { alias: claim.alias, hostName: claim.hostName };
    for (const [sourceReader, registration] of [
      [reader(new Map([[claim.hostName, SOURCE]])), legacy],
      [reader(new Map([[claim.hostName, null]])), claim],
      [reader(), claim],
      [undefined, claim],
    ] as const) {
      const result = await inspectNativeMarketplaceSource(sourceReader, "/project-b", registration);

      expect(result.status).toBe("unproven");
      expect(result.reason).toContain("real-catalog");
    }
  });

  it("owns only an exact source measured for the requesting project", async () => {
    const result = await inspectNativeMarketplaceSource(
      reader(new Map([[claim.hostName, SOURCE]])),
      "/project-b",
      claim
    );

    expect(result).toMatchObject({ status: "owned", current: SOURCE });
  });
});
