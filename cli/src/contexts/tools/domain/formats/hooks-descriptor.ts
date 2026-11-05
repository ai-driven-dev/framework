/**
 * A tool's hooks, declared as data in `profiles/<tool>/hooks.ts`: where each route writes a
 * plugin's hooks and in what form the tool reads them. The tool's build contracts and its
 * plugins capability read the descriptor through the builders below, never restating it.
 */

import {
  type FlatHooksLoaderEntry,
  flatHooksPathWithLoaderEntry,
  genericFlatHooksFile,
} from "../../../../kernel/materialization/flat-paths.js";
import type { ArtifactContract } from "../build-contract.js";
import { HooksCapability } from "../capabilities/hooks-capability.js";
import type { FlatHooksBridge, ProjectHooksFormat } from "../capabilities/plugins-capability.js";
import {
  type HooksFileFormat,
  type HooksMergeTarget,
  isHooksFileEmpty,
  type LocatePluginPath,
  mergeHooks,
  pluginEntries,
  pluginScriptDir,
  pluginScriptPath,
  unmergeHooks,
} from "./hooks-merge.js";

/** The hooks a plugin ships, the same for every tool: one manifest and the scripts beside it. */
export const PLUGIN_HOOKS_SOURCE = {
  kind: "hooksBundle",
  jsonPath: "hooks/hooks.json",
  scriptDir: "hooks",
} as const;

/** Where a flat build, which writes straight into a project, puts a plugin's hooks. */
export interface FlatHooksRoute {
  /** Each plugin's scripts land in a folder of its own under this one. */
  readonly scriptsDir: string;
  /** The one file every plugin's entries merge into, relative to the output root. */
  readonly sharedFile?: string;
  /** A loader that imports a module instead of reading a hooks file: the hooks reach it
   * through a bridge generated per plugin, written beside the loader's own module. */
  readonly loaderEntry?: FlatHooksLoaderEntry;
}

/** Where `plugin install` puts the hooks of a tool that never runs a plugin-scope hooks file. */
export interface ProjectHooksRoute {
  /** The hooks file as the plugin tree would hold it, relative to the plugin's own root. */
  readonly pluginFile: string;
  /** The project file every plugin's entries merge into. */
  readonly sharedFile: string;
  readonly scriptsDir: string;
}

/** The hooks file the framework install writes for a tool, outside any plugin. */
export type HooksConfig = ConstructorParameters<typeof HooksCapability>[0];

export interface HooksDescriptor {
  /** The variable the tool expands to an installed plugin's directory. */
  readonly rootToken?: string;
  /** Whether the synthesized plugin manifest names the hooks file. */
  readonly manifestNamesHooks?: boolean;
  /** What a person must still do before a delivered hook runs. */
  readonly trustNotice?: string;
  /** A source event to the tool's events it fires on; an event absent here is skipped. */
  readonly eventMap?: Readonly<Record<string, readonly string[]>>;
  /** How the tool's hooks file holds a plugin's entries; absent where none is written. */
  readonly file?: HooksFileFormat;
  readonly flat?: FlatHooksRoute;
  readonly project?: ProjectHooksRoute;
  readonly config?: HooksConfig;
  /** A module the bridges share, shipped once per project: its asset name and destination. */
  readonly bridgeRuntime?: { readonly asset: string; readonly path: string };
}

/** A merge of a tool whose hooks file no `HooksFileFormat` describes: it takes the plugin's
 * raw hooks.json and places what it ships outside `hooks/` with `locate`. */
export type HooksFileMerge = NonNullable<
  Extract<ArtifactContract, { supported: true }>["hooksFile"]
>["merge"];

/** A native plugin tree keeps the hooks where, and as, the plugin authored them. */
export function pluginTreeHooksArtifact(): ArtifactContract {
  return { supported: true, source: PLUGIN_HOOKS_SOURCE, path: (_plugin, rel) => rel };
}

/** A flat build's hooks: each plugin's scripts in a folder of its own, its entries merged into
 * the route's shared file or written to a file of the plugin's own, or, for a loader, handed to
 * the bridge generated for it. */
