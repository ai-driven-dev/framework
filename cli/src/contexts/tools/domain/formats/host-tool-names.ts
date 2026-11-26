import { matcherNames } from "../hooks/plugin-hooks-shape.js";

/** A host's names for the tools a plugin names, each once, in order. A tool the host has no name
 * for is dropped, which narrows a grant and never widens it. `passThrough` marks the names the
 * host reads as the plugin writes them. */
export function hostToolNames(
  pluginTools: readonly string[],
  renames: ReadonlyMap<string, string>,
  passThrough: (pluginTool: string) => boolean = () => false
): string[] {
  const names = pluginTools.flatMap((tool) =>
    passThrough(tool) ? tool : (renames.get(tool) ?? [])
  );
  return [...new Set(names)];
}

/** The host's names for the tools a plugin's matcher selects. A matcher is a list of names split on
 * `|`, each read whatever its case, as the bridges read one. Limit: no plugin ships a matcher that
 * is anything else, so a regular expression is read as a list of names and selects nothing. */
export function hostToolNamesMatching(
  matcher: string,
  renames: ReadonlyMap<string, string>
): string[] {
  const byLowerName = new Map([...renames].map(([tool, host]) => [tool.toLowerCase(), host]));
  return hostToolNames(matcherNames(matcher), byLowerName);
}

/** What a host hears when a matcher of `event` names no tool it has. */
export const matcherNamesNoToolWarning = (label: string, event: string, matcher: string): string =>
  `${event} matcher '${matcher}' names no ${label} tool, group skipped`;
