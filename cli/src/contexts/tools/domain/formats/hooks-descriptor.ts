/**
 * A tool's hooks, declared as data in `profiles/<tool>/hooks.ts`: where each route writes a
 * plugin's hooks and in what form the tool reads them. The tool's build contracts and its
 * plugins capability read the descriptor through the builders below, never restating it.
 */

import {
  type FlatHooksLoaderEntry,
  flatHooksPathWithLoaderEntry,
  genericFlatHooksFile,
  genericFlatHooksScriptPath,
} from "../../../../kernel/materialization/flat-paths.js";
import type { ArtifactContract } from "../build-contract.js";
import { HooksCapability } from "../capabilities/hooks-capability.js";
import type { FlatHooksBridge } from "../capabilities/plugins-capability.js";
import type { HooksContentFormat, ProjectHooksFormat } from "../hooks-format.js";

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
  readonly entries: HooksContentFormat;
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
  readonly flat?: FlatHooksRoute;
  readonly project?: ProjectHooksRoute;
  readonly config?: HooksConfig;
  /** A module the bridges share, shipped once per project: its asset name and destination. */
  readonly bridgeRuntime?: { readonly asset: string; readonly path: string };
}

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

/** What a flat build does with a plugin's hooks file beyond copying its scripts. */
export interface FlatHooksBehaviour {
  /** Merges one plugin's hooks into the route's shared file. */
  readonly merge?: SupportedArtifact["hooksMerge"];
  /** Reshapes a plugin's own hooks file. */
  readonly transform?: SupportedArtifact["hooksTransform"];
  /** Generates the bridge a loader imports. */
  readonly bridge?: FlatHooksBridge["generate"];
}

/** A native plugin tree keeps the hooks where, and as, the plugin authored them. */
export function pluginTreeHooksArtifact(): ArtifactContract {
  return { supported: true, source: PLUGIN_HOOKS_SOURCE, path: (_plugin, rel) => rel };
}

export function flatHooksArtifact(
  route: FlatHooksRoute,
  behaviour: FlatHooksBehaviour = {}
): ArtifactContract {
  const { sharedFile, loaderEntry } = route;
  const { merge, transform, bridge } = behaviour;
  return {
    supported: true,
    source: PLUGIN_HOOKS_SOURCE,
    path: (plugin, rel) => flatHooksPath(route, plugin, rel),
    ...(sharedFile !== undefined && merge !== undefined
      ? { hooksMerge: merge, hooksMergeDest: (outDir: string) => `${outDir}/${sharedFile}` }
      : {}),
    ...(transform === undefined ? {} : { hooksTransform: transform }),
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
    return flatHooksPathWithLoaderEntry(route.scriptsDir, route.loaderEntry, plugin, rel);
  }
  const rest = rel.replace(/^hooks\//, "");
  if (rest === `${plugin}.hooks.json`) return genericFlatHooksFile(route.scriptsDir, plugin);
  return genericFlatHooksScriptPath(route.scriptsDir, plugin, rest);
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
  route: ProjectHooksRoute,
  format: ProjectHooksFormat
): {
  readonly hooksRelativePath: string;
  readonly hooksContentFormat: HooksContentFormat;
  readonly hooksDestination: "project";
  readonly projectHooksRelativePath: string;
  readonly projectHooksFormat: ProjectHooksFormat;
} {
  return {
    hooksRelativePath: route.pluginFile,
    hooksContentFormat: route.entries,
    hooksDestination: "project",
    projectHooksRelativePath: route.sharedFile,
    projectHooksFormat: format,
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
