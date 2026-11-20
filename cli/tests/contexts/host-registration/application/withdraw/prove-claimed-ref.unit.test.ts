import { describe, expect, it } from "vitest";
import { proveClaimedRef } from "../../../../../src/contexts/host-registration/application/withdraw/prove-claimed-ref.js";
import type { WithdrawalDeps } from "../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const HOST_NAME = "aidd-framework";
const REF = `plugin@${HOST_NAME}`;
const SOURCE: NativeMarketplaceSource = { kind: "registry", source: "/project/.aidd/built" };
const CLAIM = { tool: TOOL.claude, ref: REF };
const RECORD = {
  binary: "claude",
  marketplaces: [{ alias: HOST_NAME, hostName: HOST_NAME, provenance: SOURCE }],
  pluginRefs: [REF],
};

interface Host {
  readonly available?: boolean;
  readonly refs?: ReadonlyMap<string, { enabled: boolean; scope: Scope }>;
  readonly catalogue?: ReadonlyMap<string, NativeMarketplaceSource>;
}

function depsOf({
  available = true,
  refs = new Map([[REF, { enabled: true, scope: "project" as const }]]),
  catalogue = new Map([[HOST_NAME, SOURCE]]),
}: Host = {}): WithdrawalDeps {
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

const prove = (deps: WithdrawalDeps, registrationData = RECORD) =>
  proveClaimedRef(deps, { registrationData, claim: CLAIM, projectRoot: "/project" });

describe("proving a claimed ref is safe to remove", () => {
  it("returns the ref with the scope the host enabled it at", async () => {
    const proven = await prove(depsOf());

    expect(proven).toMatchObject({ ref: REF, scope: "project" });
  });

  it("refuses when the host CLI is not on the PATH", async () => {
    await expect(prove(depsOf({ available: false }))).rejects.toThrow(
      `Cannot prove or remove AIDD-owned native ref '${REF}': claude CLI or host registry is unavailable.`
    );
  });

  it("refuses a ref the host does not show enabled", async () => {
    await expect(prove(depsOf({ refs: new Map() }))).rejects.toThrow(
      `Cannot prove native ref '${REF}' is still enabled on claude; no host mutation made.`
    );
  });

  it("refuses a ref no recorded catalogue owns", async () => {
    await expect(prove(depsOf(), { ...RECORD, marketplaces: [] })).rejects.toThrow(
      `Native ref '${REF}' has no exact canonical catalogue source proof; removal refused.`
    );
  });

  it("names why a catalogue whose host source differs is refused", async () => {
    const foreign = new Map([[HOST_NAME, { kind: "registry" as const, source: "/foreign" }]]);

    await expect(prove(depsOf({ catalogue: foreign }))).rejects.toThrow(/source differs/);
  });
});
