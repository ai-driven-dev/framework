import { describe, expect, it } from "vitest";
import {
  assertNoForeignNativeRefs,
  assertSourceOwned,
  inspectHostSource,
} from "../../../../src/contexts/host-registration/application/native-marketplace-source-proof.js";
import type {
  NativeMarketplaceRegistration,
  NativeMarketplaceSource,
} from "../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { HostMarketplaceSources } from "../../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";

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
): HostMarketplaceSources {
  return { read: async () => ({ location: "codex marketplace list --json", entries }) };
}

describe("current native marketplace source proof", () => {
  it.each([TOOL.claude, TOOL.codex, TOOL.copilot, undefined] as const)(
    "%s protects a foreign disabled ref unless uninstall leaves that tombstone",
    async (toolId) => {
      const refs = new Map([["foreign@real-catalog", { enabled: false }]]);
      const result = assertNoForeignNativeRefs(
        {
          reader: { read: async () => ({ location: "host plugins", refs }) },
          tool: toolId && registeredTools().aiProfile(toolId),
        },
        { hostName: "real-catalog", ownedRefs: new Set(), projectRoot: "/project-b" }
      );
      if (toolId === "copilot") await expect(result).resolves.toEqual(refs);
      else await expect(result).rejects.toThrow(/foreign host ref/);
    }
  );

  it.each([
    { location: "/host/catalogue", unreadable: "permission denied", reason: "permission denied" },
    { location: "/host/catalogue", reason: "host source unreadable at /host/catalogue" },
  ])(
    "reports the exact unreadable host source diagnostic",
    async ({ location, unreadable, reason }) => {
      expect(
        await inspectHostSource(
          { read: async () => ({ location, unreadable }) },
          "/project-b",
          claim
        )
      ).toEqual({
        status: "unproven",
        reason: `Catalogue 'real-catalog': ${reason}; reconcile manually.`,
      });
    }
  );

  it("refuses foreign same-catalogue refs even when a canonical owned ref is enabled", async () => {
    let requestedRoot = "";
    const host: HostPluginRegistry = {
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
      assertNoForeignNativeRefs(
        { reader: host, tool: registeredTools().aiProfile(TOOL.claude) },
        {
          hostName: "real-catalog",
          ownedRefs: new Set(["mine@real-catalog"]),
          projectRoot: "/project-b",
        }
      )
    ).rejects.toThrow(/foreign host ref 'foreign@real-catalog'/);
    expect(requestedRoot).toBe("/project-b");
  });

  it("fails closed on unreadable or missing host plugin readers, but accepts explicit absence", async () => {
    await expect(
      assertNoForeignNativeRefs(
        { reader: undefined, tool: registeredTools().aiProfile(TOOL.claude) },
        { hostName: "real-catalog", ownedRefs: new Set(), projectRoot: "/project-b" }
      )
    ).rejects.toThrow(/reader unavailable/);
    await expect(
      assertNoForeignNativeRefs(
        {
          reader: { read: async () => ({ location: "host plugins", unreadable: "EACCES" }) },
          tool: registeredTools().aiProfile(TOOL.claude),
        },
        { hostName: "real-catalog", ownedRefs: new Set(), projectRoot: "/project-b" }
      )
    ).rejects.toThrow(/EACCES/);
    expect(
      await assertNoForeignNativeRefs(
        {
          reader: { read: async () => ({ location: "host plugins", absent: true }) },
          tool: registeredTools().aiProfile(TOOL.claude),
        },
        { hostName: "real-catalog", ownedRefs: new Set(), projectRoot: "/project-b" }
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
        {
          reader: { read: async () => ({ location: "host plugins", refs }) },
          tool: registeredTools().aiProfile(TOOL.claude),
        },
        {
          hostName: "real-catalog",
          ownedRefs: new Set(["mine@real-catalog"]),
          projectRoot: "/project-b",
        }
      )
    ).toEqual(refs);
  });
  /** One verdict per host source reading and recorded claim: a source is owned only when the host
   * names exactly the one AIDD recorded; everything unreadable, unnamed or different is refused
   * with a reason that names the catalogue. */
  const legacy = { alias: claim.alias, hostName: claim.hostName };
  const named = (entry: NativeMarketplaceSource | null) =>
    reader(new Map([[claim.hostName, entry]]));
  const VERDICTS: ReadonlyArray<
    [string, HostMarketplaceSources | undefined, NativeMarketplaceRegistration, string, string?]
  > = [
    ["a name the host does not hold", reader(new Map()), claim, "absent"],
    ["the exact recorded source", named(SOURCE), claim, "owned"],
    [
      "a different source",
      named({ ...SOURCE, source: "/foreign/catalog" }),
      claim,
      "unproven",
      "differs",
    ],
    [
      "a different root",
      named({ ...SOURCE, root: "/foreign/cache" }),
      claim,
      "unproven",
      "differs",
    ],
    [
      "a different source type",
      named({ ...SOURCE, sourceType: "git" }),
      claim,
      "unproven",
      "differs",
    ],
    [
      "a different kind",
      named({ kind: "registry", source: SOURCE.source }),
      claim,
      "unproven",
      "differs",
    ],
    ["a legacy claim", named(SOURCE), legacy, "unproven", "legacy claim has no source proof"],
    ["an unknown source", named(null), claim, "unproven", "current host source is unproven"],
    ["an unreadable host", reader(), claim, "unproven", "host source unreadable"],
    ["no reader", undefined, claim, "unproven", "reader unavailable"],
  ];

  it.each(VERDICTS)("judges %s", async (_cell, sourceReader, registration, status, reason) => {
    const result = await inspectHostSource(sourceReader, "/project-b", registration);

    expect(result.status).toBe(status);
    if (reason !== undefined) {
      expect(result.reason).toContain("real-catalog");
      expect(result.reason).toContain(reason);
    }
  });
});

describe("asserting a catalogue source is owned", () => {
  it("accepts an owned source", () => {
    expect(() => assertSourceOwned({ status: "owned" }, "fallback")).not.toThrow();
  });

  it("names the reconcile reason the proof carries", () => {
    expect(() =>
      assertSourceOwned({ status: "unproven", reason: "host says no" }, "fallback")
    ).toThrow("host says no");
  });

  it("falls back to the caller's message when the proof names no reason", () => {
    expect(() => assertSourceOwned({ status: "absent" }, "fallback")).toThrow("fallback");
  });
});
