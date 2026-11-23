import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { PluginDistribution } from "../../../../../shared/domain/plugin/plugin-distribution.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import type { MarketplaceToBuild } from "../../../contract/built-marketplace.js";
import { SharedSourceUnregisteredError } from "../../../contract/installation.error.js";
import type { InstalledPlugin } from "../../../domain/plugins/installed-plugin.js";
import {
  readBuiltUserPluginFiles,
  withoutDroppedFiles,
} from "../../materialize/built/read-built-plugin-files.js";
import { hashOutputFiles } from "../../shared/hash-output-files.js";
import type { BuiltMaterializationDeps } from "./built-materialization-deps.js";
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
  /** The marketplace the plugin was installed from, whose built tree the rebuild reads. */
  readonly marketplace?: string;
  readonly projectRoot: string;
}

export interface RebuiltUserPluginFiles {
  readonly files: InstallationFile[];
  readonly componentPaths: ReadonlyMap<string, string>;
}

/** Rebuilds the files a machine-scope plugin holds after an update. */
export type RebuildUserPluginFiles = (source: UserPluginSource) => Promise<RebuiltUserPluginFiles>;

/** The machine-scope rebuild, bound to the build and file system it reads. */
export function userPluginRebuildOf(deps: UserPluginRebuild): RebuildUserPluginFiles {
  return (source) => rebuildUserPluginFiles(deps, source);
}

/** The files a machine-scope plugin holds after an update, from its built tree when its
 * marketplace is registered, from a fresh translation otherwise. */
export async function rebuildUserPluginFiles(
  deps: UserPluginRebuild,
  source: UserPluginSource
): Promise<RebuiltUserPluginFiles> {
  const { projectRoot } = source;
  const marketplace =
    source.marketplace === undefined
      ? undefined
      : (await deps.builtDeps.marketplaceRegistry.list(projectRoot))?.find(
          (entry) => entry.name === source.marketplace
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
  const { dropsBuiltFile } = deps.builtDeps.translate.execute({ distribution: dist, tool });
  return {
    files: withoutDroppedFiles(built, plugin.name, dropsBuiltFile),
    componentPaths: new Map(),
  };
}

function translateUserPluginFiles(
  deps: UserPluginRebuild,
  source: UserPluginSource
): RebuiltUserPluginFiles {
  const { dist, tool, plugin } = source;
  // Without the built tree, translation would write a project's layout in the user directory.
  if (tool.plugins()?.globalFiles() != null) {
    throw new SharedSourceUnregisteredError(
      `${tool.toolId}: the shared framework source is not registered, so '${plugin.name}' cannot be rebuilt`
    );
  }
  const translated = deps.builtDeps.translate.execute({ distribution: dist, tool });
  return { files: hashOutputFiles(translated.files), componentPaths: translated.componentPaths };
}
