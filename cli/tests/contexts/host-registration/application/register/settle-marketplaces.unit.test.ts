import { describe, expect, it } from "vitest";
import { settleMarketplaces } from "../../../../../src/contexts/host-registration/application/register/settle-marketplaces.js";
import { catalogAt, DIR, NONE, OWN, setup } from "../../testing/registration-run.builder.js";

const marketplace = { name: "aidd", scope: "project" as const };

describe("settling registered marketplaces", () => {
  it("settles a registered marketplace as added this run", async () => {
    const { run } = setup({ files: catalogAt(DIR, []) });
    const settled = await settleMarketplaces(run, {
      marketplaces: [marketplace],
      claims: NONE,
      build: async () => DIR,
    });
    expect(settled.marketplaces).toEqual([{ alias: "aidd", hostName: "aidd", provenance: OWN }]);
    expect(settled.catalogClaims).toEqual(settled.marketplaces);
    expect([...settled.addedHostNames]).toEqual(["aidd"]);
    expect(settled.buildFailed).toBe(false);
  });

  it("flags a build that failed and settles nothing for it", async () => {
    const { run, activator } = setup();
    const settled = await settleMarketplaces(run, {
      marketplaces: [marketplace],
      claims: NONE,
      build: async () => null,
    });
    expect(settled.buildFailed).toBe(true);
    expect(settled.marketplaces).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
  });
});
