import { describe, expect, it } from "vitest";
import {
  nativeCatalogProof,
  proveAddedSource,
} from "../../../../../src/contexts/host-registration/application/register/native-catalog-proof.js";
import { DIR, enabled, OWN, setup } from "../../testing/registration-run.builder.js";

describe("nativeCatalogProof", () => {
  it("is canonical and owned for a registration made this run, with no foreign ref", async () => {
    const { run } = setup({ sources: new Map([["aidd", OWN]]) });
    expect(
      await nativeCatalogProof(run, "aidd", { alias: "aidd", hostName: "aidd", provenance: OWN })
    ).toEqual({
      canonical: true,
      sourceStatus: "owned",
      source: OWN,
      hostReadable: true,
    });
  });

  it("is not canonical when neither this run nor any record holds the name", async () => {
    const { run } = setup();
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({
      canonical: false,
      sourceStatus: "absent",
    });
  });

  it("is canonical through a machine record of the name", async () => {
    const { run } = setup({
      claims: { machine: async () => ({ marketplaces: [{ alias: "aidd", hostName: "aidd" }] }) },
    });
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({ canonical: true });
  });

  it("names a ref enabled on the host under the name that no claim covers", async () => {
    const { run } = setup({ plugins: enabled("x@aidd") });
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({
      hostReadable: true,
      foreignRef: "x@aidd",
    });
  });

  it("does not name a ref the machine already claims", async () => {
    const { run } = setup({
      plugins: enabled("x@aidd"),
      claims: { machine: async () => ({ marketplaces: [], pluginClaims: [{ ref: "x@aidd" }] }) },
    });
    expect(await nativeCatalogProof(run, "aidd")).not.toHaveProperty("foreignRef");
  });

  it("reports where an unreadable plugin registry is, and is not host readable", async () => {
    const { run } = setup({ plugins: { location: "p" } });
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({
      hostReadable: false,
      unreadable: "p",
    });
  });

  it("is readable and clear when the plugin registry is absent", async () => {
    const { run } = setup({ plugins: { location: "p", absent: true } });
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({ hostReadable: true });
  });
});

describe("proveAddedSource", () => {
  it("returns the source the host now follows when it is the built directory", async () => {
    const { run, warnings } = setup({ sources: new Map([["aidd", OWN]]) });
    expect(await proveAddedSource(run, "aidd", DIR)).toEqual(OWN);
    expect(warnings).toEqual([]);
  });

  it("warns and returns nothing when the host follows another directory", async () => {
    const { run, warnings } = setup({
      sources: new Map([["aidd", { kind: "registry" as const, source: "/elsewhere" }]]),
    });
    expect(await proveAddedSource(run, "aidd", DIR)).toBeUndefined();
    expect(warnings).toEqual([
      "claude: catalogue 'aidd' add returned but effective host source could not be proven as '/built/aidd'; no AIDD claim or enablement recorded. Reconcile manually.",
    ]);
  });
});
