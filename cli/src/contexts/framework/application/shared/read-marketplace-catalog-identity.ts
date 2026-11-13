import { join } from "node:path";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { MarketplaceCatalogIdentity } from "../../../host-registration/contract/marketplace-source-conflict.js";
import type { ToolProfile } from "../../../tools/contract/tool-profile.js";

/**
 * What a directory's own catalog declares about itself — `name` and its plugin names, never
 * `version` — read from the same relative file a tool's own `distributionPaths("marketplace")` names,
 * so this agrees with whatever that tool would actually read there. `undefined` when the directory
 * carries no readable catalog at that path, or the JSON found there names nothing: silence, not a
 * fact to invent, which is what lets a dead registry entry or an unbuilt tree answer "no fact"
 * instead of a false "different catalog".
 */
export async function readMarketplaceCatalogIdentity(
  fs: FileReader,
  tool: ToolProfile,
  dir: string
): Promise<MarketplaceCatalogIdentity | undefined> {
  const path = marketplaceCatalogProbePath(tool, dir);
  if (path === undefined) return undefined;
  const content = await fs.readFile(path).catch(() => undefined);
  if (content === undefined) return undefined;
  try {
    const parsed = JSON.parse(content) as { name?: unknown; plugins?: unknown };
    if (typeof parsed.name !== "string") return undefined;
    const pluginNames = Array.isArray(parsed.plugins) ? pluginNamesOf(parsed.plugins) : [];
    return { name: parsed.name, pluginNames };
  } catch {
    return undefined;
  }
}

/** The exact path {@link readMarketplaceCatalogIdentity} reads, named so a caller whose read came
 * back `undefined` can report *which file* it found nothing readable at. `undefined` for the same
 * reason the read would answer nothing: not an AI tool, or one whose profile declares no
 * `distributionPaths("marketplace")`. */
export function marketplaceCatalogProbePath(tool: ToolProfile, dir: string): string | undefined {
  if (tool.kind !== "ai") return undefined;
  const catalogRelative = tool.distributionPaths("marketplace")[0];
  return catalogRelative === undefined ? undefined : join(dir, catalogRelative);
}

function pluginNamesOf(plugins: readonly unknown[]): string[] {
  const names: string[] = [];
  for (const plugin of plugins) {
    if (plugin === null || typeof plugin !== "object") continue;
    const name = (plugin as { name?: unknown }).name;
    if (typeof name === "string") names.push(name);
  }
  return names;
}
