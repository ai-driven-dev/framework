import { describe, expect, it } from "vitest";
import { uninstallPlugin } from "../../../../../src/contexts/host-registration/application/withdraw/uninstall-plugin.js";
import type {
  WithdrawalDeps,
  WithdrawFromHostCommand,
} from "../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const HOST_NAME = "aidd-framework";
const REF = `plugin@${HOST_NAME}`;
const SOURCE: NativeMarketplaceSource = { kind: "registry", source: "/project/.aidd/built" };

function depsOf(
  activator: FakeHostActions,
  logger: CapturingLogger,
  onHost: { readonly ref: string; readonly scope: Scope } = {
    ref: REF,
    scope: "project",
  }
): WithdrawalDeps {
  return {
    fs: new InMemoryFileAdapter({}),
    logger,
    ports: {
      activators: new Map([["claude", activator]]),
      pluginRegistries: new Map([
        [
          TOOL.claude,
          {
            read: async () => ({
              location: "host plugins",
              refs: new Map([[onHost.ref, { enabled: true, scope: onHost.scope }]]),
            }),
          },
        ],
      ]),
      marketplaceRegistries: new Map(),
      sources: new Map([
        [
          TOOL.claude,
          {
            read: async () => ({
              location: "host",
              entries: new Map([[HOST_NAME, SOURCE]]),
            }),
          },
        ],
      ]),
    },
  };
}

function commandOf(
  claims: Partial<WithdrawFromHostCommand["claims"]> = {},
  registrations: WithdrawFromHostCommand["registrations"] = {
    binary: "claude",
    marketplaces: [{ alias: HOST_NAME, hostName: HOST_NAME, provenance: SOURCE }],
    pluginRefs: [REF],
  }
): WithdrawFromHostCommand {
  return {
    tool: registeredTools().aiProfile(TOOL.claude),
    plugin: { name: "plugin", marketplace: HOST_NAME, scope: "project" },
    projectRoot: "/project",
    registrations,
    claims: {
      isMachineOwned: async () => false,
      guardMessage: async () => undefined,
      resolveCacheCandidate: async () => null,
      ...claims,
    },
    pluginCacheRoot: undefined,
  };
}

describe("uninstalling a plugin through the host's own CLI", () => {
  it("uninstalls the ref and confirms it", async () => {
    const activator = new FakeHostActions({ available: true });

    const confirmed = await uninstallPlugin(depsOf(activator, new CapturingLogger()), commandOf());

    expect(confirmed).toBe(true);
    expect(activator.uninstalledPlugins).toStrictEqual([REF]);
  });

  it("names what it leaves when the CLI is not on the PATH", async () => {
    const logger = new CapturingLogger();

    const confirmed = await uninstallPlugin(
      depsOf(new FakeHostActions({ available: false }), logger),
      commandOf()
    );

    expect(confirmed).toBe(false);
    expect(logger.warnMessages).toStrictEqual([
      `claude CLI not found on PATH — 'plugin@${HOST_NAME}' was not uninstalled from the host; its ref may remain enabled after local removal.`,
    ]);
  });

  it("leaves an AIDD-owned machine ref enabled", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    const confirmed = await uninstallPlugin(
      depsOf(activator, logger),
      commandOf({ isMachineOwned: async () => true })
    );

    expect(confirmed).toBeUndefined();
    expect(activator.uninstalledPlugins).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([
      `claude: '${REF}' is an AIDD-owned machine plugin ref — left enabled; this project's claim detaches after local removal.`,
    ]);
  });

  it("leaves a ref enabled when another project still needs it", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    const confirmed = await uninstallPlugin(
      depsOf(activator, logger),
      commandOf({ guardMessage: async () => "kept for /other" })
    );

    expect(confirmed).toBeUndefined();
    expect(activator.uninstalledPlugins).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual(["kept for /other"]);
  });

  it("warns, not confirms, when the host refuses every scope", async () => {
    const logger = new CapturingLogger();

    const confirmed = await uninstallPlugin(
      depsOf(new FakeHostActions({ available: true, failOnUninstall: [REF] }), logger),
      commandOf()
    );

    expect(confirmed).toBe(false);
    expect(logger.warnMessages[0]).toMatch(/plugin uninstall 'plugin@aidd-framework' failed/);
  });

  it("names the ref it left when the CLI vanishes after every guard has passed", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    const confirmed = await uninstallPlugin(
      depsOf(activator, logger),
      commandOf({
        guardMessage: async () => {
          activator.available = false;
          return undefined;
        },
      })
    );

    expect(confirmed).toBe(false);
    expect(activator.uninstalledPlugins).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([
      `claude CLI not found on PATH — '${REF}' was not uninstalled from claude's own plugin registry and may still be enabled there.`,
    ]);
  });

  it("looks the ref up by the host's own name for the marketplace, never the alias", async () => {
    const hostRef = "plugin@upstream";
    const activator = new FakeHostActions({
      available: true,
      installedAtScope: new Map([[hostRef, "user"]]),
    });

    const confirmed = await uninstallPlugin(
      depsOf(activator, new CapturingLogger(), { ref: hostRef, scope: "user" }),
      commandOf(
        {},
        {
          binary: "claude",
          marketplaces: [{ alias: HOST_NAME, hostName: "upstream", provenance: SOURCE }],
          pluginRefs: [hostRef],
        }
      )
    );

    expect(confirmed).toBe(true);
    expect(activator.uninstalledPlugins).toStrictEqual([hostRef]);
    expect(activator.uninstalledPluginScopes).toStrictEqual(["user"]);
  });
});
