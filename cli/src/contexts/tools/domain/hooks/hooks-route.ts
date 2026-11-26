import type { PluginMatcherGroup } from "./plugin-hooks-shape.js";

function toolEventOf(
  event: string,
  eventMap: Readonly<Record<string, string>> | undefined
): string | undefined {
  if (eventMap === undefined) return event;
  return Object.hasOwn(eventMap, event) ? eventMap[event] : undefined;
}

/** A plugin's events sent to the events a tool fires, each shaped by `shape` for the tool's file;
 * an event the tool never fires is left out and named. A tool without an event map fires every
 * event under its own name. */
export function routeEvents<T>(
  events: readonly (readonly [string, readonly PluginMatcherGroup[]])[],
  eventMap: Readonly<Record<string, string>> | undefined,
  shape: (groups: readonly PluginMatcherGroup[], toolEvent: string) => T
): { routed: [string, T][]; skipped: string[] } {
  const routed: [string, T][] = [];
  const skipped: string[] = [];
  for (const [event, groups] of events) {
    const toolEvent = toolEventOf(event, eventMap);
    if (toolEvent === undefined) skipped.push(event);
    else routed.push([toolEvent, shape(groups, toolEvent)]);
  }
  return { routed, skipped };
}
