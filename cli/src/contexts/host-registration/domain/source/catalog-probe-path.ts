import { join } from "node:path";

/** The part of a tool the catalog's location is read from. */
export type CatalogProbing =
  | { readonly kind: "ide" }
  | {
      readonly kind: "ai";
      distributionPaths(kind: "marketplace"): readonly string[];
    };

/** The file a directory's own catalog is read from, the one a tool's own
 * `distributionPaths("marketplace")` names, so a caller whose read came back `undefined` can
 * report *which file* it found nothing readable at. `undefined` for a tool that is not an AI tool
 * or whose profile declares no such path. */
export function marketplaceCatalogProbePath(tool: CatalogProbing, dir: string): string | undefined {
  if (tool.kind !== "ai") return undefined;
  const catalogRelative = tool.distributionPaths("marketplace")[0];
  return catalogRelative === undefined ? undefined : join(dir, catalogRelative);
}
