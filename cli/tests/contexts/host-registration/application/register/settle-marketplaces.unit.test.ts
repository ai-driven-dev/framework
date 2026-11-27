import { describe, expect, it } from "vitest";
import { settleMarketplaces } from "../../../../../src/contexts/host-registration/application/register/settle-marketplaces.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import { userBuiltMarketplaceDir } from "../../../../../src/shared/domain/layout/aidd-layout.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
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

  it("settles a marketplace moved off an older build as repointed", async () => {
    const userCacheRoot = "/home/.config/aidd";
    const build = (cliVersion: string) =>
      userBuiltMarketplaceDir({
        userConfigDir: userCacheRoot,
        cliVersion,
        marketplaceName: "aidd",
        target: TOOL.codex,
      });
    const listed = (dir: string): NativeMarketplaceSource => ({
      kind: "effective-list",
      root: dir,
      sourceType: "local",
      source: dir,
    });
    const older = listed(build("1.0.0"));
    const { run } = setup({
      tool: TOOL.codex,
      activator: new FakeHostActions({ available: true, conflictOnAdd: true }),
      userCacheRoot,
      sources: new Map([["aidd", older]]),
      claims: {
        machine: async () => ({
          marketplaces: [{ alias: "aidd", hostName: "aidd", provenance: older }],
          claimedRefs: [],
        }),
      },
      files: {
        [`${build("2.0.0")}/.agents/plugins/marketplace.json`]: JSON.stringify({
          name: "aidd",
          plugins: [],
        }),
      },
    });
    const settled = await settleMarketplaces(run, {
      marketplaces: [{ name: "aidd", scope: "user" }],
      claims: NONE,
      build: async () => build("2.0.0"),
    });
    expect([...settled.repointedHostNames]).toEqual(["aidd"]);
  });
});
