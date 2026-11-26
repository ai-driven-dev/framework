import { describe, expect, it } from "vitest";
import { recordsOf } from "../../../../../src/composition/contexts/installation.js";
import { forgetMarketplaceInRecords } from "../../../../../src/contexts/installation/application/marketplace/forget-marketplace.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const registeredBoth = {
  binary: "claude",
  marketplaces: [
    { alias: "mine", hostName: "mine-host" },
    { alias: "other", hostName: "other-host" },
  ],
  pluginRefs: ["a@mine-host", "b@other-host"],
};
const registeredOther = {
  binary: "codex",
  marketplaces: [{ alias: "other", hostName: "other-host" }],
  pluginRefs: [],
};

describe("forgetting a marketplace from a scope's records", () => {
  it("takes it, and the refs on its host name, out of each tool that registered it", async () => {
    const repo = new InMemoryManifestRepository();
    repo.records = new Map([
      [TOOL.claude, registeredBoth],
      [TOOL.codex, registeredOther],
    ]);
    const rules = recordsOf(repo);

    await forgetMarketplaceInRecords(rules, "mine");

    const claude = repo.records.get(TOOL.claude);
    expect(claude && rules.marketplaceOf(claude, "mine")).toBeUndefined();
    expect(claude && rules.marketplaceOf(claude, "other")).toBeDefined();
    expect(claude && rules.pluginRefsOf(claude)).toStrictEqual(["b@other-host"]);
  });

  it("leaves a tool that never registered it as it was", async () => {
    const repo = new InMemoryManifestRepository();
    repo.records = new Map([[TOOL.codex, registeredOther]]);

    await forgetMarketplaceInRecords(recordsOf(repo), "mine");

    expect(repo.records.get(TOOL.codex)).toBe(registeredOther);
  });
});
