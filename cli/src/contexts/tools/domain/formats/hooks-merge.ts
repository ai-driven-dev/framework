/**
 * One engine merges a plugin's hooks into a tool's hooks file and takes them out again, for
 * every tool and route: what differs per tool is its descriptor. Pure text in, text out; the
 * caller reads and writes.
 */

import { genericFlatHooksScriptPath } from "../../../../kernel/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../kernel/materialization/plugin-root-path-rewrite.js";
import type { PluginHooksShape, PluginMatcherGroup } from "./plugin-hooks-shape.js";

/** A field a flat entry can carry, each read from the plugin's item or its matcher group. */
export type FlatHookField = "type" | "command" | "matcher" | "timeout";

/** How a tool's hooks file holds a plugin's entries. */
export interface HooksFileFormat {
  /** Keys the file holds beside `hooks`, written where the file has none of its own. */
  readonly wrapper: Readonly<Record<string, number>>;
  /** `matchers` keeps each item whole under its event and matcher group; `flat` lists one
   * entry per item under the event, with the fields named, in that order. */
  readonly entries:
    | { readonly shape: "matchers" }
    | { readonly shape: "flat"; readonly fieldsKept: readonly FlatHookField[] };
}

/** What the engine reads of a descriptor: the file's form and the events the tool fires. */
export interface HooksMergeTarget {
  readonly file: HooksFileFormat;
  readonly eventMap?: Readonly<Record<string, readonly string[]>> | undefined;
  /** Each plugin's scripts land in a folder of its own under this one. */
  readonly scriptsDir: string;
}

const SCRIPTS = "hooks/";

type Entry = Record<string, unknown>;
type HooksFile = Record<string, unknown> & { hooks?: Record<string, Entry[]> };

/** The folder a plugin's scripts land in. Every entry the plugin contributes names it, and no
 * other plugin's or person's does, so it is how the plugin's own entries are found again. */
export function pluginScriptDir(scriptsDir: string, plugin: string): string {
  return `${scriptsDir}${plugin}/`;
}

/** Where a script the plugin ships under `hooks/` lands, given its path in the plugin. */
export function pluginScriptPath(scriptsDir: string, plugin: string, pluginPath: string): string {
  const rest = pluginPath.startsWith(SCRIPTS) ? pluginPath.slice(SCRIPTS.length) : pluginPath;
  return genericFlatHooksScriptPath(scriptsDir, plugin, rest);
}

/** Where a path the plugin ships outside `hooks/` lands; the caller knows its other artifacts. */
export type LocatePluginPath = (pluginPath: string) => string;

/** Merges a plugin's hooks, as the plugin ships them, into the tool's file: its commands
 * pointed at where its scripts land, its earlier entries removed first, every other entry kept.
 * An event the tool does not fire is skipped and reported. */
export function mergeHooks(
  existing: string | null,
  pluginHooks: string,
  plugin: string,
  target: HooksMergeTarget,
  locate: LocatePluginPath = (pluginPath) => pluginPath
): { content: string; warnings: readonly string[] } {
  const file = stripPlugin(parseFile(existing), plugin, target.scriptsDir);
  const hooks = file.hooks ?? {};
  const warnings: string[] = [];
  const shipped = rewriteRoot(pluginHooks, plugin, target.scriptsDir, locate).hooks ?? {};
  for (const [event, groups] of Object.entries(shipped)) {
    const toolEvents = target.eventMap === undefined ? [event] : target.eventMap[event];
    if (toolEvents === undefined) {
      warnings.push(`unmapped event '${event}' skipped`);
      continue;
    }
    const entries = shapeEntries(groups, target.file);
    for (const toolEvent of toolEvents)
      hooks[toolEvent] = [...(hooks[toolEvent] ?? []), ...entries];
  }
  return { content: serialize(file, hooks, target.file), warnings };
}

/** Takes one plugin's entries out of the tool's file, leaving every other entry as it was. */
export function unmergeHooks(existing: string, plugin: string, target: HooksMergeTarget): string {
  const file = stripPlugin(parseFile(existing), plugin, target.scriptsDir);
  return serialize(file, file.hooks ?? {}, target.file);
}

function parseFile(content: string | null): HooksFile {
  return content === null ? {} : (JSON.parse(content) as HooksFile);
}

/** A file left with no entry carries no `hooks` key at all, as Copilot's own files do. */
function serialize(file: HooksFile, hooks: Record<string, Entry[]>, format: HooksFileFormat) {
  const { hooks: _none, ...rest } = { ...format.wrapper, ...file };
  const out = Object.keys(hooks).length === 0 ? rest : { ...format.wrapper, ...file, hooks };
  return `${JSON.stringify(out, null, 2)}\n`;
}

function rewriteRoot(
  pluginHooks: string,
  plugin: string,
  scriptsDir: string,
  locate: LocatePluginPath
): PluginHooksShape {
  return rewritePluginRootInJson(JSON.parse(pluginHooks), (suffix) =>
    suffix.startsWith(SCRIPTS)
      ? `./${pluginScriptPath(scriptsDir, plugin, suffix)}`
      : `./${locate(suffix)}`
  ) as PluginHooksShape;
}

function namesDir(item: Entry, dir: string): boolean {
  return typeof item.command === "string" && item.command.includes(dir);
}

/** The file without the plugin's entries: an event, or a matcher group, left with none of its
 * own is dropped, one that never had any is kept. */
function stripPlugin(file: HooksFile, plugin: string, scriptsDir: string): HooksFile {
  const dir = pluginScriptDir(scriptsDir, plugin);
  const hooks: Record<string, Entry[]> = {};
  for (const [event, entries] of Object.entries(file.hooks ?? {})) {
    const kept = entries.flatMap((entry) => {
      if (!Array.isArray(entry.hooks)) return namesDir(entry, dir) ? [] : [entry];
      const items = (entry.hooks as Entry[]).filter((item) => !namesDir(item, dir));
      if (items.length === entry.hooks.length) return [entry];
      return items.length === 0 ? [] : [{ ...entry, hooks: items }];
    });
    if (kept.length > 0) hooks[event] = kept;
  }
  return { ...file, hooks };
}

function shapeEntries(groups: readonly PluginMatcherGroup[], format: HooksFileFormat): Entry[] {
  const { entries } = format;
  if (entries.shape === "matchers") {
    return groups.map((group) => ({
      matcher: group.matcher,
      hooks: group.hooks
        .filter((item) => typeof item.command === "string")
        .map((item) => ({ ...item, type: item.type ?? "command" })),
    }));
  }
  return groups.flatMap((group) =>
    group.hooks
      .filter((item) => typeof item.command === "string")
      .map((item) => flatEntry(item, group.matcher, entries.fieldsKept))
  );
}

function flatEntry(
  item: PluginMatcherGroup["hooks"][number],
  matcher: string | undefined,
  fields: readonly FlatHookField[]
): Entry {
  const value: Record<FlatHookField, unknown> = {
    type: item.type ?? "command",
    command: item.command,
    matcher: matcher === "" ? undefined : matcher,
    timeout: typeof item.timeout === "number" ? item.timeout : undefined,
  };
  // An absent field is left out when the file is serialized.
  return Object.fromEntries(fields.map((field) => [field, value[field]]));
}
