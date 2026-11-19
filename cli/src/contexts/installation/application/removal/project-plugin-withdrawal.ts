import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { NativeRegistrations } from "../../domain/manifest/native-registrations.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { HostWithdrawal } from "../../ports/native-host.js";
import type { NativeHostTool, PluginEnablementReach } from "../../ports/tool-sections.js";
import type { RemovalClaims } from "./remove-project-plugin.js";

/** What a project removal asks the machine scope, supplied by the composition root: who else owns a
 * ref, whether another project still needs it, which cache path is provably inside its root, and
 * the home directory the host's plugin cache is read under. */
export interface PluginRemovalClaims extends RemovalClaims {
  readonly home: string;
  readonly isMachineOwned: (toolId: ToolId, ref: string) => Promise<boolean>;
  readonly guardMessage: (
    binary: string,
    tool: PluginEnablementReach,
    ref: string,
    marketplaceAlias: string,
    projectRoot: string
  ) => Promise<string | undefined>;
  readonly resolveCacheCandidate: (
    cacheRoot: string,
    relativeSegments: string,
    label: string
  ) => Promise<string | null>;
}

/** What a project removal asks the host and the machine claims: whether the host lets the plugin
 * go, whether its ref may then leave the record, and the claims the removal lets go of. */
export class ProjectPluginWithdrawal<Proof> {
  constructor(
    private readonly withdrawFromHost: HostWithdrawal<Proof>,
    private readonly claims: PluginRemovalClaims
  ) {}

  /** Refuses, before anything is deleted, a plugin the host cannot let go. */
  async assertSource(
    toolId: AiToolId,
    tool: NativeHostTool,
    plugin: InstalledPlugin,
    projectRoot: string,
    registrations: NativeRegistrations | undefined
  ): Promise<void> {
    if (plugin.marketplace === undefined) return;
    await this.withdrawFromHost.assertProjectSource({
      tool,
      plugin: { name: plugin.name, marketplace: plugin.marketplace, scope: plugin.scope },
      projectRoot,
      registrations,
      isMachineOwned: (ref) => this.claims.isMachineOwned(toolId, ref),
    });
  }

  /** `undefined` when the plugin carries no marketplace, else whether the host confirmed. */
  async withdraw(
    tool: NativeHostTool,
    plugin: InstalledPlugin,
    projectRoot: string,
    registrations: NativeRegistrations | undefined
  ): Promise<boolean | undefined> {
    if (plugin.marketplace === undefined) return undefined;
    return this.withdrawFromHost.execute({
      tool,
      plugin: { name: plugin.name, marketplace: plugin.marketplace, scope: plugin.scope },
      projectRoot,
      registrations,
      pluginCacheRoot: tool.nativeActivation()?.pluginCacheRoot(this.claims.home),
    });
  }

  /** The host confirmed the withdrawal, or it enables plugins machine-wide and nobody else holds `ref`. */
  async canDetachRef(
    toolId: AiToolId,
    tool: NativeHostTool,
    confirmed: boolean | undefined,
    ref: string
  ): Promise<boolean> {
    return (
      confirmed === true ||
      (tool.pluginEnablementIsMachineGlobal() && (await this.claims.isMachineOwned(toolId, ref)))
    );
  }

  detachNativeRefs(
    projectRoot: string,
    refsByTool: ReadonlyMap<ToolId, readonly string[]>
  ): Promise<void> {
    return this.claims.detachNativeRefs(projectRoot, refsByTool);
  }

  detachUserPlugin(toolId: AiToolId, name: string, projectRoot: string): Promise<void> {
    return this.claims.detachUserPlugin(toolId, name, projectRoot);
  }
}
