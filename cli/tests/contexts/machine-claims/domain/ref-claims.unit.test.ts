import { describe, expect, it } from "vitest";
import {
  claimsKeeping,
  mergeRefClaims,
} from "../../../../src/contexts/machine-claims/domain/ref-claims.js";

describe("mergeRefClaims", () => {
  const claimsOf = (
    claims: { ref: string; dependents: string[] }[],
    refs: string[],
    dependent: string | undefined
  ) => mergeRefClaims(claims, refs, dependent);

  it("opens a claim held by the dependent for a ref nobody claimed", () => {
    const merged = claimsOf([], ["a@catalog"], "/a");
    expect(merged.entries).toEqual([{ ref: "a@catalog", dependents: ["/a"] }]);
    expect(merged.changed).toBe(true);
  });

  it("opens a claim held by nobody when there is no dependent", () => {
    const merged = claimsOf([], ["a@catalog"], undefined);
    expect(merged.entries).toEqual([{ ref: "a@catalog", dependents: [] }]);
    expect(merged.changed).toBe(true);
  });

  it("adds the dependent to a claim it does not hold yet", () => {
    const merged = claimsOf([{ ref: "a@catalog", dependents: ["/a"] }], ["a@catalog"], "/b");
    expect(merged.entries).toEqual([{ ref: "a@catalog", dependents: ["/a", "/b"] }]);
    expect(merged.changed).toBe(true);
  });

  it("changes nothing when the dependent already holds the claim", () => {
    const merged = claimsOf([{ ref: "a@catalog", dependents: ["/a"] }], ["a@catalog"], "/a");
    expect(merged.entries).toEqual([{ ref: "a@catalog", dependents: ["/a"] }]);
    expect(merged.changed).toBe(false);
  });

  it("changes nothing for a claimed ref when there is no dependent", () => {
    const merged = claimsOf([{ ref: "a@catalog", dependents: [] }], ["a@catalog"], undefined);
    expect(merged.entries).toEqual([{ ref: "a@catalog", dependents: [] }]);
    expect(merged.changed).toBe(false);
  });

  it("keeps a claim on a ref it was not asked about", () => {
    const merged = claimsOf([{ ref: "kept@catalog", dependents: ["/k"] }], ["a@catalog"], "/a");
    expect(merged.entries).toEqual([
      { ref: "kept@catalog", dependents: ["/k"] },
      { ref: "a@catalog", dependents: ["/a"] },
    ]);
  });

  it("reports a change once however many refs say so", () => {
    const merged = claimsOf([], ["a@catalog", "b@catalog"], "/a");
    expect(merged.changed).toBe(true);
    expect(merged.entries).toHaveLength(2);
  });

  it("copies the recorded claims, never handing back the ones it was given", () => {
    const claim = { ref: "a@catalog", dependents: ["/a"] };
    const merged = claimsOf([claim], ["a@catalog"], "/b");
    expect(merged.entries).toEqual([{ ref: "a@catalog", dependents: ["/a", "/b"] }]);
    expect(claim.dependents).toEqual(["/a"]);
  });
});

describe("claimsKeeping", () => {
  it("keeps the claims whose ref passes, by identity", () => {
    const kept = { ref: "a@catalog" };
    expect(claimsKeeping([kept, { ref: "b@other" }], (ref) => ref.endsWith("@catalog"))).toEqual([
      kept,
    ]);
    expect(claimsKeeping([kept], () => true)[0]).toBe(kept);
  });

  it("keeps none when there were none", () => {
    expect(claimsKeeping(undefined, () => true)).toEqual([]);
  });
});
