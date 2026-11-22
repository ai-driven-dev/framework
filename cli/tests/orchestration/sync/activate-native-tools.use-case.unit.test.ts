import { describe, expect, it, vi } from "vitest";
import type { RegisterPluginWithHost } from "../../../src/contexts/host-registration/application/register/register-plugin-with-host.use-case.js";
import type { HostRegistrationOutcome } from "../../../src/contexts/host-registration/application/register/registration-outcome.js";
import type { ClaimsView } from "../../../src/contexts/host-registration/contract/claims-view.js";
import type { SyncContext } from "../../../src/contexts/installation/application/sync/load-sync-context.use-case.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { ActivateNativeTools } from "../../../src/orchestration/sync/activate-native-tools.use-case.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../shared/testing/synthetic-tool-id.builder.js";

type Register = Pick<RegisterPluginWithHost, "execute">;

const OUTCOME: HostRegistrationOutcome = {
  marketplaces: [],
  preservedMarketplaces: [],
  catalogClaims: [],
  pluginRefs: [],
  buildFailed: false,
};

const CLAIMS: ClaimsView = {
  recorded: undefined,
  machine: async () => undefined,
  machineKept: false,
  persistedProject: async () => undefined,
};

const MARKETPLACE = {
  name: "market",
  source: { kind: "local", path: "/market" },
  scope: "project",
} as const;

function plugin(name: string, marketplace: string): RecordedPlugin {
  return RecordedPlugin.fromJSON({
    name,
    source: { kind: "github", repo: `owner/${name}` },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "project",
    marketplace,
  });
}

function contextOf(
  manifest: SyncContext["manifest"],
  toolIds: SyncContext["toolIds"] = [SYNTHETIC_TOOL]
): SyncContext {
  return {
    manifest,
    marketplaces: [MARKETPLACE],
    toolIds,
    save: async () => {},
    machineManifest: async () => undefined,
    machineKept: false,
    persistedProject: async () => undefined,
  };
}

function activatorOf(register: Register["execute"]) {
  const logger = new CapturingLogger();
  const records = {
    refOnHostName: (name: string, hostName: string) => `${name}@${hostName}`,
    refsOnHosts: vi.fn(() => ["recorded@host-market"]),
  };
  const useCase = new ActivateNativeTools({
    registerPluginWithHost: { execute: register },
    buildMarketplace: { forTool: vi.fn() },
    logger,
    marketplace: { name: "framework", userCacheRoot: () => "/cache" },
    records,
  });
  return { useCase, logger, records };
}

const request = (context: SyncContext, scope: Scope = "project", enablePlugins: string[] = []) => ({
  projectRoot: "/project",
  context,
  claims: () => CLAIMS,
  scope,
  enablePlugins,
});

const emptyManifest = () => aManifest().withTool(SYNTHETIC_TOOL, []).build();

describe("ActivateNativeTools", () => {
  it("reports each tool the host activated, with what the host registered", async () => {
    const { useCase } = activatorOf(async () => ({ status: "activated", outcome: OUTCOME }));

    const run = await useCase.execute(request(contextOf(emptyManifest())));

    expect(run.outcomes).toEqual(new Map([[SYNTHETIC_TOOL, OUTCOME]]));
    expect(run).toMatchObject({ binaryMissing: [], warnings: [], errors: [] });
  });

  it("names a tool whose binary is absent and logs where to rerun only when plugins were asked for", async () => {
    const { useCase, logger } = activatorOf(async () => ({
      status: "binary-missing",
      binary: "claude",
    }));

    const plain = await useCase.execute(request(contextOf(emptyManifest())));
    const asked = await useCase.execute(
      request(contextOf(emptyManifest()), "user", ["framework-plugin"])
    );

    expect(plain.binaryMissing).toEqual([{ toolId: SYNTHETIC_TOOL, binary: "claude" }]);
    expect(plain.outcomes.size).toBe(0);
    expect(logger.warnMessages).toEqual([
      "claude CLI not found on PATH — skipping native plugin activation.",
      "claude CLI not found on PATH — skipping native plugin activation. Rerun `aidd setup --global` once it is installed.",
    ]);
    expect(asked.binaryMissing).toHaveLength(1);
  });

  it("reports nothing for a tool with no native activation", async () => {
    const { useCase } = activatorOf(async () => ({ status: "unconfigured" }));

    const run = await useCase.execute(request(contextOf(emptyManifest())));

    expect(run).toMatchObject({ binaryMissing: [], warnings: [], errors: [] });
    expect(run.outcomes.size).toBe(0);
  });

  it("returns a tool's failure as an error and goes on to the next tool", async () => {
    const { useCase } = activatorOf(async (command) => {
      if (command.toolId === SYNTHETIC_TOOL) throw new Error("activator crashed");
      return { status: "activated", outcome: OUTCOME };
    });

    const run = await useCase.execute(
      request(contextOf(emptyManifest(), [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL]))
    );

    expect(run.errors).toEqual([{ scope: SYNTHETIC_TOOL, error: new Error("activator crashed") }]);
    expect([...run.outcomes.keys()]).toEqual([SECOND_SYNTHETIC_TOOL]);
  });

  describe("the refs it asks the host to enable", () => {
    async function refsAsked(
      manifest: SyncContext["manifest"],
      scope: Scope,
      enablePlugins: string[]
    ) {
      let asked: string[] = [];
      const { useCase, records } = activatorOf(async (command) => {
        asked = command.refsToEnable(
          new Map([
            ["market", "host-market"],
            ["framework", "host-framework"],
          ])
        );
        return { status: "activated", outcome: OUTCOME };
      });
      await useCase.execute(request(contextOf(manifest), scope, enablePlugins));
      return { asked, records };
    }

    it("is each manifest plugin under the name its marketplace answers to at the host", async () => {
      const manifest = aManifest()
        .withTool(SYNTHETIC_TOOL, [])
        .withPlugin(SYNTHETIC_TOOL, plugin("kept", "market"))
        .withPlugin(SYNTHETIC_TOOL, plugin("orphan", "unregistered"))
        .build();

      const { asked } = await refsAsked(manifest, "project", []);

      expect(asked).toEqual(["kept@host-market"]);
    });

    it("adds the framework plugins a caller asked for, once", async () => {
      const manifest = aManifest()
        .withTool(SYNTHETIC_TOOL, [])
        .withPlugin(SYNTHETIC_TOOL, plugin("kept", "market"))
        .build();

      const { asked } = await refsAsked(manifest, "project", ["extra", "extra"]);

      expect(asked).toEqual(["kept@host-market", "extra@host-framework"]);
    });

    it("recovers the refs a machine-scope record holds, at user scope only", async () => {
      const manifest = emptyManifest();
      manifest.setNativeRegistrations(SYNTHETIC_TOOL, {
        binary: "claude",
        marketplaces: [],
        pluginRefs: ["recorded@host-market"],
      });

      const user = await refsAsked(manifest, "user", []);
      const project = await refsAsked(manifest, "project", []);

      expect(user.asked).toEqual(["recorded@host-market"]);
      expect(user.records.refsOnHosts).toHaveBeenCalledWith(
        expect.objectContaining({ pluginRefs: ["recorded@host-market"] }),
        ["host-market", "host-framework"]
      );
      expect(project.asked).toEqual([]);
    });
  });
});
