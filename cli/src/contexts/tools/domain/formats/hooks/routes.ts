/** What the builders read of a descriptor to deliver a tool's hooks: where each route writes them. */

import { CapabilityConfigError } from "../../../../../shared/domain/errors.js";
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
import type { HookScript, ProjectHooksFormat } from "../../../contract/tool-vocabulary.js";
import {
  type HooksFileFormat,
  type HooksMergeTarget,
  isHooksFileEmpty,
  mergeHooks,
  pluginEntries,
  pluginScriptDir,
  pluginScriptPath,
  unmergeHooks,
} from "../../hooks/hooks-merge.js";
import {
  type BridgeDelivery,
  type HooksConfigParams,
  HooksConfigPart,
  type HooksFlatPart,
  type PluginFileDelivery,
  type ProjectMergeDelivery,
} from "../../sections/hooks-section.js";
import {
  type FlatHooksRoute,
  type HooksFileMerge,
  type HooksRouting,
  PLUGIN_HOOKS_SOURCE,
  type ProjectHooksRoute,
} from "./descriptor.js";

/** Where a plugin keeps the adapter between its hooks and the host: Claude Code's, as shipped,
 * which a build for another tool replaces with that tool's. */
const HOST_ADAPTER_PATH = "hooks/lib/host.cjs";

function hookScript(descriptor: HooksRouting): HookScript | undefined {
  const adapter = descriptor.runtime?.adapter;
  if (adapter === undefined) return undefined;
  return (pluginPath, content) => (pluginPath === HOST_ADAPTER_PATH ? adapter : content);
}

function withHookScript(descriptor: HooksRouting): { readonly hookScript?: HookScript } {
  const swap = hookScript(descriptor);
  return swap === undefined ? {} : { hookScript: swap };
}

/** A native plugin tree keeps the hooks where, and as, the plugin authored them, the tool's
 * adapter aside. */
export function pluginTreeHooksArtifact(descriptor: HooksRouting): ArtifactContract {
  return {
    supported: true,
    source: PLUGIN_HOOKS_SOURCE,
    path: (_plugin, rel) => rel,
    script: hookScript(descriptor),
  };
}

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

function mergeTarget(
  descriptor: HooksRouting,
  file: HooksFileFormat,
  route: { readonly scriptsDir: string }
): HooksMergeTarget {
  return {
    file,
    scriptsDir: route.scriptsDir,
    eventMap: descriptor.undeclaredEvents === "skipped" ? descriptor.eventMap : undefined,
    rootToken: descriptor.rootToken,
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

/** The part the framework install reads to write the tool's own hooks file. */
export function hooksConfigPart(descriptor: {
  readonly config: HooksConfigParams;
}): HooksConfigPart {
  return new HooksConfigPart(descriptor.config);
}

/** A native tool's hooks, as far as plugins go: they stay in the plugin's own directory. */
export function nativeHooksSupport(descriptor: HooksRouting): {
  readonly delivery: PluginFileDelivery;
  readonly rootToken: string;
} {
  const { rootToken, trustNotice } = descriptor;
  if (rootToken === undefined) {
    throw new CapabilityConfigError("native mode requires a pluginRootToken.");
  }
  return {
    delivery: {
      kind: "plugin-file",
      ...withHookScript(descriptor),
      ...(trustNotice === undefined ? {} : { trustNotice }),
    },
    rootToken,
  };
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

/** The hooks of a tool whose `plugin install` merges them into the project's own file. */
export function projectHooksSupport(
  descriptor: HooksRouting & {
    readonly project: ProjectHooksRoute;
    readonly file: HooksFileFormat;
  }
): ProjectMergeDelivery {
  const route = descriptor.project;
  const target = mergeTarget(descriptor, descriptor.file, route);
  const { trustNotice } = descriptor;
  return {
    kind: "project-merge",
    pluginFile: route.pluginFile,
    project: {
      relativePath: route.sharedFile,
      format: {
        merge: (existing, json, plugin) => mergeHooks(existing, { json, plugin }, target),
        unmerge: (existing, plugin) => unmergeHooks(existing, plugin, target),
        contributedEntries: (content, plugin) => pluginEntries(content, plugin, target),
        isEmpty: isHooksFileEmpty,
        scriptPath: (plugin, rel) => pluginScriptPath(route.scriptsDir, plugin, rel),
        scriptDir: (plugin) => pluginScriptDir(route.scriptsDir, plugin),
      },
    },
    ...withHookScript(descriptor),
    ...(trustNotice === undefined ? {} : { trustNotice }),
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
