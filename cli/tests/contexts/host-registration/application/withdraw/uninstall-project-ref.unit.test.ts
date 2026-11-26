import { describe, expect, it } from "vitest";
import { hostPortsOver } from "../../../../../src/contexts/host-registration/application/host-ports-over.js";
import { uninstallProjectRef } from "../../../../../src/contexts/host-registration/application/withdraw/uninstall-project-ref.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  WithdrawalDeps,
} from "../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import { recordedRegistrations } from "../../../../../src/contexts/host-registration/domain/record/registration-record.js";
import type { HostPortMaps } from "../../../../../src/contexts/host-registration/ports/host-ports.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { machineFacts } from "../../testing/machine-facts.builder.js";

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
  machine: ProjectCleanFacts["machine"] = machineFacts(undefined)
): ProjectCleanFacts {
  return {
    projectRoot: "/project",
    marketplaceScopes: new Map([[HOST_NAME, scope]]),
    sharedSource: undefined,
    frameworkAlias: HOST_NAME,
    machine,
    exclusive: (action) => action(),
    resolveCacheCandidate: async () => null,
  };
}

function depsOf(
  activator: FakeHostActions,
  logger: CapturingLogger,
  ports: Partial<HostPortMaps> = {}
): WithdrawalDeps {
  return {
    fs: new InMemoryFileAdapter({}),
    logger,
    ports: hostPortsOver({
      activators: new Map([["claude", activator]]),
      pluginRegistries: new Map(),
      marketplaceRegistries: new Map(),
      sources: new Map(),
      ...ports,
    }),
  };
}

/** Uninstalls the one ref of the withdrawal, as the project clean does for each of its refs. */
async function uninstallRef(
  deps: WithdrawalDeps,
  withdrawals: readonly ProjectRegistrationWithdrawal[],
  facts: ProjectCleanFacts
): Promise<void> {
  const [withdrawal] = withdrawals;
  const registrations = recordedRegistrations(withdrawal.registrations);
  const activator = deps.ports.activator("claude");
  if (activator === undefined) throw new Error("no activator");
  for (const ref of registrations.pluginRefs)
    await uninstallProjectRef({ deps, activator, withdrawal, registrations, facts }, ref);
}

describe("uninstalling one plugin ref a project registered", () => {
  it("leaves a ref a machine claim owns enabled", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    await uninstallRef(
      depsOf(activator, logger),
      [withdrawalFor([REF])],
      factsAt("project", machineFacts([{ ref: REF, dependents: ["/project"] }]))
    );

    expect(activator.uninstalledPlugins).toStrictEqual([]);
    expect(logger.warnMessages[0]).toBe(
      `claude: '${REF}' is an AIDD-owned machine plugin ref — left enabled; project claim detached after local clean.`
    );
  });

  it("leaves a ref enabled, naming why, when its host catalogue cannot be proven", async () => {
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    await uninstallRef(depsOf(activator, logger), [withdrawalFor([REF])], factsAt("project"));

    expect(activator.uninstalledPlugins).toStrictEqual([]);
    expect(logger.warnMessages).toContain(
      `claude: '${REF}' left enabled because its current host catalogue is unproven. Catalogue '${HOST_NAME}': host source reader unavailable; reconcile manually.`
    );
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

    await uninstallRef(
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
