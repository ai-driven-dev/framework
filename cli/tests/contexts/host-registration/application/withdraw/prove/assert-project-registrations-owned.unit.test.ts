import { describe, expect, it } from "vitest";
import { assertProjectRegistrationsOwned } from "../../../../../../src/contexts/host-registration/application/withdraw/prove/assert-project-registrations-owned.js";
import type {
  ProjectCleanFacts,
  ProjectRegistrationWithdrawal,
  WithdrawalDeps,
} from "../../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import type { NativeMarketplaceSource } from "../../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { Scope } from "../../../../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { machineFacts } from "../../../testing/machine-facts.builder.js";

const HOST_NAME = "aidd-framework";
const REF = `plugin@${HOST_NAME}`;
const SOURCE: NativeMarketplaceSource = { kind: "registry", source: "/project/.aidd/built" };

const withdrawal: ProjectRegistrationWithdrawal = {
  tool: registeredTools().aiProfile(TOOL.claude),
  registrations: {
    binary: "claude",
    marketplaces: [{ alias: HOST_NAME, hostName: HOST_NAME, provenance: SOURCE }],
    pluginRefs: [REF],
  },
  cacheRoot: undefined,
  refScopes: new Map(),
};

function factsAt(scope: Scope): ProjectCleanFacts {
  return {
    projectRoot: "/project",
    marketplaceScopes: new Map([[HOST_NAME, scope]]),
    sharedSource: undefined,
    frameworkAlias: HOST_NAME,
    machine: machineFacts(undefined),
    exclusive: (action) => action(),
    resolveCacheCandidate: async () => null,
  };
}

function depsOf({
  available = true,
  catalogue = new Map<string, NativeMarketplaceSource>([[HOST_NAME, SOURCE]]),
  refs = new Map([[REF, { enabled: true, scope: "project" as const }]]),
} = {}): WithdrawalDeps {
  return {
    fs: new InMemoryFileAdapter({}),
    logger: new CapturingLogger(),
    ports: {
      activators: new Map([["claude", new FakeHostActions({ available })]]),
      pluginRegistries: new Map([
        [TOOL.claude, { read: async () => ({ location: "host plugins", refs }) }],
      ]),
      marketplaceRegistries: new Map(),
      sources: new Map([
        [TOOL.claude, { read: async () => ({ location: "host", entries: catalogue }) }],
      ]),
    },
  };
}

describe("proving a project clean only touches what the host shows this project's own", () => {
  it("accepts a project catalogue the host still shows owned", async () => {
    await expect(
      assertProjectRegistrationsOwned(depsOf(), [withdrawal], factsAt("project"))
    ).resolves.toBeUndefined();
  });

  it("refuses a project catalogue the host no longer lists", async () => {
    await expect(
      assertProjectRegistrationsOwned(
        depsOf({ catalogue: new Map() }),
        [withdrawal],
        factsAt("project")
      )
    ).rejects.toThrow(
      `claude: catalogue '${HOST_NAME}' is absent on the host; clean refused until manual reconciliation.`
    );
  });

  it("refuses a catalogue that holds a ref another owner enabled", async () => {
    const refs = new Map([
      [REF, { enabled: true, scope: "project" as const }],
      [`foreign@${HOST_NAME}`, { enabled: true, scope: "project" as const }],
    ]);

    await expect(
      assertProjectRegistrationsOwned(depsOf({ refs }), [withdrawal], factsAt("project"))
    ).rejects.toThrow(`Catalogue '${HOST_NAME}' includes foreign host ref 'foreign@${HOST_NAME}'`);
  });

  it("leaves a machine-scope catalogue alone", async () => {
    await expect(
      assertProjectRegistrationsOwned(
        depsOf({ catalogue: new Map() }),
        [withdrawal],
        factsAt("user")
      )
    ).resolves.toBeUndefined();
  });

  it("skips a tool whose CLI is not on the PATH", async () => {
    await expect(
      assertProjectRegistrationsOwned(
        depsOf({ available: false, catalogue: new Map() }),
        [withdrawal],
        factsAt("project")
      )
    ).resolves.toBeUndefined();
  });
});
