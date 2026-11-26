import type { PluginMatcherGroup } from "./plugin-hooks-shape.js";

export type Entry = Record<string, unknown>;

/** A field a flat entry can carry, each read from the plugin's item or its matcher group. */
export type FlatHookField = "type" | "command" | "matcher" | "timeout";

/** How a tool's hooks file holds a plugin's entries. */
export interface HooksFileFormat {
  /** Keys the file holds beside `hooks`, written where the file has none of its own. */
  readonly wrapper: Readonly<Record<string, number>>;
  /** `matchers` keeps each item whole under its event and matcher group; `flat` lists one
   * entry per item under the event, with the fields named, in that order. */
  readonly entries:
    | {
        readonly shape: "matchers";
        /** `all` keeps every group and item as shipped; `commands` keeps only the items that
         * run a command, each typed, under its group's matcher. */
        readonly itemsKept: "all" | "commands";
      }
    | { readonly shape: "flat"; readonly fieldsKept: readonly FlatHookField[] };
}

/** A group without a hooks list runs nothing: kept as shipped where items are kept whole,
 * skipped everywhere else. */
export function shapeEntries(
  groups: readonly PluginMatcherGroup[],
  format: HooksFileFormat
): Entry[] {
  const { entries } = format;
  const listed = groups.filter((group) => Array.isArray(group.hooks));
  const commands = (group: PluginMatcherGroup) =>
    group.hooks.filter((item) => typeof item.command === "string");
  if (entries.shape === "flat") {
    return listed.flatMap((group) =>
      commands(group).map((item) => flatEntry(item, group.matcher, entries.fieldsKept))
    );
  }
  if (entries.itemsKept === "all") return [...groups];
  return listed.map((group) => ({
    matcher: group.matcher,
    hooks: commands(group).map((item) => ({ ...item, type: item.type ?? "command" })),
  }));
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
