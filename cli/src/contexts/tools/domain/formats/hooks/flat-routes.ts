/** The flat routes of a descriptor: where a flat build and a flat install write a tool's hooks. */

import type {
  ArtifactContract,
  FlatHooksBridge,
  SupportedArtifact,
} from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatHooksLoaderEntry } from "../../../../../shared/domain/materialization/flat-paths.js";
import { toolWarning } from "../../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { ProjectHooksFormat } from "../../../contract/tool-vocabulary.js";
import { mergeHooks } from "../../hooks/hooks-merge.js";
import { unmappedEventWarning } from "../../hooks/hooks-warnings.js";
import type { BridgeDelivery, ProjectMergeDelivery } from "../../sections/hooks-section.js";
import {
  type FlatHooksRoute,
  type HooksFileMerge,
  type HooksRouting,
  PLUGIN_HOOKS_SOURCE,
} from "./descriptor.js";
import { hookScript, mergeTarget, withHookScript } from "./routes.js";

/** What a bridge makes of a plugin's raw hooks.json, read once: the module, `null` when no mapped
 * event names anything replayable, and the events it names that no bridge replays. */
export interface GeneratedBridge {
  readonly content: string | null;
  readonly unrelayed: readonly string[];
}

/** A loader's bridge generator: a plugin's raw hooks.json and its name, to its bridge. */
type BridgeGenerator = (rawHooksJson: string, plugin: string) => GeneratedBridge;

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
  reader: { readonly tool: string; readonly bridge: BridgeGenerator }
): ArtifactContract;
export function flatHooksArtifact(
  descriptor: HooksRouting & { readonly flat: FlatHooksRoute },
  /** The tool the warnings are reported under, and the bridge a loader imports. */
  reader: { readonly tool: string; readonly bridge?: BridgeGenerator },
  /** The tool's own merge, for a hooks file no `HooksFileFormat` describes. */
  ownMerge?: HooksFileMerge
): ArtifactContract {
  const route = descriptor.flat;
  const { loaderEntry } = route;
  const { tool, bridge } = reader;
  const hooksFile = bridge === undefined ? hooksFileOf(descriptor, tool, ownMerge) : undefined;
  return {
    supported: true,
    source: PLUGIN_HOOKS_SOURCE,
    placement: {
      kind: "hooks",
      scriptsDir: route.scriptsDir,
      ...(loaderEntry === undefined ? {} : { loaderEntry }),
    },
    script: hookScript(descriptor),
    ...(hooksFile === undefined ? {} : { hooksFile }),
    ...(loaderEntry !== undefined && bridge !== undefined
      ? { skipHooksJson: true, hooksBridge: hooksBridge(loaderEntry, bridge, tool) }
      : {}),
  };
}

function hooksFileOf(
  descriptor: HooksRouting & { readonly flat: FlatHooksRoute },
  tool: string,
  ownMerge?: HooksFileMerge
): NonNullable<SupportedArtifact["hooksFile"]> | undefined {
  const { file } = descriptor;
  const route = descriptor.flat;
  const merge: HooksFileMerge | undefined =
    ownMerge ??
    (file === undefined
      ? undefined
      : (existing, shipped) => mergeHooks(existing, shipped, mergeTarget(descriptor, file, route)));
  if (merge === undefined) return undefined;
  return {
    at: route.sharedFile === undefined ? { own: route.scriptsDir } : { shared: route.sharedFile },
    merge: (existing, shipped) => {
      const merged = merge(existing, shipped);
      return { ...merged, warnings: merged.warnings.map((w) => toolWarning(tool, w)) };
    },
  };
}

/** Where the bridge generated for one plugin lands: beside the loader's own module, renamed
 * per plugin so two plugins each getting one cannot collide. */
export function hooksBridgePath(loaderEntry: FlatHooksLoaderEntry, plugin: string): string {
  return `${loaderEntry.dir}${plugin}-hooks.js`;
}

function hooksBridge(
  loaderEntry: FlatHooksLoaderEntry,
  generate: BridgeGenerator,
  tool: string
): FlatHooksBridge {
  return {
    generate: (rawHooksJson, plugin) => {
      const { content, unrelayed } = generate(rawHooksJson, plugin);
      return { content, warnings: unrelayed.map(unmappedEventWarning) };
    },
    warning: (reason) => toolWarning(tool, reason),
    dir: loaderEntry.dir,
    skipIfSourceHas: loaderEntry.baseName,
  };
}

/** A flat tool's hooks, as far as plugins go: a loader reads them from its own directory. */
export function flatHooksSupport(
  descriptor: HooksRouting & { readonly flat: FlatHooksRoute }
): BridgeDelivery {
  return { kind: "bridge", ...withHookScript(descriptor) };
}

/** A flat tool's hooks that `plugin install` merges into its route's shared file. */
export function flatProjectHooksDelivery(
  bridge: BridgeDelivery,
  route: FlatHooksRoute & { readonly sharedFile: string },
  format: ProjectHooksFormat
): ProjectMergeDelivery & { readonly flat: true } {
  return {
    kind: "project-merge",
    project: { relativePath: route.sharedFile, format },
    flat: true,
    ...(bridge.hookScript === undefined ? {} : { hookScript: bridge.hookScript }),
  };
}
