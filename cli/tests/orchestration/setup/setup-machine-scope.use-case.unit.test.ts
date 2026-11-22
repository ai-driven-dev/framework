import { describe, expect, it, vi } from "vitest";
import { remoteFrameworkSource } from "../../../src/contexts/distribution/contract/framework-source.js";
import type {
  ConfigureMachineScope,
  ConfigureMachineScopeRequest,
} from "../../../src/contexts/installation/application/install/configure-machine-scope.use-case.js";
import type { NativeActivationReport } from "../../../src/contexts/installation/application/install/install-ai-tool.use-case.js";
import { SetupFlow } from "../../../src/orchestration/domain/setup-flow.model.js";
import { SetupMachineScope } from "../../../src/orchestration/setup/setup-machine-scope.use-case.js";
import {
  SYNTHETIC_TOOL,
  syntheticFlowTools,
} from "../../shared/testing/synthetic-tool-id.builder.js";

const PROJECT = "/project";
const SOURCE = remoteFrameworkSource();
const ACTIVATION: NativeActivationReport = {
  activated: [SYNTHETIC_TOOL],
  binaryMissing: [],
  warnings: [],
  failed: false,
  errors: [],
};

function flow(pluginNames: string[] = ["alpha"]): SetupFlow {
  return new SetupFlow({
    ...syntheticFlowTools(),
    supportsUserScopeActivation: () => true,
    projectRoot: PROJECT,
    source: SOURCE,
    aiTools: [SYNTHETIC_TOOL],
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
  const configuredTools: string[] = [];
  const configure: Pick<ConfigureMachineScope, "execute"> = {
    execute: <T>({ toolIds, whileHeld }: ConfigureMachineScopeRequest<T>) => {
      calls.push("configure");
      configuredTools.push(...toolIds);
      return whileHeld(initialized);
    },
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
  const useCase = new SetupMachineScope({
    configureMachineScope: configure,
    resolveSource,
    register,
    syncMachineScope: sync,
    installPlugins,
  });
  return { useCase, calls, register, sync, installPlugins, configuredTools };
}

describe("SetupMachineScope", () => {
  it("resolves the source first, then works inside the machine configuration in order", async () => {
    const { useCase, calls } = build(true);

    await useCase.execute(flow());

    expect(calls).toEqual(["resolveSource", "configure", "register", "installPlugins", "sync"]);
  });

  it("registers the resolved source, installs the named plugins and enables them machine-wide", async () => {
    const { useCase, register, installPlugins, sync, configuredTools } = build(true);
    const f = flow();

    const result = await useCase.execute(f);

    expect(register).toHaveBeenCalledWith(f, SOURCE);
    expect(configuredTools).toEqual([SYNTHETIC_TOOL]);
    expect(installPlugins.execute).toHaveBeenCalledWith({
      projectRoot: PROJECT,
      toolIds: [SYNTHETIC_TOOL],
      mode: "named",
      pluginNames: ["alpha"],
    });
    expect(sync).toHaveBeenCalledWith({
      projectRoot: PROJECT,
      toolIds: [SYNTHETIC_TOOL],
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
