import type { HintedMessage } from "../../../../shared/domain/describe-error.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  InstallRuntimeConfig,
  InstallRuntimeConfigResult,
} from "./config/install-runtime-config.use-case.js";
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

export interface InstallAiToolRequest {
  toolId: AiToolId;
  projectRoot: string;
  force: boolean;
  version: string;
  propagatePlugins: boolean;
}

/** A plugin another tool carries, as propagation reads it to put it on the new tool. */
export interface PluginToPropagate {
  readonly name: string;
  readonly version: string | undefined;
  /** Where it came from; a plugin recorded without one cannot be propagated. */
  readonly marketplace: string | undefined;
}

export interface InstallAiToolResult {
  runtimeResult: InstallRuntimeConfigResult;
  /** What the caller may carry onto the new tool; empty when the install was skipped, plugins
   * were not asked for, or no manifest remained to read them from. */
  pluginsToPropagate: readonly PluginToPropagate[];
}

/** What InstallAiTool is built from. */
export interface InstallAiToolDeps {
  readonly installRuntimeConfig: InstallRuntimeConfig;
  readonly manifestRepo: ManifestRepository;
}

export class InstallAiTool {
  constructor(private readonly deps: InstallAiToolDeps) {}

  async execute(options: InstallAiToolRequest): Promise<InstallAiToolResult> {
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
      return { runtimeResult, pluginsToPropagate: [] };
    }
    const fresh = await this.deps.manifestRepo.load();
    const plugins = fresh === null ? [] : pluginsOnOtherTools(fresh, toolId);
    return {
      runtimeResult,
      pluginsToPropagate: plugins.map(({ plugin, marketplace }) => ({
        name: plugin.name,
        version: plugin.version,
        marketplace,
      })),
    };
  }
}
