/** The flat routes of a descriptor: where a flat build and a flat install write a tool's hooks. */

import {
  type FlatHooksLoaderEntry,
  flatHooksPathWithLoaderEntry,
  genericFlatHooksFile,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import type {
  ArtifactContract,
  FlatHooksBridge,
  ShippedHooks,
} from "../../../contract/build-contract.js";
import type { ProjectHooksFormat } from "../../../contract/tool-vocabulary.js";
import { mergeHooks, pluginScriptPath } from "../../hooks/hooks-merge.js";
import type {
  BridgeDelivery,
  HooksFlatPart,
  ProjectMergeDelivery,
} from "../../sections/hooks-section.js";
import {
  type FlatHooksRoute,
  type HooksFileMerge,
  type HooksRouting,
  PLUGIN_HOOKS_SOURCE,
} from "./descriptor.js";
import { hookScript, mergeTarget, withHookScript } from "./routes.js";

/** A flat build's hooks: each plugin's scripts in a folder of its own, its entries merged into
 * the route's shared file or written to a file of the plugin's own, under the tool its warnings
 * are reported for. */
export function flatHooksArtifact(
  descriptor: HooksRouting & { readonly flat: FlatHooksRoute },
  reader: { readonly tool: string },
  /** The tool's own merge, for a hooks file no `HooksFileFormat` describes. */
  ownMerge?: HooksFileMerge
): ArtifactContract;
/** A loader's hooks: no hooks file, which a bridge it imports replaces; so a descriptor that
 * declares one, or a route with no loader, cannot be handed a bridge. */
export function flatHooksArtifact(
  descriptor: HooksRouting & {
    readonly file?: never;
    readonly flat: FlatHooksRoute & { readonly loaderEntry: FlatHooksLoaderEntry };
  },
  reader: { readonly bridge: FlatHooksBridge["generate"] }
): ArtifactContract;
export function flatHooksArtifact(
  descriptor: HooksRouting & { readonly flat: FlatHooksRoute },
  /** The tool a hooks file's warnings are reported under, or the bridge a loader imports. */
  reader: { readonly tool: string } | { readonly bridge: FlatHooksBridge["generate"] },
  /** The tool's own merge, for a hooks file no `HooksFileFormat` describes. */
  ownMerge?: HooksFileMerge
): ArtifactContract {
  const route = descriptor.flat;
  const { sharedFile, loaderEntry } = route;
  const { file } = descriptor;
  const tool = "tool" in reader ? reader.tool : undefined;
  const bridge = "bridge" in reader ? reader.bridge : undefined;
  const merge: HooksFileMerge | undefined =
    ownMerge ??
    (file === undefined
      ? undefined
      : (existing, shipped) => mergeHooks(existing, shipped, mergeTarget(descriptor, file, route)));
  return {
    supported: true,
    source: PLUGIN_HOOKS_SOURCE,
    path: (plugin, rel) => flatHooksPath(route, plugin, rel),
    script: hookScript(descriptor),
    ...(merge === undefined || tool === undefined
      ? {}
      : {
          hooksFile: {
            path: (plugin: string) => sharedFile ?? genericFlatHooksFile(route.scriptsDir, plugin),
            shared: sharedFile !== undefined,
            merge: (existing: string | null, shipped: ShippedHooks) => {
              const merged = merge(existing, shipped);
              return { ...merged, warnings: merged.warnings.map((w) => `${tool}: ${w}`) };
            },
          },
        }),
    ...(loaderEntry !== undefined && bridge !== undefined
      ? { skipHooksJson: true, hooksBridge: hooksBridge(loaderEntry, bridge) }
      : {}),
  };
}

/** Where the bridge generated for one plugin lands: beside the loader's own module, renamed
 * per plugin so two plugins each getting one cannot collide. */
export function hooksBridgePath(loaderEntry: FlatHooksLoaderEntry, plugin: string): string {
  return `${loaderEntry.dir}${plugin}-hooks.js`;
}

function hooksBridge(
  loaderEntry: FlatHooksLoaderEntry,
  generate: FlatHooksBridge["generate"]
): FlatHooksBridge {
  return {
    generate,
    path: (plugin) => hooksBridgePath(loaderEntry, plugin),
    skipIfSourceHas: loaderEntry.baseName,
  };
}

function flatHooksPath(route: FlatHooksRoute, plugin: string, rel: string): string {
  if (route.loaderEntry !== undefined) {
    return flatHooksPathWithLoaderEntry({
      perPluginHooksDir: route.scriptsDir,
      loaderEntry: route.loaderEntry,
      plugin,
      hooksRelativePath: rel,
    });
  }
  if (rel === `${PLUGIN_HOOKS_SOURCE.scriptDir}/${plugin}.hooks.json`) {
    return genericFlatHooksFile(route.scriptsDir, plugin);
  }
  return pluginScriptPath(route.scriptsDir, plugin, rel);
}

/** A flat tool's hooks, as far as plugins go: a loader reads them from its own directory. */
export function flatHooksSupport(
  descriptor: HooksRouting & { readonly flat: FlatHooksRoute },
  bridge?: FlatHooksBridge["generate"]
): BridgeDelivery {
  const route = descriptor.flat;
  const { loaderEntry } = route;
  return {
    kind: "bridge",
    flat: {
      dir: route.scriptsDir,
      ...(loaderEntry === undefined ? {} : { loaderEntry }),
      ...(loaderEntry !== undefined && bridge !== undefined
        ? { bridge: hooksBridge(loaderEntry, bridge) }
        : {}),
    },
    ...withHookScript(descriptor),
  };
}

/** A flat tool's hooks that `plugin install` merges into its route's shared file. */
export function flatProjectHooksDelivery(
  bridge: BridgeDelivery,
  route: FlatHooksRoute & { readonly sharedFile: string },
  format: ProjectHooksFormat
): ProjectMergeDelivery & { readonly flat: HooksFlatPart } {
  return {
    kind: "project-merge",
    project: { relativePath: route.sharedFile, format },
    flat: bridge.flat,
    ...(bridge.hookScript === undefined ? {} : { hookScript: bridge.hookScript }),
  };
}
