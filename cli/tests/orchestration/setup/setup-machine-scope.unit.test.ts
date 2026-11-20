import { describe, expect, it, vi } from "vitest";
import { remoteFrameworkSource } from "../../../src/contexts/distribution/contract/framework-source.js";
import type { NativeActivationReport } from "../../../src/contexts/installation/application/install/install-ai-tool.js";
import { SetupFlow } from "../../../src/orchestration/setup/setup-flow.js";
import { SetupMachineScope } from "../../../src/orchestration/setup/setup-machine-scope.js";
import { flowTools, TOOL } from "../../shared/testing/registered-tools.builder.js";

const PROJECT = "/project";
const SOURCE = remoteFrameworkSource();
const ACTIVATION: NativeActivationReport = {
  activated: [TOOL.claude],
  binaryMissing: [],
  warnings: [],
  failed: false,
  errors: [],
};

function flow(pluginNames: string[] = ["alpha"]): SetupFlow {
  return new SetupFlow({
    ...flowTools(),
    supportsUserScopeActivation: () => true,
    projectRoot: PROJECT,
    source: SOURCE,
    aiTools: [TOOL.claude],
    pluginMode: "named",
    pluginNames,
    scope: "user",
  });
}

function build(initialized: boolean) {
  const calls: string[] = [];
  const record = <T>(name: string, value: T) =>
    vi.fn(async (..._args: unknown[]) => {
      calls.push(name);
      return value;
    });
  const configure = {
    whileLocked: async <T>(action: () => Promise<T>) => {
      calls.push("lock");
      return action();
    },
    initialize: record("initialize", initialized),
    registerTools: record("registerTools", undefined),
  };
  const resolveSource = { execute: record("resolveSource", SOURCE) };
  const register = record("register", undefined);
  const sync = vi.fn(async (_options: unknown) => {
    calls.push("sync");
    return ACTIVATION;
  });
  const installPlugins = {
    execute: vi.fn(async (_options: unknown) => {
      calls.push("installPlugins");
      return { plugins: ["alpha"] };
    }),
  };
  const useCase = new SetupMachineScope(configure, resolveSource, register, sync, installPlugins);
  return { useCase, calls, register, sync, installPlugins, configure };
}

describe("SetupMachineScope", () => {
  it("resolves the source first, then works under the machine lock in order", async () => {
    const { useCase, calls } = build(true);

    await useCase.execute(flow());

    expect(calls).toEqual([
      "resolveSource",
      "lock",
      "initialize",
      "register",
      "registerTools",
      "installPlugins",
      "sync",
    ]);
  });

  it("registers the resolved source, installs the named plugins and enables them machine-wide", async () => {
    const { useCase, register, installPlugins, sync, configure } = build(true);
    const f = flow();

    const result = await useCase.execute(f);

    expect(register).toHaveBeenCalledWith(f, SOURCE);
    expect(configure.registerTools).toHaveBeenCalledWith([TOOL.claude]);
    expect(installPlugins.execute).toHaveBeenCalledWith({
      projectRoot: PROJECT,
      toolIds: [TOOL.claude],
      mode: "named",
      pluginNames: ["alpha"],
    });
    expect(sync).toHaveBeenCalledWith({
      projectRoot: PROJECT,
      toolIds: [TOOL.claude],
      enablePlugins: ["alpha"],
    });
    expect(result).toEqual({
      kind: "initialized",
      install: { results: [] },
      activation: ACTIVATION,
      context: undefined,
      globalPlugins: ["alpha"],
    });
  });

  it("says up-to-date when the machine record was already there", async () => {
    const { useCase } = build(false);

    expect((await useCase.execute(flow())).kind).toBe("up-to-date");
  });
});
