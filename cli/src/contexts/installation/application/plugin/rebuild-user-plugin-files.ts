import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { MarketplaceToBuild } from "../../contract/built-marketplace.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import {
  readBuiltUserPluginFiles,
  withoutHooksPrefix,
} from "../materialize/read-built-plugin-files.js";
import type { BuiltMaterializationDeps } from "../shared/built-materialization-deps.js";
import { hashOutputFiles } from "../shared/hash-output-files.js";
import { readGlobalPluginFiles } from "./global-plugin-files.js";

/** What rebuilding a plugin's machine-scope files reads from. */
export interface UserPluginRebuild {
  readonly fs: FileReader;
  readonly builtDeps: BuiltMaterializationDeps;
}

/** The plugin, the tool and the distribution one rebuild starts from. */
export interface UserPluginSource {
  readonly dist: PluginDistribution;
  readonly tool: AiToolProfile;
  readonly plugin: InstalledPlugin;
  readonly projectRoot: string;
}

export interface RebuiltUserPluginFiles {
  readonly files: InstallationFile[];
  readonly componentPaths: ReadonlyMap<string, string>;
}

/** The files a machine-scope plugin holds after an update, from its built tree when its
 * marketplace is registered, from a fresh translation otherwise. */
export async function rebuildUserPluginFiles(
  deps: UserPluginRebuild,
  source: UserPluginSource
): Promise<RebuiltUserPluginFiles> {
  const { plugin, projectRoot } = source;
  const marketplace =
    plugin.marketplace === undefined
      ? undefined
      : (await deps.builtDeps.marketplaceRegistry.list(projectRoot))?.find(
          (entry) => entry.name === plugin.marketplace
        );
  if (marketplace === undefined) return translateUserPluginFiles(deps, source);
  return readBuiltFiles(deps, source, marketplace);
}

async function readBuiltFiles(
  deps: UserPluginRebuild,
  source: UserPluginSource,
  marketplace: MarketplaceToBuild
): Promise<RebuiltUserPluginFiles> {
  const { dist, tool, plugin, projectRoot } = source;
  const { builtDir } = await deps.builtDeps.ensureBuilt.execute({
    projectRoot,
    marketplace,
    target: tool.toolId,
    mode: tool.frameworkBuildMode(),
  });
  if (tool.plugins()?.globalFiles() != null) {
    const files = await readGlobalPluginFiles(deps.fs, { builtDir, tool, dist });
    return { files, componentPaths: new Map() };
  }
  const built = await readBuiltUserPluginFiles(deps.fs, {
    builtDir,
    name: plugin.name,
    platform: deps.builtDeps.platform,
  });
  const files =
    tool.plugins()?.deliversHooksToProject() === true
      ? withoutHooksPrefix(built, plugin.name)
      : built;
  return { files, componentPaths: new Map() };
}

function translateUserPluginFiles(
  deps: UserPluginRebuild,
  source: UserPluginSource
): RebuiltUserPluginFiles {
  const { dist, tool, plugin } = source;
  // Without the built tree, translation would write a project's layout in the user directory.
  if (tool.plugins()?.globalFiles() != null) {
    throw new Error(
      `${tool.toolId}: the shared framework source is not registered, so '${plugin.name}' cannot be rebuilt; run \`aidd setup --global\`.`
    );
  }
  const translated = deps.builtDeps.translate.execute({ distribution: dist, tool });
  return { files: hashOutputFiles(translated.files), componentPaths: translated.componentPaths };
}
