import type { BuiltPlacement } from "../../contexts/installation/application/materialize/add-plugin-request.js";
import {
  builtTreePlacement,
  type PlacementDeps,
} from "../../contexts/installation/application/materialize/built/place-built-tree-plugin.js";
import { builtTreeReader } from "../../contexts/installation/application/materialize/built/read-translated-built-tree.js";
import { flatPlacement } from "../../contexts/installation/application/materialize/place-flat-plugin.js";
import { foreignUserScopeDirOf } from "../../contexts/installation/application/plugin/add/foreign-user-scope-dir.js";
import {
  PlacePlugin,
  type PlacePluginDeps,
  toolPlacementOf,
} from "../../contexts/installation/application/plugin/add/place-plugin.use-case.js";
import type { BuiltMaterializationDeps } from "../../contexts/installation/application/plugin/files/built-materialization-deps.js";
import {
  latestDistributionOf,
  PluginMaterializer,
} from "../../contexts/installation/application/plugin/files/plugin-materializer.js";
import { userPluginRebuildOf } from "../../contexts/installation/application/plugin/files/rebuild-user-plugin-files.js";
import type { LoadDistribution } from "../../contexts/installation/ports/plugin/load-plugin-distribution.js";
import type { UserScopeFileGuard } from "../../contexts/installation/ports/plugin/user-plugin-materialization.js";
import type { FileReader } from "../../shared/ports/file-reader.js";
import type { FileWriter } from "../../shared/ports/file-writer.js";
import { projectHooksMaterializerOf } from "../contexts/installation.js";
import type { RegisteredCatalog } from "../contexts/tools.js";

type Files = FileReader & FileWriter;

/** What placing a plugin again reaches, bound once over the build it reads. */
export function builtPlacementOf(fs: Files, built: BuiltMaterializationDeps): BuiltPlacement {
  return {
    homedir: built.homedir,
    translate: built.translate,
    placeBuiltTree: builtTreePlacement(placementDepsOf(fs, built)),
  };
}

/** What placing from a built tree reaches, with the project hooks built over `fs`. */
export function placementDepsOf(fs: Files, built: BuiltMaterializationDeps): PlacementDeps {
  const { homedir, translate, marketplaceRegistry, ensureBuilt, platform } = built;
  const projectHooks = projectHooksMaterializerOf(fs);
  return {
    fs,
    marketplaceRegistry,
    homedir,
    readBuiltTree: builtTreeReader({ fs, ensureBuilt, platform, translate, projectHooks }),
    placeFlat: flatPlacement({ fs, homedir, translate, projectHooks }),
  };
}

/** Placing an added plugin's files for each tool, over the build it reads. */
export function placePluginOf(
  deps: Pick<PlacePluginDeps, "logger" | "pluginRuntime"> & {
    readonly fs: Files;
    readonly built: BuiltMaterializationDeps;
  },
  tools: RegisteredCatalog
): PlacePlugin {
  const { fs, built, ...rest } = deps;
  return new PlacePlugin(
    {
      ...rest,
      findForeignDir: foreignUserScopeDirOf({ fs, homedir: built.homedir }),
      placeForTool: toolPlacementOf({ fs, ...builtPlacementOf(fs, built) }),
    },
    tools
  );
}

/** Writing a plugin's machine-scope files from the build it was fetched into. */
export function pluginMaterializerOf(deps: {
  readonly fs: Files;
  readonly loadDistribution: LoadDistribution;
  readonly guard: UserScopeFileGuard;
  readonly builtDeps: BuiltMaterializationDeps;
  /** A global install's fetches: it writes nothing in the project. */
  readonly globalCacheDir?: () => string;
}): PluginMaterializer {
  const { fs, guard, builtDeps } = deps;
  return new PluginMaterializer({
    fs,
    guard,
    userHome: { dir: builtDeps.homedir, platform: builtDeps.platform },
    fetchLatest: latestDistributionOf(deps.loadDistribution, deps.globalCacheDir),
    rebuild: userPluginRebuildOf({ fs, builtDeps }),
  });
}
