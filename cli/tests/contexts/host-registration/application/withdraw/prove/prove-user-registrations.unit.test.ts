import { describe, expect, it } from "vitest";
import { hostPortsOver } from "../../../../../../src/contexts/host-registration/application/host-ports-over.js";
import { proveUserRegistrations } from "../../../../../../src/contexts/host-registration/application/withdraw/prove/prove-user-registrations.js";
import type {
  UserRegistrationWithdrawal,
  WithdrawalDeps,
} from "../../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import type { HostPortMaps } from "../../../../../../src/contexts/host-registration/ports/host-ports.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const HOST_NAME = "aidd-framework";
const REF = `plugin@${HOST_NAME}`;

const withdrawal: UserRegistrationWithdrawal = {
  tool: registeredTools().aiProfile(TOOL.claude),
  registrations: {
    binary: "claude",
    marketplaces: [{ alias: HOST_NAME, hostName: HOST_NAME }],
    pluginRefs: [REF],
  },
  cacheRoot: "/cache",
  claimedRefs: [REF],
};

function depsOf(
  activator: FakeHostActions,
  sources: HostPortMaps["sources"] = new Map()
): WithdrawalDeps {
  return {
    fs: new InMemoryFileAdapter({}),
    logger: new CapturingLogger(),
    ports: hostPortsOver({
      activators: new Map([["claude", activator]]),
      pluginRegistries: new Map(),
      marketplaceRegistries: new Map(),
      sources,
    }),
  };
}

describe("proving a user clean before the first host change", () => {
  it("refuses a user clean whose catalogue the host no longer lists, before any host change", async () => {
    const activator = new FakeHostActions({ available: true });
    const sources = new Map([
      [TOOL.claude, { read: async () => ({ location: "host", entries: new Map() }) }],
    ]);

    await expect(
      proveUserRegistrations(depsOf(activator, sources), [withdrawal], "/project")
    ).rejects.toThrow("claude: catalogue source unproven.");
    expect(activator.removedMarketplaces).toStrictEqual([]);
  });
});
