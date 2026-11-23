import { describe, expect, it, vi } from "vitest";
import type { WithdrawFromHost } from "../../../../src/contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type {
  ProveMarketplaceRemovalRequest,
  ProvenMarketplaceRemoval,
  WithdrawalRequest,
} from "../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import { withNativeRegistration } from "../../../../src/contexts/host-registration/domain/native-registration/native-host-profile.js";
import type { PurgeMarketplacePlugins } from "../../../../src/contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import {
  type MarketplaceRemovalHost,
  PurgeUserMarketplace,
  type PurgeUserMarketplaceDeps,
} from "../../../../src/orchestration/marketplace/remove/purge-user-marketplace.use-case.js";
import { syntheticToolProfile } from "../../../contexts/translate/testing/synthetic-tool-profile.builder.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import { hostWithdrawal } from "../../../shared/testing/host-withdrawal.builder.js";

type PurgeCommand = Parameters<PurgeMarketplacePlugins["execute"]>[0];

const REGISTRATION = { alias: "market", hostName: "aidd-market" };
const TARGET: Parameters<PurgeCommand["hostRemoval"]["plan"]>[0] = {
  tool: withNativeRegistration(syntheticToolProfile(), {}),
  registrations: {
    marketplaces: [REGISTRATION],
    pluginClaims: [
      { ref: "scoped@aidd-market", dependents: [] },
      { ref: "unscoped@aidd-market", dependents: [] },
    ],
  },
  registration: REGISTRATION,
};
const REQUEST = {
  marketplace: "market",
  projectRoot: "/project",
  whileLocked: async () => undefined,
  forget: async () => undefined,
};

/** Proves every catalogue removable with the claimed refs, and withdraws through a real host. */
class ProvingHost implements MarketplaceRemovalHost {
  readonly requests: WithdrawalRequest[] = [];
  private readonly real: WithdrawFromHost;
  constructor(private readonly activator: FakeHostActions) {
    this.real = hostWithdrawal(new Map());
  }
  execute(command: ProveMarketplaceRemovalRequest): Promise<ProvenMarketplaceRemoval>;
  execute(
    command: Extract<WithdrawalRequest, { kind: "withdraw-proven-marketplace" }>
  ): Promise<void>;
  async execute(command: WithdrawalRequest): Promise<unknown> {
    this.requests.push(command);
    if (command.kind === "withdraw-proven-marketplace") return this.real.execute(command);
    if (command.kind !== "prove-marketplace-removal") return undefined;
    return {
      hostName: command.registration.hostName,
      activator: this.activator,
      refs: command.claimedRefs,
      scopes: new Map([["scoped@aidd-market", "project"]]),
    };
  }
}

function purgerWith(purge: (command: PurgeCommand) => Promise<number>) {
  const records: PurgeUserMarketplaceDeps["records"] = {
    loadRecords: async () => new Map(),
    saveRecords: async () => undefined,
    marketplaceOf: vi.fn(() => REGISTRATION),
    holdersOf: vi.fn(() => []),
    claimedRefs: vi.fn(() => ["scoped@aidd-market", "unscoped@aidd-market"]),
    claimsOnMarketplace: vi.fn(() => []),
    withoutMarketplace: vi.fn((record) => ({ ...record, pluginClaims: [] })),
  };
  const activator = new FakeHostActions();
  const host = new ProvingHost(activator);
  const useCase = new PurgeUserMarketplace({
    purge: { execute: purge },
    host,
    home: "/home",
    records,
  });
  return { useCase, host, activator, records };
}

describe("purging what the machine holds for a user marketplace", () => {
  it("hands the purge the marketplace, the project and the machine home", async () => {
    const purge = vi.fn().mockResolvedValue(3);
    const { useCase } = purgerWith(purge);

    const removed = await useCase.execute(REQUEST);

    expect(purge).toHaveBeenCalledWith(
      expect.objectContaining({ marketplace: "market", projectRoot: "/project", home: "/home" })
    );
    expect(removed).toBe(3);
  });

  it("plans the host removal of a recorded catalogue for this project", async () => {
    const purge = vi.fn(async (command: PurgeCommand) => {
      await command.hostRemoval.plan(TARGET);
      return 0;
    });
    const { useCase, host, activator } = purgerWith(purge);

    await useCase.execute(REQUEST);

    expect(host.requests[0]).toEqual({
      kind: "prove-marketplace-removal",
      tool: TARGET.tool,
      registrations: TARGET.registrations,
      registration: REGISTRATION,
      projectRoot: "/project",
      claimedRefs: ["scoped@aidd-market", "unscoped@aidd-market"],
    });
    expect(activator.uninstalledPlugins).toStrictEqual([]);
  });

  it("uninstalls each planned ref at its host scope, the user scope when unnamed, then the catalogue", async () => {
    const calls: string[] = [];
    const purge = vi.fn(async (command: PurgeCommand) => {
      command.hostRemoval.apply(await command.hostRemoval.plan(TARGET));
      return 0;
    });
    const { useCase, activator } = purgerWith(purge);
    vi.spyOn(activator, "uninstallPlugin").mockImplementation((ref, scope) => {
      calls.push(`${ref}:${scope}`);
    });
    vi.spyOn(activator, "removeMarketplace").mockImplementation((name, scope) => {
      calls.push(`${name}:${scope}`);
    });

    await useCase.execute(REQUEST);

    expect(calls).toStrictEqual([
      "scoped@aidd-market:project",
      "unscoped@aidd-market:user",
      "aidd-market:user",
    ]);
  });

  it("reads and drops the catalogue in each record through the host registration's rules", async () => {
    let records: PurgeCommand["records"] | undefined;
    const { useCase, records: rules } = purgerWith(async (command) => {
      records = command.records;
      return 0;
    });

    await useCase.execute(REQUEST);
    const record = { marketplaces: [REGISTRATION] };

    expect(records?.registrationOf(record, "market")).toStrictEqual(REGISTRATION);
    expect(records?.claimsOn(record, "market")).toStrictEqual([]);
    expect(records?.withoutMarketplace(record, "market")).toStrictEqual({
      ...record,
      pluginClaims: [],
    });
    expect(rules.marketplaceOf).toHaveBeenCalledWith(record, "market");
    expect(rules.claimsOnMarketplace).toHaveBeenCalledWith(record, "market");
    expect(rules.withoutMarketplace).toHaveBeenCalledWith(record, "market");
  });

  it("passes the lock proof and the forgetting on to the purge", async () => {
    const whileLocked = vi.fn(async () => undefined);
    const forget = vi.fn(async () => undefined);
    const purge = vi.fn(async (command: PurgeCommand) => {
      await command.whileLocked();
      await command.forget();
      return 0;
    });
    const { useCase } = purgerWith(purge);

    await useCase.execute({ ...REQUEST, whileLocked, forget });

    expect(whileLocked).toHaveBeenCalledOnce();
    expect(forget).toHaveBeenCalledOnce();
  });
});
