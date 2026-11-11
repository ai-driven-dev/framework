/**
 * A tool's hooks, declared as data in `profiles/<tool>/hooks.ts`: where each route writes a
 * plugin's hooks and in what form the tool reads them. The tool's build contracts and its
 * plugins capability read the descriptor through the builders below, never restating it.
 */

import { isAbsolute } from "node:path";
import { type HooksInvariant, InvalidHooksDescriptorError } from "../../../../kernel/errors.js";
import {
  type FlatHooksLoaderEntry,
  flatHooksPathWithLoaderEntry,
  genericFlatHooksFile,
} from "../../../../kernel/materialization/flat-paths.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import type { ArtifactContract } from "../build-contract.js";
import { HooksCapability } from "../capabilities/hooks-capability.js";
import type {
  FlatHooksBridge,
  HookScript,
  ProjectHooksFormat,
} from "../capabilities/plugins-capability.js";
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
import { PLUGIN_ROOT_TOKEN } from "./plugin-root-token.js";

/** The events a plugin's hooks may name, whichever tool runs them. */
export const CANONICAL_HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SessionEnd",
  "SubagentStop",
] as const;

export type CanonicalHookEvent = (typeof CANONICAL_HOOK_EVENTS)[number];

/** The tool's native events a canonical event fires on, and whether the tool's own hooks file
 * ("native") or a bridge it loads ("bridge") carries it to the hook. */
export type HookEventRoute = {
  readonly native: readonly string[];
  readonly relay: "native" | "bridge";
};

/** The hooks a plugin ships, the same for every tool: one manifest and the scripts beside it. */
export const PLUGIN_HOOKS_SOURCE = {
  kind: "hooksBundle",
  jsonPath: "hooks/hooks.json",
  scriptDir: "hooks",
} as const;

/** Where a plugin keeps the adapter between its hooks and the host: Claude Code's, as shipped,
 * which a build for another tool replaces with that tool's. */
const HOST_ADAPTER_PATH = "hooks/lib/host.cjs";

/** How a hook reaches the tool at run time. */
export interface HooksRuntime {
  /** The adapter put behind the interface every framework hook speaks, as source text. */
  readonly adapter: string;
}

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

type DerivedKeys = "events" | "eventMap" | "undeclaredEvents";

export interface HooksDescriptor {
  /** The variable the tool expands to an installed plugin's directory. */
  readonly rootToken?: string;
  /** Whether the synthesized plugin manifest names the hooks file. */
  readonly manifestNamesHooks?: boolean;
  /** What a person must still do before a delivered hook runs. */
  readonly trustNotice?: string;
  /** Canonical event to the tool's native events and how each reaches the hook. */
  readonly events: ReadonlyMap<CanonicalHookEvent, HookEventRoute>;
  /** Source event to the tool's native events, derived from `events`. */
  readonly eventMap: Readonly<Record<string, readonly string[]>>;
  /** `skipped`: the merge drops an event `eventMap` omits and reports it. `relayed`: it reaches
   * the tool under the name the plugin gave it. */
  readonly undeclaredEvents: "relayed" | "skipped";
  /** How the tool's hooks file holds a plugin's entries; absent where none is written. */
  readonly file?: HooksFileFormat;
  readonly flat?: FlatHooksRoute;
  readonly project?: ProjectHooksRoute;
  readonly config?: HooksConfig;
  readonly runtime?: HooksRuntime;
  /** A module the bridges share, shipped once per project: its asset name and destination. */
  readonly bridgeRuntime?: { readonly asset: string; readonly path: string };
}

/** A merge of a tool whose hooks file no `HooksFileFormat` describes: it takes the plugin's
 * raw hooks.json and places what it ships outside `hooks/` with `locate`. */
export type HooksFileMerge = NonNullable<
  Extract<ArtifactContract, { supported: true }>["hooksFile"]
>["merge"];

/** Phantom, never built: its private member makes the type nominal, so only `declareHooks` yields
 * a value of it and a literal object is refused where a builder takes a descriptor. */
