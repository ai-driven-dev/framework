import { type Entry, type HooksFileFormat, shapeEntries } from "./hooks-entry-shape.js";
import type { PluginMatcherGroup } from "./plugin-hooks-shape.js";

function toolEventOf(
  event: string,
  eventMap: Readonly<Record<string, string>> | undefined
): string | undefined {
  if (eventMap === undefined) return event;
  return Object.hasOwn(eventMap, event) ? eventMap[event] : undefined;
}

/** A plugin's events sent to the events a tool fires, each with its entries shaped for the
 * tool's file; an event the tool never fires is left out and named. A tool without an event map
 * fires every event under its own name. */
export function routeEvents(
  events: readonly (readonly [string, readonly PluginMatcherGroup[]])[],
  eventMap: Readonly<Record<string, string>> | undefined,
  format: HooksFileFormat
): { routed: [string, Entry[]][]; skipped: string[] } {
  const routed: [string, Entry[]][] = [];
  const skipped: string[] = [];
  for (const [event, groups] of events) {
    const toolEvent = toolEventOf(event, eventMap);
    if (toolEvent === undefined) skipped.push(event);
    else routed.push([toolEvent, shapeEntries(groups, format)]);
  }
  return { routed, skipped };
}
