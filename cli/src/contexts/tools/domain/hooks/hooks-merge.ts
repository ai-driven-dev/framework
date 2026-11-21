/**
 * One engine merges a plugin's hooks into a tool's hooks file and takes them out again, for
 * every tool and route: what differs per tool is its descriptor. Pure text in, text out; the
 * caller reads and writes.
 */

import { genericFlatHooksScriptPath } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import type { ShippedHooks } from "../../contract/build-contract.js";
import { type Entry, type HooksFileFormat, shapeEntries } from "./hooks-entry-shape.js";
import type { PluginHooksShape } from "./plugin-hooks-shape.js";

/** What the engine reads of a descriptor: the file's form and the events the tool fires. */
export interface HooksMergeTarget {
  readonly file: HooksFileFormat;
  readonly eventMap?: Readonly<Record<string, readonly string[]>> | undefined;
  /** Each plugin's scripts land in a folder of its own under this one. */
  readonly scriptsDir: string;
  /** The variable the tool expands to a plugin's directory: a command may name the plugin's
   * folder after it. Any other variable is a person's own, never the plugin's. */
  readonly rootToken?: string | undefined;
}

const SCRIPTS = "hooks/";

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

/** Merges a plugin's hooks, as the plugin ships them, into the tool's file: its commands
 * pointed at where its scripts land, its earlier entries removed first, every other entry kept.
 * An event the tool does not fire is skipped and reported. */
export function mergeHooks(
  existing: string | null,
  shipped: ShippedHooks,
  target: HooksMergeTarget
): { content: string; warnings: readonly string[] } {
  const file = stripPlugin(parseFile(existing), shipped.plugin, target);
  const hooks = file.hooks ?? {};
  const warnings: string[] = [];
  const rewritten = rewriteRoot(shipped, target.scriptsDir).hooks ?? {};
  for (const [event, groups] of Object.entries(rewritten)) {
    const toolEvents = target.eventMap === undefined ? [event] : target.eventMap[event];
    if (toolEvents === undefined) {
      warnings.push(`unmapped event '${event}' skipped`);
      continue;
    }
    appendEntries(hooks, toolEvents, shapeEntries(groups, target.file));
  }
  return { content: serialize(file, hooks, target.file), warnings };
}

function appendEntries(
  hooks: Record<string, Entry[]>,
  toolEvents: readonly string[],
  entries: readonly Entry[]
): void {
  for (const toolEvent of toolEvents) hooks[toolEvent] = [...(hooks[toolEvent] ?? []), ...entries];
}

/** Takes one plugin's entries out of the tool's file, leaving every other entry as it was. */
export function unmergeHooks(existing: string, plugin: string, target: HooksMergeTarget): string {
  const file = stripPlugin(parseFile(existing), plugin, target);
  return serialize(file, file.hooks ?? {}, target.file);
}

/** The entries one plugin contributed, each under the event the file holds it in: a matcher
 * group's items one by one, a flat entry whole. */
export function pluginEntries(
  content: string,
  plugin: string,
  target: HooksMergeTarget
): readonly { event: string; entry: Entry & { command: string } }[] {
  return Object.entries(parseFile(content).hooks ?? {}).flatMap(([event, entries]) =>
    entries
      .flatMap((entry) => (Array.isArray(entry.hooks) ? (entry.hooks as Entry[]) : [entry]))
      .filter((item): item is Entry & { command: string } =>
        runsPluginScript(String(item.command), plugin, target)
      )
      .map((entry) => ({ event, entry }))
  );
}

/** Whether the file holds no entry at all, so removing it loses nothing. */
export function isHooksFileEmpty(content: string): boolean {
  return Object.keys(parseFile(content).hooks ?? {}).length === 0;
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
  { json, plugin, locate = (pluginPath) => pluginPath }: ShippedHooks,
  scriptsDir: string
): PluginHooksShape {
  return rewritePluginRootInJson(JSON.parse(json), (suffix) =>
    suffix.startsWith(SCRIPTS)
      ? `./${pluginScriptPath(scriptsDir, plugin, suffix)}`
      : locate(suffix)
  ) as PluginHooksShape;
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether a command runs one of the plugin's scripts: its folder starts a path, at the start
 * of the command or after a space or a quote, bare, after `./` or after the tool's root token. */
function runsPluginScript(
  command: string,
  plugin: string,
  { scriptsDir, rootToken }: HooksMergeTarget
): boolean {
  const dir = escaped(pluginScriptDir(scriptsDir, plugin));
  const prefix = rootToken === undefined ? "\\./" : `\\./|${escaped(rootToken)}/`;
  return new RegExp(`(?:^|[\\s"'])(?:${prefix})?${dir}`).test(command);
}

/** The file without the plugin's entries: an event, or a matcher group, left with none of its
 * own is dropped, one that never had any is kept. */
function stripPlugin(file: HooksFile, plugin: string, target: HooksMergeTarget): HooksFile {
  const ours = (item: Entry) => runsPluginScript(String(item.command), plugin, target);
  const hooks: Record<string, Entry[]> = {};
  for (const [event, entries] of Object.entries(file.hooks ?? {})) {
    const kept = entries.flatMap((entry) => withoutOurs(entry, ours));
    if (kept.length > 0) hooks[event] = kept;
  }
  return { ...file, hooks };
}

/** The entry left once the plugin's items are out of it: none, itself, or itself trimmed. */
function withoutOurs(entry: Entry, ours: (item: Entry) => boolean): Entry[] {
  if (!Array.isArray(entry.hooks)) return ours(entry) ? [] : [entry];
  const items = (entry.hooks as Entry[]).filter((item) => !ours(item));
  if (items.length === entry.hooks.length) return [entry];
  return items.length === 0 ? [] : [{ ...entry, hooks: items }];
}
