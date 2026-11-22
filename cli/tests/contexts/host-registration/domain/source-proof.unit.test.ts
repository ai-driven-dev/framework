import { describe, expect, it } from "vitest";
import type { NativeMarketplaceSourceReading } from "../../../../src/contexts/host-registration/domain/record/native-marketplace-source-reading.js";
import {
  findForeignRef,
  inspectSourceReading,
} from "../../../../src/contexts/host-registration/domain/source-proof.js";

const OWNED = { kind: "registry", source: "/owned" } as const;
const registration = { alias: "a", hostName: "host", provenance: OWNED };
const reading = (
  entries: NativeMarketplaceSourceReading["entries"],
  unreadable?: string
): NativeMarketplaceSourceReading => ({
  location: "/catalogue",
  entries,
  unreadable,
});

describe("what a source reading proves about a catalogue", () => {
  it("owns a catalogue whose host source is the recorded one", () => {
    expect(inspectSourceReading(reading(new Map([["host", OWNED]])), registration)).toEqual({
      status: "owned",
      current: OWNED,
    });
  });

  it("finds a catalogue the host does not list absent", () => {
    expect(inspectSourceReading(reading(new Map()), registration)).toEqual({ status: "absent" });
  });

  it("does not prove a source that differs from the recorded one", () => {
    const verdict = inspectSourceReading(
      reading(new Map([["host", { kind: "registry", source: "/foreign" } as const]])),
      registration
    );
    expect(verdict).toEqual({
      status: "unproven",
      reason:
        "Catalogue 'host': current host source differs from AIDD's recorded source; reconcile manually.",
    });
  });

  it("does not prove a claim recorded without a source", () => {
    const verdict = inspectSourceReading(reading(new Map([["host", OWNED]])), {
      alias: "a",
      hostName: "host",
    });
    expect(verdict.reason).toBe(
      "Catalogue 'host': legacy claim has no source proof; reconcile manually."
    );
  });

  it("does not prove a catalogue the host names without a source", () => {
    expect(inspectSourceReading(reading(new Map([["host", null]])), registration).reason).toBe(
      "Catalogue 'host': current host source is unproven; reconcile manually."
    );
  });

  it("names why an unreadable reading proves nothing, else where it looked", () => {
    expect(inspectSourceReading(reading(undefined, "denied"), registration).reason).toBe(
      "Catalogue 'host': denied; reconcile manually."
    );
    expect(inspectSourceReading(reading(undefined), registration).reason).toBe(
      "Catalogue 'host': host source unreadable at /catalogue; reconcile manually."
    );
  });
});

describe("the foreign ref on a catalogue", () => {
  const refs = new Map([
    ["mine@host", { enabled: true }],
    ["theirs@host", { enabled: true }],
    ["off@host", { enabled: false }],
    ["other@elsewhere", { enabled: true }],
  ]);
  const inUse = (enabled: boolean) => enabled;

  it("is the first in-use ref of the catalogue AIDD does not own", () => {
    expect(
      findForeignRef(refs, { hostName: "host", ownedRefs: new Set(["mine@host"]), inUse })
    ).toBe("theirs@host");
  });

  it("ignores refs not in use, owned, or on another catalogue", () => {
    expect(
      findForeignRef(refs, {
        hostName: "host",
        ownedRefs: new Set(["mine@host", "theirs@host"]),
        inUse,
      })
    ).toBeUndefined();
  });
});
