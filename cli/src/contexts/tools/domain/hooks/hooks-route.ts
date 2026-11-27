import type { HookEventMap } from "../formats/hooks/descriptor.js";
import type { PluginMatcherGroup } from "./plugin-hooks-shape.js";

function toolEventsOf(event: string, eventMap: HookEventMap | undefined): readonly string[] {
  if (eventMap === undefined) return [event];
  return Object.hasOwn(eventMap, event) ? eventMap[event] : [];
}

/** A plugin's events sent to every event a tool fires for each, shaped by `shape` for the tool's
 * file; an event the tool never fires is left out and named. A tool without an event map fires
 * every event under its own name. */
export function routeEvents<T>(
  events: readonly (readonly [string, readonly PluginMatcherGroup[]])[],
  eventMap: HookEventMap | undefined,
  shape: (groups: readonly PluginMatcherGroup[], toolEvent: string) => T
): { routed: [string, T][]; skipped: string[] } {
  const routed: [string, T][] = [];
  const skipped: string[] = [];
  for (const [event, groups] of events) {
    const toolEvents = toolEventsOf(event, eventMap);
    if (toolEvents.length === 0) skipped.push(event);
    for (const toolEvent of toolEvents) routed.push([toolEvent, shape(groups, toolEvent)]);
  }
  return { routed, skipped };
}
