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
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const HOST_NAME = "aidd-framework";
const _REF = `plugin@${HOST_NAME}`;
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
});
