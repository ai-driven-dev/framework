import { describe, expect, it } from "vitest";
import { hostPortsOver } from "../../../../../../src/contexts/host-registration/application/host-ports-over.js";
import { assertProjectSource } from "../../../../../../src/contexts/host-registration/application/withdraw/prove/assert-project-source.js";
import type {
  ProjectSourceRequest,
  WithdrawalDeps,
} from "../../../../../../src/contexts/host-registration/application/withdraw/withdrawal.js";
import { RegistrationRefusedError } from "../../../../../../src/contexts/host-registration/domain/host-registration.error.js";
import type { NativeMarketplaceSource } from "../../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { HostPluginRegistry } from "../../../../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import type { Scope } from "../../../../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const HOST_NAME = "aidd-framework";
const REF = `plugin@${HOST_NAME}`;
const SOURCE: NativeMarketplaceSource = { kind: "registry", source: "/project/.aidd/built" };

function depsOf(
  options: {
    available?: boolean;
    sourceEntries?: Map<string, NativeMarketplaceSource>;
    refs?: Map<string, { enabled: boolean; scope?: Scope }>;
  } = {}
): WithdrawalDeps {
  const registry: HostPluginRegistry = {
    read: async () => ({ location: "host plugins", refs: options.refs }),
  };
  return {
    fs: new InMemoryFileAdapter({}),
    logger: new CapturingLogger(),
    ports: hostPortsOver({
      activators: new Map([
        ["claude", new FakeHostActions({ available: options.available ?? true })],
      ]),
      pluginRegistries: new Map([[TOOL.claude, registry]]),
      marketplaceRegistries: new Map(),
      sources: new Map([
        [TOOL.claude, { read: async () => ({ location: "host", entries: options.sourceEntries }) }],
      ]),
    }),
  };
}

function commandOf(recorded = true): ProjectSourceRequest {
  return {
    tool: registeredTools().aiProfile(TOOL.claude),
    plugin: { name: "plugin", marketplace: HOST_NAME, scope: "project" },
    projectRoot: "/project",
    registrations: {
      binary: "claude",
      marketplaces: recorded ? [{ alias: HOST_NAME, hostName: HOST_NAME, provenance: SOURCE }] : [],
      pluginRefs: [REF],
    },
    isMachineOwned: async () => false,
  };
}

describe("proving a project removal safe before any change", () => {
  it("does nothing when the host CLI is not on the PATH", async () => {
    await expect(
      assertProjectSource(depsOf({ available: false }), commandOf())
    ).resolves.toBeUndefined();
  });

  it("refuses a plugin whose catalogue has no recorded source", async () => {
    await expect(assertProjectSource(depsOf(), commandOf(false))).rejects.toThrow(
      /no recorded native catalogue source/
    );
  });

  it("refuses with a typed registration refusal, not a bare error", async () => {
    await expect(assertProjectSource(depsOf(), commandOf(false))).rejects.toBeInstanceOf(
      RegistrationRefusedError
    );
  });

  it("refuses a catalogue source the host does not show owned", async () => {
    await expect(
      assertProjectSource(depsOf({ sourceEntries: new Map() }), commandOf())
    ).rejects.toThrow(/has unproven host source/);
    await expect(
      assertProjectSource(
        depsOf({
          sourceEntries: new Map([[HOST_NAME, { kind: "registry", source: "/elsewhere" }]]),
        }),
        commandOf()
      )
    ).rejects.toThrow(/differs from AIDD's recorded source/);
  });

  it("refuses a ref the host registry does not show enabled at an exact scope", async () => {
    await expect(
      assertProjectSource(
        depsOf({
          sourceEntries: new Map([[HOST_NAME, SOURCE]]),
          refs: new Map([[REF, { enabled: true }]]),
        }),
        commandOf()
      )
    ).rejects.toThrow(/not provably enabled with an exact host scope/);
  });

  it("accepts an owned source and a ref enabled at an exact scope", async () => {
    await expect(
      assertProjectSource(
        depsOf({
          sourceEntries: new Map([[HOST_NAME, SOURCE]]),
          refs: new Map([[REF, { enabled: true, scope: "project" }]]),
        }),
        commandOf()
      )
    ).resolves.toBeUndefined();
  });
});
