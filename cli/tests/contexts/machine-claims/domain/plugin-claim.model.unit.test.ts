import { describe, expect, it } from "vitest";
import {
  claimsKeeping,
  holdersOf,
  joinPluginClaims,
  mergeRefClaims,
  pluginClaimsNamed,
  readHeldClaims,
  readHeldRefClaims,
  splitPluginClaims,
  withoutPluginDependent,
  withPluginDependent,
} from "../../../../src/contexts/machine-claims/domain/plugin-claim.model.js";
import type { MachineRecords } from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

describe("the projects holding plugins and refs", () => {
  it("lists each project root once over the claims", () => {
    const held = [
      { plugin: "a", dependents: ["/A", "/B"] },
      { plugin: "b", dependents: ["/B"] },
      { ref: "c@d", dependents: ["/C", "/A"] },
    ];

    expect(holdersOf(held)).toEqual(["/A", "/B", "/C"]);
  });

  it("is none when nothing is held", () => {
    expect(holdersOf([{ dependents: [] }])).toEqual([]);
  });
});

describe("a project holding a plugin", () => {
  const other = { ref: "a@b", dependents: ["/ref"] };

  it("opens the plugin's claim for the first project holding it, after the claims held", () => {
    expect(withPluginDependent([other], "sample", "/A")).toStrictEqual([
      other,
      { plugin: "sample", dependents: ["/A"] },
    ]);
  });

  it("joins the claim of a plugin already held, once", () => {
    const held = [{ plugin: "sample", dependents: ["/A"] }, other];

    expect(withPluginDependent(held, "sample", "/B")).toStrictEqual([
      { plugin: "sample", dependents: ["/A", "/B"] },
      other,
    ]);
    expect(withPluginDependent(held, "sample", "/A")).toStrictEqual(held);
  });

  it("leaves the claims it was given as they were", () => {
    const held = [{ plugin: "sample", dependents: ["/A"] }];

    withPluginDependent(held, "sample", "/B");

    expect(held).toStrictEqual([{ plugin: "sample", dependents: ["/A"] }]);
  });

  it("does not open a claim of a plugin named like a ref", () => {
    expect(withPluginDependent([{ ref: "sample", dependents: [] }], "sample", "/A")).toHaveLength(
      2
    );
  });
});

describe("a project releasing a plugin", () => {
  const other = { ref: "a@b", dependents: ["/A"] };

  it("leaves the plugin's claim without it, the other claims as they were", () => {
    const released = withoutPluginDependent(
      [{ plugin: "sample", dependents: ["/A", "/B"] }, other],
      "sample",
      "/A"
    );

    expect(released).toStrictEqual({
      claims: [{ plugin: "sample", dependents: ["/B"] }, other],
      changed: true,
    });
  });

  it("closes the claim once no project holds the plugin", () => {
    const released = withoutPluginDependent(
      [other, { plugin: "sample", dependents: ["/A"] }],
      "sample",
      "/A"
    );

    expect(released).toStrictEqual({ claims: [other], changed: true });
  });

  it("changes nothing for a project that does not hold the plugin", () => {
    const held = [{ plugin: "sample", dependents: ["/B"] }, other];

    expect(withoutPluginDependent(held, "sample", "/A")).toStrictEqual({
      claims: held,
      changed: false,
    });
  });
});

describe("the claims of named plugins", () => {
  it("keeps the claims of the plugins named, never a ref's", () => {
    const wanted = { plugin: "a", dependents: ["/A"] };

    expect(
      pluginClaimsNamed(
        [wanted, { plugin: "b", dependents: [] }, { ref: "a", dependents: [] }],
        ["a"]
      )
    ).toStrictEqual([wanted]);
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

  it("keeps the claim a plugin holds, where it stands", () => {
    const plugin = { plugin: "sample", dependents: ["/p"] };

    const merged = mergeRefClaims(
      [plugin, { ref: "a@catalog", dependents: [] }],
      ["a@catalog"],
      "/a"
    );

    expect(merged.entries).toStrictEqual([plugin, { ref: "a@catalog", dependents: ["/a"] }]);
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

describe("keeping the claims a ref passes", () => {
  it("keeps every claim of a plugin, whatever the ref test says", () => {
    const plugin = { plugin: "sample", dependents: ["/p"] };

    expect(claimsKeeping([plugin, { ref: "a@b", dependents: [] }], () => false)).toStrictEqual([
      plugin,
    ]);
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

  it("reads the claim a plugin holds beside the claims on refs, in order", () => {
    const held = [
      { plugin: "sample", dependents: ["/p"] },
      { ref: "a@b", dependents: [] },
    ];

    expect(readHeldClaims(held)).toStrictEqual(held);
    expect(readHeldRefClaims(held)).toStrictEqual([{ ref: "a@b", dependents: [] }]);
  });

  it.each([
    ["claims that are not a list", "plugin@declared"],
    ["a claim of neither a ref nor a plugin", [{ dependents: [] }]],
    ["a claim of both a ref and a plugin", [{ ref: "a@b", plugin: "a", dependents: [] }]],
    ["a claim whose plugin is not a name", [{ plugin: 1, dependents: [] }]],
    ["a claim whose dependents are not paths", [{ ref: "a@b", dependents: [1] }]],
    ["a plugin claim whose dependents are not paths", [{ plugin: "a", dependents: "/A" }]],
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

  it("keeps nothing of a tool whose claims were all released and that holds no host data", () => {
    const split = splitPluginClaims(new Map([[SYNTHETIC_TOOL, { pluginClaims: [] }]]));

    expect(split.host.size).toBe(0);
    expect(split.claims.size).toBe(0);
  });

  it("keeps the host data of a tool whose claims were all released", () => {
    const split = splitPluginClaims(new Map([[SYNTHETIC_TOOL, { ...hostData, pluginClaims: [] }]]));

    expect(split.host).toStrictEqual(new Map([[SYNTHETIC_TOOL, hostData]]));
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
