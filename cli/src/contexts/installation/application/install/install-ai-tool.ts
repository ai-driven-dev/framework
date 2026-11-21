import type { HintedMessage } from "../../../../shared/domain/describe-error.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  InstallRuntimeConfig,
  InstallRuntimeConfigResult,
} from "./config/install-runtime-config.js";
import { pluginsOnOtherTools } from "./plugins-on-other-tools.js";

/** What native activation did for a run, as the command that asked for it reports it. */
export interface NativeActivationReport {
  /** Tools whose own CLI actually ran, whether or not every step inside it succeeded. */
  activated: readonly ToolId[];
  /** Tools with a native activation whose binary was not on PATH: nothing of theirs ran. */
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  /** What a recoverable, best-effort step logged. */
  warnings: readonly (string | HintedMessage)[];
  /** A hard failure returned rather than thrown, so whether the command fails stays the caller's call. */
  errors: readonly { scope: string; error: unknown }[];
  /** The verdict on `errors`, decided where they are produced. */
  failed: boolean;
}

export interface InstallAiToolOptions {
  toolId: AiToolId;
  projectRoot: string;
  force: boolean;
  version: string;
  propagatePlugins: boolean;
}

/** A warning's words, with the failure it tails when one caused it: the presentation words that. */
export interface PropagationWarning {
  text: string;
  cause?: unknown;
}

export interface InstallAiToolResult {
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

/** What InstallAiTool is built from. */
export interface InstallAiToolDeps {
  readonly installRuntimeConfig: InstallRuntimeConfig;
  readonly manifestRepo: ManifestRepository;
  readonly pluginInstallFromMarketplace: MarketplacePluginInstaller;
  readonly activatePropagated: ActivatePropagatedPlugins;
  readonly logger: Logger;
}

export class InstallAiTool {
  constructor(private readonly deps: InstallAiToolDeps) {}

  async execute(options: InstallAiToolOptions): Promise<InstallAiToolResult> {
    const { toolId, projectRoot, force, version, propagatePlugins } = options;
    const manifest = (await this.deps.manifestRepo.load()) ?? Manifest.create();
    const runtimeResult = await this.deps.installRuntimeConfig.execute({
      toolId,
      projectRoot,
      manifest,
      force,
      version,
    });
    if (runtimeResult.skipped || !propagatePlugins) {
      return { runtimeResult, propagatedPlugins: [], propagationWarnings: [] };
    }
    return this.propagateAndSync(toolId, projectRoot, runtimeResult);
  }

  private async propagateAndSync(
    toolId: AiToolId,
    projectRoot: string,
    runtimeResult: InstallRuntimeConfigResult
  ): Promise<InstallAiToolResult> {
    const freshManifest = await this.deps.manifestRepo.load();
    if (freshManifest === null) {
      return { runtimeResult, propagatedPlugins: [], propagationWarnings: [] };
    }
    const plugins = pluginsOnOtherTools(freshManifest, toolId);
    const propagated: string[] = [];
    const warnings: PropagationWarning[] = [];
    for (const plugin of plugins) {
      const outcome = await this.propagatePlugin({ plugin, toolId, projectRoot });
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

  private async propagatePlugin(request: {
    plugin: InstalledPlugin;
    toolId: AiToolId;
    projectRoot: string;
  }): Promise<{ propagated?: string; warning?: PropagationWarning }> {
    const { plugin, toolId, projectRoot } = request;
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
