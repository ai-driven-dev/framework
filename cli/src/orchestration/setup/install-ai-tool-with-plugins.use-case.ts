import type { InstallRuntimeConfigResult } from "../../contexts/installation/application/install/config/install-runtime-config.use-case.js";
import type {
  InstallAiTool,
  InstallAiToolRequest,
  NativeActivationReport,
  PluginToPropagate,
} from "../../contexts/installation/application/install/install-ai-tool.use-case.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { Logger } from "../../shared/ports/logger.js";

/** A warning's words, with the failure it tails when one caused it: the presentation words that. */
export interface PropagationWarning {
  text: string;
  cause?: unknown;
}

export interface InstallAiToolWithPluginsResult {
  runtimeResult: InstallRuntimeConfigResult;
  propagatedPlugins: string[];
  propagationWarnings: PropagationWarning[];
  /** What native activation did while re-registering the plugins this run propagated -
   * `undefined` when nothing was propagated, so activation never ran. */
  activation?: NativeActivationReport;
}

/** Re-registers the native settings of what a run propagated. Supplied by the composition root. */
export interface ActivatePropagatedPlugins {
  execute(options: { projectRoot: string }): Promise<NativeActivationReport>;
}

/** The one thing propagation asks of the plugin installer: put a named marketplace plugin on a
 * tool, quietly. Supplied by the composition root. */
export interface MarketplacePluginInstaller {
  execute(options: {
    pluginName: string;
    version: string | undefined;
    fromMarketplace: string | undefined;
    toolIds: AiToolId[];
    projectRoot: string;
    interactive: boolean;
    autoSelect: boolean;
    replace: boolean;
    requestedVersionPolicy: "prefer-catalog";
  }): Promise<unknown>;
}

export interface InstallAiToolWithPluginsDeps {
  readonly installAiTool: Pick<InstallAiTool, "execute">;
  readonly pluginInstallFromMarketplace: MarketplacePluginInstaller;
  readonly activatePropagated: ActivatePropagatedPlugins;
  readonly logger: Logger;
}

/** Installs an AI tool, carries the plugins of the other tools onto it, then re-registers what
 * it carried. */
export class InstallAiToolWithPlugins {
  constructor(private readonly deps: InstallAiToolWithPluginsDeps) {}

  async execute(options: InstallAiToolRequest): Promise<InstallAiToolWithPluginsResult> {
    const { toolId, projectRoot } = options;
    const { runtimeResult, pluginsToPropagate } = await this.deps.installAiTool.execute(options);
    const propagated: string[] = [];
    const warnings: PropagationWarning[] = [];
    for (const plugin of pluginsToPropagate) {
      const outcome = await this.propagatePlugin(plugin, toolId, projectRoot);
      if (outcome.propagated !== undefined) propagated.push(outcome.propagated);
      if (outcome.warning !== undefined) warnings.push(outcome.warning);
    }
    const activation =
      propagated.length > 0
        ? await this.deps.activatePropagated.execute({ projectRoot })
        : undefined;
    return {
      runtimeResult,
      propagatedPlugins: propagated,
      propagationWarnings: warnings,
      activation,
    };
  }

  // @policy report-and-continue: a plugin that cannot be propagated is warned about and the
  // others still go.
  private async propagatePlugin(
    plugin: PluginToPropagate,
    toolId: AiToolId,
    projectRoot: string
  ): Promise<{ propagated?: string; warning?: PropagationWarning }> {
    if (plugin.marketplace === undefined) {
      return { warning: { text: this.warnNoMarketplace(plugin.name, toolId) } };
    }
    try {
      await this.deps.pluginInstallFromMarketplace.execute({
        pluginName: plugin.name,
        version: plugin.version,
        fromMarketplace: plugin.marketplace,
        toolIds: [toolId],
        projectRoot,
        interactive: false,
        autoSelect: true,
        replace: true,
        requestedVersionPolicy: "prefer-catalog",
      });
      return { propagated: plugin.name };
    } catch (err) {
      const text = `Plugin '${plugin.name}' could not be propagated to ${toolId}: `;
      this.deps.logger.warn(text, err);
      return { warning: { text, cause: err } };
    }
  }

  private warnNoMarketplace(pluginName: string, toolId: AiToolId): string {
    const msg = `Plugin '${pluginName}' has no marketplace — cannot propagate to ${toolId}. Add it manually.`;
    this.deps.logger.warn(msg);
    return msg;
  }
}
