import { UserScopeUnavailableError } from "../orchestration.error.js";
import type { SyncSettings } from "../sync/settings/sync-settings.use-case.js";
import type { SetupResult } from "./setup-flow.js";
import type { SetupFlow } from "./setup-flow.model.js";
import type { SetupMachineScope } from "./setup-machine-scope.use-case.js";
import type { ChoosePlugins } from "./steps/choose-plugins.use-case.js";
import type { InstallSetupTools } from "./steps/install-setup-tools.use-case.js";
import type { PrepareSetupProject } from "./steps/prepare-setup-project.use-case.js";

/** `aidd setup`: brings a project from nothing to correct, stage by stage. A machine-scope flow is
 * served entirely by `machineScope`; absent, `execute` refuses a request it has nothing to serve. */
export class RunSetup {
  constructor(
    private readonly prepare: Pick<PrepareSetupProject, "execute">,
    private readonly installTools: Pick<InstallSetupTools, "execute">,
    private readonly choosePlugins: Pick<ChoosePlugins, "execute">,
    private readonly syncSettings: Pick<SyncSettings, "execute">,
    private readonly machineScope: Pick<SetupMachineScope, "execute"> | undefined
  ) {}

  async execute(flow: SetupFlow): Promise<SetupResult> {
    if (flow.scope === "user") return this.runMachineScope(flow);
    const { context, isNew, claimSource } = await this.prepare.execute(flow);
    const install = await this.installTools.execute({ flow, context });
    if (flow.registerDefaultMarketplace) await this.promptPlugins(flow);
    await claimSource?.();
    const activation = await this.syncSettings.execute({ projectRoot: flow.projectRoot });
    return { kind: isNew ? "initialized" : "up-to-date", install, activation, context };
  }

  private async runMachineScope(flow: SetupFlow): Promise<SetupResult> {
    if (this.machineScope === undefined) throw new UserScopeUnavailableError();
    return this.machineScope.execute(flow);
  }

  private async promptPlugins(flow: SetupFlow): Promise<void> {
    await this.choosePlugins.execute({
      projectRoot: flow.projectRoot,
      mode: flow.pluginMode,
      pluginNames: [...flow.pluginNames],
      interactive: flow.interactive,
    });
  }
}
