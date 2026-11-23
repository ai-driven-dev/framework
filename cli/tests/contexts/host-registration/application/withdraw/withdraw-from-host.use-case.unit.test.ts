import { describe, expect, it } from "vitest";
import { hostPortsOver } from "../../../../../src/contexts/host-registration/application/host-ports-over.js";
import { WithdrawFromHost } from "../../../../../src/contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const HOST_NAME = "aidd-framework";
const REF = `plugin@${HOST_NAME}`;

describe("withdrawing a user-scope registration", () => {
  it("hands the host's ports to the user step, which unregisters the marketplace", async () => {
    const activator = new FakeHostActions({ available: true });
    const withdraw = new WithdrawFromHost(
      new InMemoryFileAdapter({}),
      new CapturingLogger(),
      hostPortsOver({
        activators: new Map([["claude", activator]]),
        pluginRegistries: new Map(),
        marketplaceRegistries: new Map(),
        sources: new Map(),
      })
    );

    await withdraw.execute({
      kind: "withdraw-user-registrations",
      withdrawals: [
        {
          tool: registeredTools().aiProfile(TOOL.claude),
          registrations: {
            binary: "claude",
            marketplaces: [{ alias: HOST_NAME, hostName: HOST_NAME }],
            pluginRefs: [],
          },
          cacheRoot: undefined,
          claimedRefs: [],
        },
      ],
      resolveCacheCandidate: async (root, segment) => `${root}/${segment}`,
    });

    expect(activator.removedMarketplaces).toStrictEqual([HOST_NAME]);
  });
});

describe("removing a plugin from its host", () => {
  it("proves the host's catalogue source is this project's own before it uninstalls anything", async () => {
    const activator = new FakeHostActions({ available: true });
    const foreign = { kind: "registry" as const, source: "/foreign/source" };
    const withdraw = new WithdrawFromHost(
      new InMemoryFileAdapter({}),
      new CapturingLogger(),
      hostPortsOver({
        activators: new Map([["claude", activator]]),
        pluginRegistries: new Map(),
        marketplaceRegistries: new Map(),
        sources: new Map([
          [
            TOOL.claude,
            { read: async () => ({ location: "host", entries: new Map([[HOST_NAME, foreign]]) }) },
          ],
        ]),
      })
    );

    await expect(
      withdraw.execute({
        kind: "withdraw-plugin",
        tool: registeredTools().aiProfile(TOOL.claude),
        plugin: { name: "plugin", marketplace: HOST_NAME, scope: "project" },
        projectRoot: "/project",
        registrations: {
          binary: "claude",
          marketplaces: [
            {
              alias: HOST_NAME,
              hostName: HOST_NAME,
              provenance: { kind: "registry", source: "/aidd/old-source" },
            },
          ],
          pluginRefs: [REF],
        },
        claims: {
          isMachineOwned: async () => false,
          guardMessage: async () => undefined,
          resolveCacheCandidate: async () => null,
        },
        pluginCacheRoot: undefined,
      })
    ).rejects.toThrow(/source differs/);
    expect(activator.uninstalledPlugins).toStrictEqual([]);
  });
});
