import type { InstallationFile } from "../../../../../kernel/file.js";
import type { AiToolId } from "../../../../../kernel/tool.js";
import type { PluginDistribution } from "../../../../translate/domain/plugin-distribution.js";

export interface PinnedUserFrameworkResult {
  readonly sha: string;
  readonly dist: PluginDistribution;
  readonly files: readonly InstallationFile[];
}

/** The catalogue, plugin manifest and built files come from one isolated checkout. */
export interface PinnedUserFramework {
  build(
    ref: string,
    toolId: AiToolId,
    pluginName: string,
    sha?: string
  ): Promise<PinnedUserFrameworkResult>;
  /** Reuse private checkout/build trees only for this operation. */
  withSession?<T>(action: (session: PinnedUserFramework) => Promise<T>): Promise<T>;
}
