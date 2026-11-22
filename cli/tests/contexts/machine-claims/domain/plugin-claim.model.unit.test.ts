import { describe, expect, it } from "vitest";
import {
  claimsKeeping,
  dependentsClaim,
  holdersOf,
  joinPluginClaims,
  mergeRefClaims,
  readDependents,
  readHeldClaims,
  splitPluginClaims,
} from "../../../../src/contexts/machine-claims/domain/plugin-claim.model.js";
import type { MachineRecords } from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("a plugin's dependents claim", () => {
  it("lists each project root once", () => {
    expect(dependentsClaim(["/A", "/B", "/A"])).toEqual(["/A", "/B"]);
  });

  it("is no claim when no project holds the plugin", () => {
    expect(dependentsClaim([])).toBeUndefined();
  });

  it("reads no project from no claim", () => {
    expect(readDependents(undefined)).toEqual([]);
  });

  it("reads the project roots it lists", () => {
    expect(readDependents(["/A", "/B"])).toEqual(["/A", "/B"]);
  });

  it.each([["/A"], [["/A", 1]]])("refuses a claim that is not a list of paths: %j", (claim) => {
    expect(() => readDependents(claim)).toThrow("expected a list of project roots");
  });
});

describe("the projects holding plugins and refs", () => {
  it("lists each project root once over the plugins' claims and the refs' claims", () => {
    expect(
      holdersOf(
        [{ machineClaim: ["/A", "/B"] }, { machineClaim: ["/B"] }, {}],
        [{ dependents: ["/C", "/A"] }]
      )
    ).toEqual(["/A", "/B", "/C"]);
  });

  it("is none when nothing is held", () => {
    expect(holdersOf([{}], [{ dependents: [] }])).toEqual([]);
  });

  it("refuses a plugin claim it did not write", () => {
    expect(() => holdersOf([{ machineClaim: "/A" }], [])).toThrow(
      "expected a list of project roots"
    );
  });
});

describe("merging a dependent into the ref claims", () => {
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

describe("keeping the claims whose ref passes", () => {
  it("keeps the claims whose ref passes", () => {
    const kept = { ref: "a@catalog", dependents: [] };
    const dropped = { ref: "b@other", dependents: [] };
    expect(claimsKeeping([kept, dropped], (ref) => ref.endsWith("@catalog"))).toEqual([kept]);
  });
});

describe("reading the claims a record holds", () => {
  it("reads none when the record keeps none", () => {
    expect(readHeldClaims(undefined)).toEqual([]);
  });

  it("copies each claim so the record stays as it was", () => {
    const dependents = ["/project-a"];
    const record = [{ ref: "plugin@declared", dependents }];

    const read = readHeldClaims(record);
    dependents.push("/project-b");

    expect(read).toStrictEqual([{ ref: "plugin@declared", dependents: ["/project-a"] }]);
  });

  it.each([
    ["claims that are not a list", "plugin@declared"],
    ["a claim without a ref", [{ dependents: [] }]],
    ["a claim whose dependents are not paths", [{ ref: "a@b", dependents: [1] }]],
  ])("refuses %s", (_name, value) => {
    expect(() => readHeldClaims(value)).toThrow("nativeRegistrations.pluginClaims");
  });
});

const claims = [{ ref: "plugin@declared", dependents: ["/project-a"] }];
const hostData = { binary: "synthetic", pluginRefs: ["plugin@declared"] };

describe("a record's claims, kept apart from its host data", () => {
  it("splits the claims block off the host data", () => {
    const split = splitPluginClaims(
      new Map([[SYNTHETIC_TOOL, { ...hostData, pluginClaims: claims }]])
    );

    expect(split.host).toStrictEqual(new Map([[SYNTHETIC_TOOL, hostData]]));
    expect(split.claims).toStrictEqual(new Map([[SYNTHETIC_TOOL, claims]]));
  });

  it("records no claims for a tool without a claims block", () => {
    const split = splitPluginClaims(new Map([[SYNTHETIC_TOOL, hostData]]));

    expect(split.claims.size).toBe(0);
  });

  it("joins back to the records it was split from", () => {
    const records: MachineRecords = new Map();
    records.set(SYNTHETIC_TOOL, { ...hostData, pluginClaims: claims });
    records.set(SECOND_SYNTHETIC_TOOL, hostData);

    const { host, claims: held } = splitPluginClaims(records);

    expect(joinPluginClaims(host, held)).toStrictEqual(records);
  });

  it("records a tool holding only claims with its claims alone", () => {
    expect(joinPluginClaims(new Map(), new Map([[SYNTHETIC_TOOL, claims]]))).toStrictEqual(
      new Map([[SYNTHETIC_TOOL, { pluginClaims: claims }]])
    );
  });
});
