import { describe, expect, it } from "vitest";
import { narrowToMarketplace } from "../../../../../src/contexts/host-registration/application/withdraw/narrow-to-marketplace.js";
import type { ProjectRegistrationWithdrawal } from "../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

function withdrawalOf(
  marketplaces: Array<{ alias: string; hostName: string }>,
  pluginRefs: string[]
): ProjectRegistrationWithdrawal {
  return {
    tool: registeredTools().aiProfile(TOOL.claude),
    registrations: { binary: "claude", marketplaces, pluginRefs },
    cacheRoot: undefined,
    refScopes: new Map(),
  };
}

const BOTH = withdrawalOf(
  [
    { alias: "mine", hostName: "mine-host" },
    { alias: "other", hostName: "other-host" },
  ],
  ["a@mine-host", "b@other-host"]
);

describe("narrowing withdrawals to one marketplace", () => {
  it("keeps that marketplace and the refs on its host name", () => {
    const [narrowed] = narrowToMarketplace([BOTH], "mine");

    expect(narrowed.registrations).toStrictEqual({
      binary: "claude",
      marketplaces: [{ alias: "mine", hostName: "mine-host" }],
      pluginRefs: ["a@mine-host"],
    });
  });

  it("drops a tool that never registered it", () => {
    expect(narrowToMarketplace([BOTH], "absent")).toStrictEqual([]);
  });

  it("keeps every withdrawal whole when no marketplace is named", () => {
    expect(narrowToMarketplace([BOTH], undefined)).toStrictEqual([BOTH]);
  });
});