export function flatHooksArtifact(
  descriptor: HooksDescriptor & { readonly flat: FlatHooksRoute },
  bridge?: FlatHooksBridge["generate"],
  ownMerge?: HooksFileMerge
): ArtifactContract {
  const route = descriptor.flat;
  const { sharedFile, loaderEntry } = route;
  const { file } = descriptor;
  return {
    supported: true,
    source: PLUGIN_HOOKS_SOURCE,
    path: (plugin, rel) => flatHooksPath(route, plugin, rel),
    ...(ownMerge !== undefined && sharedFile !== undefined
      ? { hooksFile: { path: () => sharedFile, shared: true, merge: ownMerge } }
      : {}),
    ...(file === undefined || ownMerge !== undefined
      ? {}
      : {
          hooksFile: {
            path: (plugin: string) => sharedFile ?? genericFlatHooksFile(route.scriptsDir, plugin),
            shared: sharedFile !== undefined,
            merge: (
              existing: string | null,
              pluginHooks: string,
              plugin: string,
              locate: LocatePluginPath
            ) =>
              mergeHooks(
                existing,
                pluginHooks,
                plugin,
                mergeTarget(descriptor, file, route),
                locate
              ),
          },
        }),
    ...(loaderEntry !== undefined && bridge !== undefined
      ? { skipHooksJson: true, hooksBridge: hooksBridge(loaderEntry, bridge) }
      : {}),
  };
}

function mergeTarget(
  descriptor: HooksDescriptor,
  file: HooksFileFormat,
  route: { readonly scriptsDir: string }
): HooksMergeTarget {
  return { file, scriptsDir: route.scriptsDir, eventMap: descriptor.eventMap };
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
    return flatHooksPathWithLoaderEntry(route.scriptsDir, route.loaderEntry, plugin, rel);
  }
  if (rel === `${PLUGIN_HOOKS_SOURCE.scriptDir}/${plugin}.hooks.json`) {
    return genericFlatHooksFile(route.scriptsDir, plugin);
  }
  return pluginScriptPath(route.scriptsDir, plugin, rel);
}

/** The capability the framework install reads to write the tool's own hooks file. */
export function hooksConfigCapability(descriptor: {
  readonly config: HooksConfig;
}): HooksCapability {
  return new HooksCapability(descriptor.config);
}

/** A native tool's plugins capability, as far as hooks go. */
export function nativeHooksSupport(descriptor: HooksDescriptor): {
  readonly acceptsHooks: true;
  readonly pluginRootToken?: string;
  readonly hooksTrustNotice?: string;
} {
  const { rootToken, trustNotice } = descriptor;
  return {
    acceptsHooks: true,
    ...(rootToken === undefined ? {} : { pluginRootToken: rootToken }),
    ...(trustNotice === undefined ? {} : { hooksTrustNotice: trustNotice }),
  };
}

/** A flat tool's plugins capability, as far as hooks go. */
export function flatHooksSupport(
  route: FlatHooksRoute,
  bridge?: FlatHooksBridge["generate"]
): {
  readonly acceptsHooks: true;
  readonly flatHooksDir: string;
  readonly flatHooksLoaderEntry?: FlatHooksLoaderEntry;
  readonly flatHooksBridge?: FlatHooksBridge;
} {
  const { loaderEntry } = route;
  return {
    acceptsHooks: true,
    flatHooksDir: route.scriptsDir,
    ...(loaderEntry === undefined ? {} : { flatHooksLoaderEntry: loaderEntry }),
    ...(loaderEntry !== undefined && bridge !== undefined
      ? { flatHooksBridge: hooksBridge(loaderEntry, bridge) }
      : {}),
  };
}

/** The plugins capability of a tool whose hooks `plugin install` merges into the project. */
export function projectHooksSupport(
  descriptor: HooksDescriptor & {
    readonly project: ProjectHooksRoute;
    readonly file: HooksFileFormat;
  }
): {
  readonly hooksRelativePath: string;
  readonly hooksDestination: "project";
  readonly projectHooksRelativePath: string;
  readonly projectHooksFormat: ProjectHooksFormat;
} {
  const route = descriptor.project;
  const target = mergeTarget(descriptor, descriptor.file, route);
  return {
    hooksRelativePath: route.pluginFile,
    hooksDestination: "project",
    projectHooksRelativePath: route.sharedFile,
    projectHooksFormat: {
      merge: (existing, pluginHooks, plugin) => mergeHooks(existing, pluginHooks, plugin, target),
      unmerge: (existing, plugin) => unmergeHooks(existing, plugin, target),
      contributedEntries: (content, plugin) => pluginEntries(content, plugin, target),
      isEmpty: isHooksFileEmpty,
      scriptPath: (plugin, rel) => pluginScriptPath(route.scriptsDir, plugin, rel),
      scriptDir: (plugin) => pluginScriptDir(route.scriptsDir, plugin),
    },
  };
}

/** The delivery of a flat tool whose hooks `plugin install` merges into its route's shared file. */
export function flatProjectHooksDelivery(
  route: FlatHooksRoute & { readonly sharedFile: string },
  format: ProjectHooksFormat
): {
  readonly hooksDestination: "project";
  readonly projectHooksRelativePath: string;
  readonly projectHooksFormat: ProjectHooksFormat;
} {
  return {
    hooksDestination: "project",
    projectHooksRelativePath: route.sharedFile,
    projectHooksFormat: format,
  };
}
