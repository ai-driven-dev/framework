import type { ConfigureMachineScope } from "../../contexts/installation/application/install/configure-machine-scope.js";
import type { NativeActivationReport } from "../../contexts/installation/application/install/install-ai-tool.js";
import type { InstallToolsResult } from "../../contexts/installation/application/install/install-tools.js";
import type { InstallGlobalPlugins } from "./install-global-plugins.js";
import type { ResolveSetupSource } from "./resolve-setup-source.js";
import type { RegisterFrameworkSource, SetupFlow, SetupResult } from "./setup-flow.js";

/** Drives native activation machine-wide, enabling the plugins a machine-scope setup installed.
 * Which manifest it works on is not this scenario's: composition binds it. */
export type SyncMachineScope = (options: {
  readonly projectRoot: string;
  readonly toolIds: SetupFlow["aiTools"];
  readonly enablePlugins: readonly string[];
}) => Promise<NativeActivationReport>;

export interface SetupMachineScopeDeps {
  readonly configureMachineScope: Pick<ConfigureMachineScope, "execute">;
  readonly resolveSource: Pick<ResolveSetupSource, "execute">;
  readonly register: RegisterFrameworkSource;
  readonly syncMachineScope: SyncMachineScope;
  readonly installPlugins: Pick<InstallGlobalPlugins, "execute">;
}

/**
 * `--scope user`: registers the shared framework source, installs the requested plugins in each
 * tool's user configuration directory and drives native activation machine-wide, writing nothing
 * under `flow.projectRoot` at all: no project tool content, no plugin prompt, no project-context
 * detection.
 *
 * Records no shared-source reference: `references.json` tracks which *project* still claims the
 * shared source, and a `--scope user` run has no project-scope manifest for a later `clean` to read
 * that claim back from, so one recorded here could never be decremented. Absence is the honest
 * state until `clean --scope user` purges the source unconditionally regardless.
 */
export class SetupMachineScope {
  constructor(private readonly deps: SetupMachineScopeDeps) {}

  async execute(flow: SetupFlow): Promise<SetupResult> {
    const source = await this.deps.resolveSource.execute(flow);
    return this.deps.configureMachineScope.execute({
      toolIds: flow.aiTools,
      whileHeld: (isNew) => this.executeLocked(flow, source, isNew),
    });
  }

  private async executeLocked(
    flow: SetupFlow,
    source: Awaited<ReturnType<ResolveSetupSource["execute"]>>,
    isNew: boolean
  ): Promise<SetupResult> {
    await this.deps.register(flow, source);
    const plugins = await this.installGlobalPlugins(flow);
    const activation = await this.deps.syncMachineScope({
      projectRoot: flow.projectRoot,
      toolIds: flow.aiTools,
      enablePlugins: plugins,
    });
    const install: InstallToolsResult = { results: [] };
    const outcome = { install, activation, context: undefined, globalPlugins: plugins };
    return isNew ? { kind: "initialized", ...outcome } : { kind: "up-to-date", ...outcome };
  }

  /** Copies the chosen plugins' global files and returns their names, which every tool with
   * native activation then enables machine-wide. */
  private async installGlobalPlugins(flow: SetupFlow): Promise<readonly string[]> {
    const { plugins } = await this.deps.installPlugins.execute({
      projectRoot: flow.projectRoot,
      toolIds: flow.aiTools,
      mode: flow.pluginMode,
      pluginNames: flow.pluginNames,
    });
    return plugins;
  }
}
