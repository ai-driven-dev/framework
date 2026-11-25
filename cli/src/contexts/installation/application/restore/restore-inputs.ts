import type { ConfigRef } from "../../../tools/contract/config-refs.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";

/**
 * Where each config artifact sits in the canonical source, asked of every registered profile
 * through the artifacts its capabilities consume, so restoring knows artifacts, not tools.
 * An artifact several tools consume is named once.
 */
export function configRefsOf(tools: ToolCatalog): readonly ConfigRef[] {
  const byName = new Map<string, ConfigRef>();
  const refs = tools
    .sortedIds()
    .flatMap((id) => tools.profile(id).configWrites())
    .filter((write) => write.kind !== "hooks")
    .flatMap((write) => write.capability.consumedRefs());
  for (const ref of refs) byName.set(ref.name, ref);
  return [...byName.values()];
}

/** Says whether a path is one the person asked to restore: an exact file, or a directory prefix.
 * Null when no file was named, so every path counts. */
export function buildFileFilter(files: string[] | undefined): ((p: string) => boolean) | null {
  if (!files || files.length === 0) return null;
  return (relativePath: string) => files.some((entry) => matchesEntry(relativePath, entry));
}

function matchesEntry(relativePath: string, entry: string): boolean {
  const basename = entry.split("/").at(-1) ?? entry;
  const isDirectoryPrefix = entry.endsWith("/") || !basename.includes(".");
  if (!isDirectoryPrefix) return relativePath === entry;
  return relativePath.startsWith(entry.endsWith("/") ? entry : `${entry}/`);
}
