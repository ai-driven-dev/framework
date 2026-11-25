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

const PLAIN_NAMES = /^[\w|]+$/u;

/** The host's names for the tools a plugin's matcher selects. Claude reads a matcher of plain names
 * as a list split on `|`, and any other as a regular expression over a tool's name: the same
 * reading here, over the tools the host has a name for. */
export function hostToolNamesMatching(
  matcher: string,
  renames: ReadonlyMap<string, string>
): string[] {
  if (PLAIN_NAMES.test(matcher)) return hostToolNames(matcher.split("|"), renames);
  const selects = new RegExp(matcher);
  return hostToolNames(
    [...renames.keys()].filter((tool) => selects.test(tool)),
    renames
  );
}
