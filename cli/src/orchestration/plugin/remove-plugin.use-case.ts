import type { WithdrawFromHost } from "../../contexts/host-registration/application/withdraw/withdraw-from-host.use-case.js";
import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type {
  PluginHostReach,
  ProjectPluginWithdrawalSteps,
} from "../../contexts/installation/application/removal/project-plugin-withdrawal.js";
import type {
  RemovePluginRequest,
  RemovePlugin as RemoveProjectPluginFiles,
} from "../../contexts/installation/application/removal/remove-plugin.use-case.js";
import type { pluginRemovalClaims } from "../../contexts/machine-claims/application/plugin-removal-claims.js";
import { pluginRefRecords } from "./plugin-ref-records.js";
import { withdrawalClaimsOf } from "./withdrawal-claims.js";

export interface RemovePluginDeps {
  readonly remove: Pick<RemoveProjectPluginFiles, "execute">;
  readonly withdrawFromHost: Pick<WithdrawFromHost, "execute">;
  readonly claims: ReturnType<typeof pluginRemovalClaims>;
  readonly records: Pick<RegistrationRecordRules, "refOf" | "withoutRef">;
}

/** The marketplace a withdrawn plugin came from, `undefined` when it carries none. */
function withdrawnOf(reach: PluginHostReach) {
  const { name, scope } = reach.plugin.plugin;
  const { marketplace } = reach.plugin;
  return marketplace === undefined ? undefined : { name, marketplace, scope };
}

/** Removes a plugin from a project: the host lets it go first, checked against the machine's
 * claims, then installation deletes its files and the claims it held are let go of. */
export class RemovePlugin {
  constructor(private readonly deps: RemovePluginDeps) {}

  execute(request: Omit<RemovePluginRequest, "withdrawal">): Promise<void> {
    return this.deps.remove.execute({ ...request, withdrawal: this.withdrawal() });
  }

  private withdrawal(): ProjectPluginWithdrawalSteps {
    const { withdrawFromHost, claims, records } = this.deps;
    return {
      assertSource: async (source) => {
        const plugin = withdrawnOf(source);
        if (plugin === undefined) return;
        const { toolId, tool, projectRoot, registrations } = source;
        await withdrawFromHost.execute({
          kind: "prove-project-source",
          tool,
          plugin,
          projectRoot,
          registrations,
          isMachineOwned: (ref) => claims.isMachineOwned(toolId, ref),
        });
      },
      withdraw: (reach) => this.withdraw(reach),
      canDetachRef: async ({ toolId, tool, confirmed, ref }) =>
        confirmed === true ||
        (tool.pluginEnablementIsMachineGlobal() && (await claims.isMachineOwned(toolId, ref))),
      ...pluginRefRecords(records),
      detachNativeRefs: (projectRoot, refsByTool) =>
        claims.detachNativeRefs(projectRoot, refsByTool),
      detachUserPlugin: (toolId, name, projectRoot) =>
        claims.detachUserPlugin(toolId, name, projectRoot),
    };
  }

  private async withdraw(reach: PluginHostReach): Promise<boolean | undefined> {
    const plugin = withdrawnOf(reach);
    if (plugin === undefined) return undefined;
    const { tool, projectRoot, registrations } = reach;
    return this.deps.withdrawFromHost.execute({
      kind: "withdraw-plugin",
      tool,
      plugin,
      projectRoot,
      registrations,
      pluginCacheRoot: tool.nativeActivation()?.pluginCacheRoot(this.deps.claims.home),
      claims: withdrawalClaimsOf(this.deps.claims, { toolId: tool.toolId, tool, projectRoot }),
    });
  }
}
