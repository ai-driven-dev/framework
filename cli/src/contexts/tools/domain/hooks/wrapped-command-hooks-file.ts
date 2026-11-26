import type { ProjectHookEntry } from "../../contract/tool-vocabulary.js";
import {
  type HandlerGroup,
  readNamedHooks,
  serialize,
  type WrappedCommandHooksTarget,
  withoutPlugin,
} from "./wrapped-command-hooks-merge.js";

const isGroup = (entry: ProjectHookEntry | HandlerGroup): entry is HandlerGroup => "hooks" in entry;

export function unmergeWrappedCommandHooks(existingJson: string, pluginName: string): string {
  return serialize(withoutPlugin(existingJson, pluginName));
}

export function wrappedCommandHookEntries(
  target: WrappedCommandHooksTarget,
  content: string,
  pluginName: string
): readonly { event: string; entry: ProjectHookEntry }[] {
  const { enabled: _enabled, ...events } = readNamedHooks(content)[pluginName] ?? {};
  return Object.entries(events).flatMap(([event, entries]) => {
    if (!Array.isArray(entries)) {
      throw new Error(`${target.label} hook '${pluginName}.${event}' must be an array.`);
    }
    return entries.flatMap((entry) =>
      (isGroup(entry) ? entry.hooks : [entry]).map((handler) => ({ event, entry: handler }))
    );
  });
}

export function isWrappedCommandHooksFileEmpty(content: string): boolean {
  return Object.keys(readNamedHooks(content)).length === 0;
}
