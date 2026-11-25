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
