import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withdrawProjectRegistrations } from "../../../../../src/contexts/host-registration/application/withdraw/withdraw-project-registrations.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  WithdrawalDeps,
} from "../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

const HOST_NAME = "aidd-framework";
const REF = `plugin@${HOST_NAME}`;
const SOURCE: NativeMarketplaceSource = { kind: "registry", source: "/project/.aidd/built" };

function withdrawalFor(pluginRefs: readonly string[]): ProjectRegistrationWithdrawal {
  return {
    tool: registeredTools().aiProfile(TOOL.claude),
    registrations: {
      binary: "claude",
      marketplaces: [{ alias: HOST_NAME, hostName: HOST_NAME, provenance: SOURCE }],
      pluginRefs,
    },
    cacheRoot: "/cache",
    refScopes: new Map(),
  };
}

function factsAt(
  scope: Scope,
  machineClaims: ProjectCleanFacts["machineClaims"] = async () => undefined
): ProjectCleanFacts {
  return {
    projectRoot: "/project",
    marketplaceScopes: new Map([[HOST_NAME, scope]]),
    sharedSource: undefined,
    frameworkAlias: HOST_NAME,
    machineClaims,
    exclusive: (action) => action(),
    resolveCacheCandidate: async () => null,
  };
}

function depsOf(
  activator: FakeHostActions,
  logger: CapturingLogger,
  ports: Partial<WithdrawalDeps["ports"]> = {}
): WithdrawalDeps {
  return {
    fs: new InMemoryFileAdapter({}),
    logger,
    ports: {
      activators: new Map([["claude", activator]]),
      pluginRegistries: new Map(),
      marketplaceRegistries: new Map(),
      sources: new Map(),
      ...ports,
    },
  };
}

describe("withdrawing what a project registered through the host's own CLI", () => {
  it("unregisters a project-scope marketplace", async () => {
    const activator = new FakeHostActions({ available: true });

    await withdrawProjectRegistrations(
      depsOf(activator, new CapturingLogger()),
      [withdrawalFor([])],
      factsAt("project")
    );

    expect(activator.removedMarketplaces).toStrictEqual([HOST_NAME]);
  });

  it("leaves a machine-scope marketplace registered and says what survives", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    await withdrawProjectRegistrations(
      depsOf(activator, logger),
      [withdrawalFor([])],
      factsAt("user")
    );

    expect(activator.removedMarketplaces).toStrictEqual([]);
    expect(logger.warnMessages).toStrictEqual([
      `claude: '${HOST_NAME}' is shared by every project on this machine — left registered. Its entry survives at userConfigDir()/marketplaces.json, and its cache at: ${join("/cache", HOST_NAME)}.`,
    ]);
  });

  it("leaves a ref a machine claim owns enabled", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    await withdrawProjectRegistrations(
      depsOf(activator, logger),
      [withdrawalFor([REF])],
      factsAt("project", async () => [{ ref: REF, dependents: ["/project"] }])
    );

    expect(activator.uninstalledPlugins).toStrictEqual([]);
    expect(logger.warnMessages[0]).toBe(
      `claude: '${REF}' is an AIDD-owned machine plugin ref — left enabled; project claim detached after local clean.`
    );
  });

  it("leaves a ref enabled, naming why, when its host catalogue cannot be proven", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    await withdrawProjectRegistrations(
      depsOf(activator, logger),
      [withdrawalFor([REF])],
      factsAt("project")
    );

    expect(activator.uninstalledPlugins).toStrictEqual([]);
    expect(logger.warnMessages).toContain(
      `claude: '${REF}' left enabled because its current host catalogue is unproven. Catalogue '${HOST_NAME}': host source reader unavailable; reconcile manually.`
    );
  });

  it("names the registration and its cache it leaves when the CLI is not on the PATH", async () => {
    const activator = new FakeHostActions({ available: false });
    const logger = new CapturingLogger();

    await withdrawProjectRegistrations(
      depsOf(activator, logger),
      [withdrawalFor([])],
      factsAt("project")
    );

    expect(logger.warnMessages).toStrictEqual([
      `claude: registration left in place, the claude CLI is not on the PATH. Its cache survives at: ${join("/cache", HOST_NAME)}.`,
    ]);
  });

  it("asks the host's own registry which scope a ref sits at, and uninstalls there in one attempt", async () => {
    const activator = new FakeHostActions({
      available: true,
      installedAtScope: new Map([[REF, "user"]]),
    });
    const registry = {
      read: async () => ({
        location: "host plugins",
        refs: new Map([[REF, { enabled: true, scope: "user" as const }]]),
      }),
    };
    const sources = {
      read: async () => ({ location: "host", entries: new Map([[HOST_NAME, SOURCE]]) }),
    };

    await withdrawProjectRegistrations(
      depsOf(activator, new CapturingLogger(), {
        pluginRegistries: new Map([[TOOL.claude, registry]]),
        sources: new Map([[TOOL.claude, sources]]),
      }),
      [withdrawalFor([REF])],
      factsAt("project")
    );

    expect(activator.uninstalledPlugins).toStrictEqual([REF]);
    expect(activator.uninstalledPluginScopes).toStrictEqual(["user"]);
  });
});
