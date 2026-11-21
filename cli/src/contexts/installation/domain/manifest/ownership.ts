import type { ToolEntry } from "./tool-entry.js";

export type Ownership =
  | { readonly owner: "aidd" }
  | { readonly owner: "co-owned"; readonly keys: readonly string[] }
  | { readonly owner: "user" };

/**
 * Who owns `relativePath` according to one manifest's entries. A tracked or plugin file belongs to
 * aidd whole. A merge file is shared: aidd holds only the listed keys. Anything else is the user's.
 *
 * Limit: the file a plugin's MCP servers or project hook entries merge into has no recorded path,
 * so it is answered only through the tool file or merge file that also lists it. A hook script has
 * one, and is answered only when it is also a plugin file.
 */
export function ownerOf(entries: readonly ToolEntry[], relativePath: string): Ownership {
  for (const entry of entries) {
    if (entry.files.some((f) => f.relativePath === relativePath)) return { owner: "aidd" };
    const merged = entry.mergeFiles.find((m) => m.relativePath === relativePath);
    if (merged !== undefined) return { owner: "co-owned", keys: Object.keys(merged.entries) };
    if (entry.plugins.some((p) => p.isFileTracked(relativePath))) return { owner: "aidd" };
  }
  return { owner: "user" };
}
