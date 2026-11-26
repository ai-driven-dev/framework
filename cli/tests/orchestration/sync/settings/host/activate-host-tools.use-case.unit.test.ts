import { describe, expect, it, vi } from "vitest";
import type { SyncServerPlugins } from "../../../../../src/contexts/host-registration/application/server/sync-server-plugins.use-case.js";
import type { ClaimsView } from "../../../../../src/contexts/host-registration/contract/claims-view.js";
import type { SyncContext } from "../../../../../src/contexts/installation/application/sync/load-sync-context.use-case.js";
import type { ActivationRun } from "../../../../../src/orchestration/sync/settings/activate-native-tools.use-case.js";
import { ActivateHostTools } from "../../../../../src/orchestration/sync/settings/host/activate-host-tools.use-case.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { aManifest } from "../../../../contexts/installation/testing/manifest.builder.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_TOOL,
} from "../../../../shared/testing/synthetic-tool-id.builder.js";

type ServerSync = Pick<SyncServerPlugins, "execute">;

const NATIVE_RUN: ActivationRun = {
  outcomes: new Map(),
  served: [SECOND_SYNTHETIC_TOOL],
  binaryMissing: [{ toolId: SECOND_SYNTHETIC_TOOL, binary: "claude" }],
  warnings: ["from the native run"],
  errors: [],
};

const CLAIMS: ClaimsView = {
  recorded: undefined,
  machine: async () => undefined,
  machineKept: false,
  persistedProject: async () => undefined,
};

const FRAMEWORK = {
  name: "market",
  source: { kind: "local", path: "/market" },
  scope: "user",
} as const;

const installed: ServerSync["execute"] = async () => ({
  status: "installed",
  installed: ["aidd-dev"],
  problems: [],
});

function setup(options: { server?: ServerSync["execute"]; built?: string | null } = {}) {
  const logger = new CapturingLogger();
  const build = vi.fn(async () => (options.built === undefined ? "/built/market" : options.built));
  const server = vi.fn(options.server ?? installed);
  const native = { execute: vi.fn(async () => NATIVE_RUN) };
  const useCase = new ActivateHostTools({
    native,
    serverPlugins: { execute: server },
    buildMarketplace: { execute: build },
    logger,
    frameworkName: "market",
  });
  return { useCase, logger, build, server, native };
}

function request(
  options: { scope?: Scope; names?: string[]; marketplaces?: SyncContext["marketplaces"] } = {}
) {
  const context: SyncContext = {
    manifest: aManifest().withTool(SYNTHETIC_TOOL, []).build(),
    records: new Map(),
    marketplaces: options.marketplaces ?? [FRAMEWORK],
    toolIds: [SYNTHETIC_TOOL],
    save: async () => {},
  };
  return {
    projectRoot: "/project",
    context,
    claims: () => CLAIMS,
    scope: options.scope ?? "user",
    enablePlugins: options.names ?? [],
  };
}

describe("activating the tools a machine installed plugins for", () => {
  it("keeps what the tools with their own CLI reported", async () => {
    const { useCase } = setup();

    expect(await useCase.execute(request())).toMatchObject({
      binaryMissing: [{ toolId: SECOND_SYNTHETIC_TOOL, binary: "claude" }],
      warnings: ["from the native run"],
    });
  });

  it("counts a tool as served only when the server installed something for it", async () => {
    const served = setup();
    const idle = setup({
      server: async () => ({ status: "installed", installed: [], problems: [] }),
    });

    expect((await served.useCase.execute(request({ names: ["aidd-dev"] }))).served).toEqual([
      SECOND_SYNTHETIC_TOOL,
      SYNTHETIC_TOOL,
    ]);
    expect((await idle.useCase.execute(request())).served).toEqual([SECOND_SYNTHETIC_TOOL]);
  });

  it("has the framework plugins asked for installed from the tree built for the tool", async () => {
    const { useCase, server, build } = setup();

    await useCase.execute(request({ names: ["aidd-dev"] }));

    const [asked] = server.mock.calls[0] ?? [];
    expect(asked).toMatchObject({ toolId: SYNTHETIC_TOOL, names: ["aidd-dev"] });
    expect(build).not.toHaveBeenCalled();
    expect(await asked?.builtDir()).toBe("/built/market");
    expect(build.mock.calls).toEqual([[SYNTHETIC_TOOL, FRAMEWORK, "/project"]]);
  });

  it("never touches the server for a project, whose plugins the user's server does not hold", async () => {
    const { useCase, server } = setup();

    const run = await useCase.execute(request({ scope: "project", names: ["aidd-dev"] }));

    expect(server).not.toHaveBeenCalled();
    expect(run).toBe(NATIVE_RUN);
  });

  it("builds no tree when the machine has no framework marketplace", async () => {
    const { useCase, server, build } = setup();

    await useCase.execute(request({ names: ["aidd-dev"], marketplaces: [] }));

    const [asked] = server.mock.calls[0] ?? [];
    expect(await asked?.builtDir()).toBeNull();
    expect(build).not.toHaveBeenCalled();
  });

  it("warns of what the server left out, and keeps it in the run's warnings", async () => {
    const { useCase, logger } = setup({
      server: async () => ({
        status: "installed",
        installed: [],
        problems: ["'aidd-dev' was not installed"],
      }),
    });

    const run = await useCase.execute(request({ names: ["aidd-dev"] }));

    expect(run.warnings).toEqual(["from the native run", "'aidd-dev' was not installed"]);
    expect(logger.warnMessages).toContain("'aidd-dev' was not installed");
  });

  it("names the binary that is absent, as a host CLI does, and where to rerun when plugins were asked for", async () => {
    const { useCase, logger } = setup({
      server: async () => ({ status: "binary-missing", binary: "kimi" }),
    });

    const plain = await useCase.execute(request());
    const asked = await useCase.execute(request({ names: ["aidd-dev"] }));

    expect(plain.binaryMissing).toContainEqual({ toolId: SYNTHETIC_TOOL, binary: "kimi" });
    expect(asked.binaryMissing).toHaveLength(2);
    expect(logger.warnMessages).toEqual([
      "kimi CLI not found on PATH — skipping native plugin activation.",
      "kimi CLI not found on PATH — skipping native plugin activation. Rerun `aidd setup --global` once it is installed.",
    ]);
  });

  it("returns the server's failure as an error, with the tool it failed for", async () => {
    const { useCase } = setup({
      server: async () => {
        throw new Error("the server refused");
      },
    });

    const run = await useCase.execute(request({ names: ["aidd-dev"] }));

    expect(run.errors).toEqual([{ scope: SYNTHETIC_TOOL, error: new Error("the server refused") }]);
  });
});