export declare class HooksBrand {
  private readonly hooksBrand: true;
}

/** What the builders read of a descriptor: where the hooks go, never the events' routes. */
export type HooksRouting = Omit<HooksDescriptor, DerivedKeys> &
  Partial<Pick<HooksDescriptor, DerivedKeys>> &
  HooksBrand;

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
  reader: { readonly tool: AiToolId },
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
  reader: { readonly tool: AiToolId } | { readonly bridge: FlatHooksBridge["generate"] },
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
      : (existing, pluginHooks, plugin, locate) =>
          mergeHooks(existing, pluginHooks, plugin, mergeTarget(descriptor, file, route), locate));
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
            merge: (
              existing: string | null,
              pluginHooks: string,
              plugin: string,
              locate: LocatePluginPath
            ) => {
              const merged = merge(existing, pluginHooks, plugin, locate);
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
export function nativeHooksSupport(descriptor: HooksRouting): {
  readonly acceptsHooks: true;
  readonly pluginRootToken?: string;
  readonly hooksTrustNotice?: string;
  readonly hookScript?: HookScript;
} {
  const { rootToken, trustNotice } = descriptor;
  return {
    acceptsHooks: true,
    ...withHookScript(descriptor),
    ...(rootToken === undefined ? {} : { pluginRootToken: rootToken }),
    ...(trustNotice === undefined ? {} : { hooksTrustNotice: trustNotice }),
  };
}

/** A flat tool's plugins capability, as far as hooks go. */
export function flatHooksSupport(
  descriptor: HooksRouting & { readonly flat: FlatHooksRoute },
  bridge?: FlatHooksBridge["generate"]
): {
  readonly acceptsHooks: true;
  readonly flatHooksDir: string;
  readonly flatHooksLoaderEntry?: FlatHooksLoaderEntry;
  readonly flatHooksBridge?: FlatHooksBridge;
  readonly hookScript?: HookScript;
} {
  const route = descriptor.flat;
  const { loaderEntry } = route;
  return {
    acceptsHooks: true,
    flatHooksDir: route.scriptsDir,
    ...withHookScript(descriptor),
    ...(loaderEntry === undefined ? {} : { flatHooksLoaderEntry: loaderEntry }),
    ...(loaderEntry !== undefined && bridge !== undefined
      ? { flatHooksBridge: hooksBridge(loaderEntry, bridge) }
      : {}),
  };
}

/** The plugins capability of a tool whose hooks `plugin install` merges into the project. */
export function projectHooksSupport(
  descriptor: HooksRouting & {
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

/** An event as its tool declares it: the native event it fires on, or several, through the
 * tool's hooks file; or the whole route. */
export type HookEventDeclaration = string | readonly string[] | HookEventRoute;

/** A descriptor as its tool writes it. What it leaves out is what most tools share: every
 * canonical event fired under its own name, an event it never names still reaching the hook,
 * and the plugin-root variable a hooks file's commands hold. */
export interface HooksDeclaration
  extends Omit<
    HooksDescriptor,
    "events" | "eventMap" | "runtime" | "undeclaredEvents" | "rootToken"
  > {
  readonly events?: Readonly<Record<string, HookEventDeclaration>>;
  readonly undeclaredEvents?: HooksDescriptor["undeclaredEvents"];
  readonly rootToken?: string;
}

type Refuse = (invariant: HooksInvariant, detail: string) => never;

function routeOf(declared: HookEventDeclaration): HookEventRoute {
  if (typeof declared === "string") return { native: [declared], relay: "native" };
  return "native" in declared ? declared : { native: declared, relay: "native" };
}

function canonicalEvents(
  declared: Readonly<Record<string, HookEventDeclaration>>,
  refuse: Refuse
): ReadonlyMap<CanonicalHookEvent, HookEventRoute> {
  const events = new Map<CanonicalHookEvent, HookEventRoute>();
  for (const [name, declaredRoute] of Object.entries(declared)) {
    const route = routeOf(declaredRoute);
    const event = CANONICAL_HOOK_EVENTS.find((canonical) => canonical === name);
    if (event === undefined) return refuse("unknown-event", `${name} is not a canonical event`);
    if (route.native.length === 0) {
      return refuse("empty-native-list", `${name} is fired on no native event`);
    }
    if (new Set(route.native).size !== route.native.length) {
      return refuse("duplicate-native-event", `${name} names a native event twice`);
    }
    events.set(event, route);
  }
  return events;
}

function ownPaths(declaration: HooksDeclaration): readonly string[] {
  const { flat, project, bridgeRuntime, config } = declaration;
  return [
    flat?.scriptsDir,
    flat?.sharedFile,
    flat?.loaderEntry?.dir,
    project?.sharedFile,
    project?.scriptsDir,
    bridgeRuntime?.path,
    config?.outputPath,
  ].filter((path): path is string => path !== undefined);
}

function stamped(toolId: AiToolId, adapter: string, refuse: Refuse): HooksRuntime {
  const stamp = `const HOST = "${toolId}";`;
  const stampedAdapter = adapter.replace('const HOST = "unstamped";', stamp);
  return stampedAdapter.includes(stamp)
    ? { adapter: stampedAdapter }
    : refuse("adapter-not-stamped", `the adapter does not name ${toolId} as its host`);
}

type DeclaredHooks<D extends HooksDeclaration> = Omit<
  D,
  "events" | "undeclaredEvents" | "rootToken"
> & {
  readonly events: ReadonlyMap<CanonicalHookEvent, HookEventRoute>;
  readonly eventMap: Readonly<Record<string, readonly string[]>>;
  readonly undeclaredEvents: HooksDescriptor["undeclaredEvents"];
  readonly rootToken: string | undefined;
  readonly runtime: HooksRuntime;
} & HooksBrand;

/** The one door to a descriptor: refuses what no tool could run, and derives what the readers
 * of a descriptor need from the events it declares. */
export function declareHooks<const D extends HooksDeclaration>(
  toolId: AiToolId,
  directory: string,
  adapter: string,
  declaration: D
): DeclaredHooks<D> {
  const refuse: Refuse = (invariant, detail) => {
    throw new InvalidHooksDescriptorError(toolId, invariant, detail);
  };
  const {
    events: declared = ownNameEvents(),
    undeclaredEvents = "relayed",
    rootToken,
    ...rest
  } = declaration;
  const events = canonicalEvents(declared, refuse);
  if (declaration.project !== undefined && declaration.file === undefined) {
    refuse("project-without-file", "a project route merges through the hooks file's format");
  }
  if (declaration.flat?.loaderEntry !== undefined && declaration.file !== undefined) {
    refuse("loader-with-file", "a loader imports a bridge instead of reading a hooks file");
  }
  if (rootToken !== undefined && declaration.file === undefined) {
    refuse("root-token-without-file", "the root token names what a hooks file's commands hold");
  }
  for (const path of ownPaths(declaration)) {
    if (isAbsolute(path) || path.split("/").includes("..") || !path.startsWith(directory)) {
      refuse("path-outside-directory", `${path} is not under ${directory}`);
    }
  }
  const declared_ = {
    ...rest,
    runtime: stamped(toolId, adapter, refuse),
    events,
    undeclaredEvents,
    eventMap: Object.fromEntries([...events].map(([event, route]) => [event, route.native])),
    rootToken: declaration.file === undefined ? undefined : (rootToken ?? PLUGIN_ROOT_TOKEN),
  };
  return declared_ as typeof declared_ & HooksBrand;
}

/** The events a tool fires under their own names through its hooks file: every canonical event,
 * less those it never fires. */
export function ownNameEvents(
  without: { readonly except?: readonly CanonicalHookEvent[] } = {}
): Record<string, HookEventRoute> {
  const names = CANONICAL_HOOK_EVENTS.filter((name) => !without.except?.includes(name));
  return Object.fromEntries(names.map((name) => [name, { native: [name], relay: "native" }]));
}
