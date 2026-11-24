import { describe, expect, it } from "vitest";
import { hostPortsOver } from "../../../../../src/contexts/host-registration/application/host-ports-over.js";
import { WithdrawFromHost } from "../../../../../src/contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type { WithdrawalStepRequest } from "../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
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

describe("withdrawing a tool whose record holds only the claims on user plugins", () => {
  const claimsOnly = {
    tool: registeredTools().aiProfile(TOOL.claude),
    registrations: { pluginClaims: [{ plugin: "sample-plugin", dependents: ["/A"] }] },
    cacheRoot: undefined,
    claimedRefs: [],
  };

  const requests: [string, WithdrawalStepRequest][] = [
    ["check-user-hosts", { kind: "check-user-hosts", withdrawals: [claimsOnly] }],
    [
      "prove-user-registrations",
      { kind: "prove-user-registrations", withdrawals: [claimsOnly], projectRoot: "/A" },
    ],
    [
      "withdraw-user-registrations",
      {
        kind: "withdraw-user-registrations",
        withdrawals: [claimsOnly],
        resolveCacheCandidate: async () => null,
      },
    ],
  ];

  it.each(requests)(
    "asks nothing of a host it never registered with, on %s",
    async (_kind, request) => {
      const activator = new FakeHostActions({ available: false });
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

      await expect(withdraw.execute(request)).resolves.toBeUndefined();
    }
  );
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

describe("withdrawing one marketplace of a project", () => {
  const record = {
    binary: "claude",
    marketplaces: [
      { alias: "mine", hostName: "mine-host" },
      { alias: "other", hostName: "other-host" },
    ],
    pluginRefs: ["a@mine-host", "b@other-host"],
  };
  const facts = {
    projectRoot: "/project",
    marketplaceScopes: new Map([
      ["mine", "project" as const],
      ["other", "project" as const],
    ]),
    sharedSource: undefined,
    frameworkAlias: "framework",
    machine: { claimedRefs: async () => undefined, othersHolding: async () => [] },
    exclusive: <T>(action: () => Promise<T>) => action(),
    resolveCacheCandidate: async () => null,
  };

  it("unregisters that marketplace by its host name at project scope and leaves the others", async () => {
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
      kind: "withdraw-project-registrations",
      marketplace: "mine",
      withdrawals: [
        {
          tool: registeredTools().aiProfile(TOOL.claude),
          registrations: record,
          cacheRoot: undefined,
          refScopes: new Map(),
        },
      ],
      facts,
    });

    expect(activator.removedMarketplaces).toStrictEqual(["mine-host"]);
    expect(activator.removedMarketplaceScopes).toStrictEqual(["project"]);
    expect(activator.uninstalledPlugins).not.toContain("b@other-host");
  });
});
