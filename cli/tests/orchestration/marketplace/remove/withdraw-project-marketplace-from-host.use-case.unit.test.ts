import { describe, expect, it } from "vitest";
import { recordsOf } from "../../../../src/composition/contexts/installation.js";
import type {
  ProjectCleanFacts,
  WithdrawalStepRequest,
} from "../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import type { ProjectCleanPlan } from "../../../../src/contexts/installation/application/clean/project-clean-plan.js";
import { WithdrawProjectMarketplaceFromHost } from "../../../../src/orchestration/marketplace/remove/withdraw-project-marketplace-from-host.use-case.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  SYNTHETIC_TOOL,
  syntheticCatalog,
} from "../../../shared/testing/synthetic-tool-id.builder.js";

const PROJECT = "/project";
const RECORD = {
  binary: "claude",
  marketplaces: [
    { alias: "mine", hostName: "mine-host" },
    { alias: "other", hostName: "other-host" },
  ],
  pluginRefs: [],
};

function wired(withdrawn: ProjectCleanPlan["withdrawals"] | null) {
  const requests: WithdrawalStepRequest[] = [];
  const manifestRepo = new InMemoryManifestRepository();
  manifestRepo.records = new Map([[SYNTHETIC_TOOL, RECORD]]);
  const rules = recordsOf(manifestRepo);
  const useCase = new WithdrawProjectMarketplaceFromHost({
    plan: { execute: async () => (withdrawn === null ? null : planOf(withdrawn)) },
    withdrawFromHost: {
      execute: async (request) => {
        requests.push(request);
      },
    },
    facts: async () => FACTS,
    aiToolIds: [SYNTHETIC_TOOL],
    records: rules,
  });
  return { useCase, requests, manifestRepo, rules };
}

const FACTS: ProjectCleanFacts = {
  projectRoot: PROJECT,
  marketplaceScopes: new Map(),
  sharedSource: undefined,
  frameworkAlias: "framework",
  machine: { claimedRefs: async () => undefined, othersHolding: async () => [] },
  exclusive: (action) => action(),
  resolveCacheCandidate: async () => null,
};

const planOf = (withdrawals: ProjectCleanPlan["withdrawals"]): ProjectCleanPlan => ({
  tools: [],
  totalFileCount: 0,
  nativeRegistrations: [],
  withdrawals,
  nativeRefs: new Map(),
  userPlugins: [],
});

const withdrawals = [
  {
    tool: syntheticCatalog().aiProfile(SYNTHETIC_TOOL),
    registrations: RECORD,
    cacheRoot: undefined,
    refScopes: new Map(),
  },
];

describe("withdrawing a project marketplace from its hosts", () => {
  it("proves the withdrawal for that marketplace alone, and changes nothing until applied", async () => {
    const { useCase, requests, manifestRepo } = wired(withdrawals);

    await useCase.execute({ kind: "prove", name: "mine", projectRoot: PROJECT });

    expect(requests.map((r) => [r.kind, "marketplace" in r ? r.marketplace : undefined])).toEqual([
      ["prove-project-registrations", "mine"],
    ]);
    expect(manifestRepo.records.get(SYNTHETIC_TOOL)).toStrictEqual(RECORD);
  });

  it("withdraws it once applied, then forgets it from the record and keeps the others", async () => {
    const { useCase, requests, manifestRepo, rules } = wired(withdrawals);

    const proven = await useCase.execute({ kind: "prove", name: "mine", projectRoot: PROJECT });
    await useCase.execute({ kind: "withdraw", proven });

    expect(requests.map((r) => r.kind)).toEqual([
      "prove-project-registrations",
      "withdraw-project-registrations",
    ]);
    const record = manifestRepo.records.get(SYNTHETIC_TOOL);
    expect(record && rules.marketplaceOf(record, "mine")).toBeUndefined();
    expect(record && rules.marketplaceOf(record, "other")).toBeDefined();
  });

  it("does nothing when the project installed nothing", async () => {
    const { useCase, requests } = wired(null);

    const proven = await useCase.execute({ kind: "prove", name: "mine", projectRoot: PROJECT });
    await useCase.execute({ kind: "withdraw", proven });

    expect(requests).toEqual([]);
  });
});
