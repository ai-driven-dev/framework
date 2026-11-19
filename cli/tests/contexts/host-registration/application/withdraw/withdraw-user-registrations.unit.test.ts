import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  proveUserRegistrations,
  withdrawUserRegistrations,
} from "../../../../../src/contexts/host-registration/application/withdraw/withdraw-user-registrations.js";
import type {
  UserRegistrationWithdrawal,
  WithdrawalDeps,
} from "../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

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
  sources: WithdrawalDeps["ports"]["sources"] = new Map()
): WithdrawalDeps {
  return {
    fs: new InMemoryFileAdapter({}),
    logger: new CapturingLogger(),
    ports: {
      activators: new Map([["claude", activator]]),
      pluginRegistries: new Map(),
      marketplaceRegistries: new Map(),
      sources,
    },
  };
}

describe("withdrawing every user-scope registration through the host's own CLI", () => {
  it("uninstalls each claimed ref, then unregisters each marketplace, all at user scope", async () => {
    const activator = new FakeHostActions({ available: true });

    await withdrawUserRegistrations(depsOf(activator), [withdrawal]);

    expect(activator.uninstalledPlugins).toStrictEqual([REF]);
    expect(activator.uninstalledPluginScopes).toStrictEqual(["user"]);
    expect(activator.removedMarketplaces).toStrictEqual([HOST_NAME]);
  });

  it("refuses, naming what an absent binary leaves standing, before undoing anything", async () => {
    const activator = new FakeHostActions({ available: false });

    await expect(withdrawUserRegistrations(depsOf(activator), [withdrawal])).rejects.toThrow(
      `claude: registration left in place, the claude CLI is not on the PATH. It would have unregistered 1 marketplace(s) and 1 plugin ref(s). Its cache survives at: ${join("/cache", HOST_NAME)}. User clean refused; canonical claims retained.`
    );
    expect(activator.removedMarketplaces).toStrictEqual([]);
  });

  it("refuses once the host will not uninstall a claimed ref, leaving every marketplace registered", async () => {
    const activator = new FakeHostActions({ available: true, failOnUninstall: [REF] });

    await expect(withdrawUserRegistrations(depsOf(activator), [withdrawal])).rejects.toThrow(
      `claude: user clean refused after plugin uninstall '${REF}' failed; canonical claims retained.`
    );
    expect(activator.removedMarketplaces).toStrictEqual([]);
  });

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
