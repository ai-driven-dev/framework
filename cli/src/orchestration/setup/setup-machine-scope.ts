import type { ConfigureMachineScope } from "../../contexts/installation/application/install/configure-machine-scope.js";
import type { NativeActivationReport } from "../../contexts/installation/application/install/install-ai-tool.js";
import type { InstallToolsResult } from "../../contexts/installation/application/install/install-tools.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { InstallGlobalPlugins } from "./install-global-plugins.js";
import type { SetupFlow, SetupResult } from "./setup-flow.js";
import type { SetupMarketplaceRegistration } from "./setup-marketplace-registration.js";

/** Drives native activation machine-wide, enabling the plugins a machine-scope setup installed.
 * Which manifest it works on is not this scenario's: composition binds it. */
export type SyncMachineScope = (options: {
  readonly projectRoot: string;
  readonly toolIds: SetupFlow["aiTools"];
  readonly enablePlugins: readonly string[];
}) => Promise<NativeActivationReport>;

/**
 * `--scope user`: registers the shared framework source, installs the requested plugins in each
 * tool's user configuration directory and drives native activation machine-wide, writing nothing
 * under `flow.projectRoot` at all — no project tool content, no plugin prompt, no project-context
 * detection.
 *
 * Records no shared-source reference: `references.json` tracks which *project* still claims the
 * shared source, and a `--scope user` run has no project-scope manifest for a later `clean` to read
 * that claim back from, so one recorded here could never be decremented. Absence is the honest
 * state until `clean --scope user` purges the source unconditionally regardless.
 */
export class SetupMachineScope {
  constructor(
    private readonly configureMachineScope: Pick<
      ConfigureMachineScope,
      "whileLocked" | "initialize" | "registerTools"
    >,
    private readonly registration: Pick<
      SetupMarketplaceRegistration,
      "resolveSourceIfNeeded" | "registerIfPresent"
    >,
    private readonly syncMachineScope: SyncMachineScope,
    private readonly installPlugins: Pick<InstallGlobalPlugins, "execute">
  ) {}

  async execute(flow: SetupFlow, tools: ToolCatalog): Promise<SetupResult> {
    const source = await this.registration.resolveSourceIfNeeded(flow);
    return this.configureMachineScope.whileLocked(() => this.executeLocked(flow, source, tools));
  }

  private async executeLocked(
    flow: SetupFlow,
    source: Awaited<ReturnType<SetupMarketplaceRegistration["resolveSourceIfNeeded"]>>,
    tools: ToolCatalog
  ): Promise<SetupResult> {
    const isNew = await this.configureMachineScope.initialize();
    await this.registration.registerIfPresent(flow, source);
    await this.configureMachineScope.registerTools(flow.aiTools);
    const plugins = await this.installGlobalPlugins(flow, tools);
    const activation = await this.syncMachineScope({
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
  private async installGlobalPlugins(
    flow: SetupFlow,
    tools: ToolCatalog
  ): Promise<readonly string[]> {
    const { plugins } = await this.installPlugins.execute({
      projectRoot: flow.projectRoot,
      toolIds: flow.aiTools,
      mode: flow.pluginMode,
      pluginNames: flow.pluginNames,
      tools,
    });
    return plugins;
  }
}
