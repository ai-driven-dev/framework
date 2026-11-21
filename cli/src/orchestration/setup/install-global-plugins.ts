import type { ListFrameworkPlugins } from "../../contexts/distribution/application/plugin-source/list-framework-plugins.js";
import type { PluginSourceMatch } from "../../contexts/distribution/contract/plugin-source-match.js";
import type { InstallUserPlugins } from "../../contexts/installation/application/install/install-user-plugins.js";
import type { ToolId } from "../../shared/domain/tool.js";

export interface InstallGlobalPluginsOptions {
  readonly projectRoot: string;
  readonly toolIds: readonly ToolId[];
  readonly mode: "interactive" | "all" | "recommended" | "named" | "none";
  readonly pluginNames: readonly string[];
}

export interface InstallGlobalPluginsResult {
  /** The framework plugins this run chose, which a tool with native activation enables next. */
  readonly plugins: readonly string[];
}

/**
 * `setup --global --plugins …`: picks the framework plugins from the shared source's catalog and
 * has them copied into each tool's user configuration. A tool that enables plugins through its own
 * CLI is handed the chosen names by the caller instead.
 */
export class InstallGlobalPlugins {
  constructor(
    private readonly listFrameworkPlugins: Pick<ListFrameworkPlugins, "execute">,
    private readonly installUserPlugins: Pick<InstallUserPlugins, "execute">
  ) {}

  async execute(options: InstallGlobalPluginsOptions): Promise<InstallGlobalPluginsResult> {
    if (options.mode === "none" || options.mode === "interactive") return { plugins: [] };
    const catalogue = await this.listFrameworkPlugins.execute({ projectRoot: options.projectRoot });
    const chosen = select(catalogue, options);
    await this.installUserPlugins.execute({
      projectRoot: options.projectRoot,
      toolIds: options.toolIds,
      plugins: chosen,
    });
    return { plugins: chosen.map((match) => match.entry.name) };
  }
}

function select(
  catalogue: readonly PluginSourceMatch[],
  options: InstallGlobalPluginsOptions
): readonly PluginSourceMatch[] {
  if (options.mode === "all") return catalogue;
  if (options.mode === "recommended") return catalogue.filter((match) => match.entry.recommended);
  const missing = options.pluginNames.filter(
    (name) => !catalogue.some((m) => m.entry.name === name)
  );
  if (missing.length > 0) {
    throw new Error(`Not in the framework catalog: ${missing.join(", ")}.`);
  }
  return catalogue.filter((match) => options.pluginNames.includes(match.entry.name));
}
