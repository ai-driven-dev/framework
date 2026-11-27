/**
 * A tool's hooks, declared as data in `profiles/<tool>/hooks.ts`: where each route writes a
 * plugin's hooks and in what form the tool reads them. The tool's build contracts and its
 * plugins capability read the descriptor through the builders below, never restating it.
 */

import type { ArtifactContract } from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatHooksLoaderEntry } from "../../../../../shared/domain/materialization/flat-paths.js";
import type { HooksFileFormat } from "../../hooks/hooks-entry-shape.js";
import type { HooksConfigParams } from "../../sections/hooks-section.js";

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
  readonly natives: readonly string[];
  readonly relay: "native" | "bridge";
};

/** Source event to the native events the tool fires for it. */
export type HookEventMap = Readonly<Record<string, readonly string[]>>;

/** The hooks a plugin ships, the same for every tool: one manifest and the scripts beside it. */
export const PLUGIN_HOOKS_SOURCE = {
  kind: "hooksBundle",
  jsonPath: "hooks/hooks.json",
  scriptDir: "hooks",
} as const;

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

type DerivedKeys = "events" | "eventMap" | "undeclaredEvents";

export interface HooksDescriptor {
  /** The variable the tool expands to an installed plugin's directory. */
  readonly rootToken?: string;
  /** The hooks file inside a plugin's own directory, relative to its root, where the tool reads it
   * elsewhere than `hooks/hooks.json`; the plugin's scripts stay below `hooks/`. */
  readonly pluginFile?: string;
  /** Whether the synthesized plugin manifest names the hooks file. */
  readonly manifestNamesHooks?: boolean;
  /** Whether the synthesized plugin manifest lists the hooks itself, so the plugin's hooks file is
   * not shipped. */
  readonly manifestListsHooks?: boolean;
  /** What a person must still do before a delivered hook runs. */
  readonly trustNotice?: string;
  /** Canonical event to the tool's native event and how each reaches the hook. */
  readonly events: ReadonlyMap<CanonicalHookEvent, HookEventRoute>;
  /** Derived from `events`. */
  readonly eventMap: HookEventMap;
  /** `skipped`: the merge drops an event `eventMap` omits and reports it. `relayed`: it reaches
   * the tool under the name the plugin gave it. */
  readonly undeclaredEvents: "relayed" | "skipped";
  /** How the tool's hooks file holds a plugin's entries; absent where none is written. */
  readonly file?: HooksFileFormat;
  readonly flat?: FlatHooksRoute;
  readonly project?: ProjectHooksRoute;
  readonly config?: HooksConfigParams;
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
