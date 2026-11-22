import { join } from "node:path";
import type { SourceMarketplaceRef } from "../../../../shared/domain/plugin/source-refs.js";
import type { DiskSinkDeps } from "../../ports/disk-sink-deps.js";
import type { DiskTarget } from "../../ports/plugin-tree-sink.js";

type CatalogDeps = Pick<DiskSinkDeps, "fs" | "jsonSchemaValidator" | "assetProvider">;

/** The source marketplace and the plugins a build wrote from it. */
export interface CatalogBuild {
  readonly sourceMarketplace: SourceMarketplaceRef;
  readonly builtPlugins: readonly { name: string }[];
}

/** The marketplace catalog of the plugins a build wrote. Returns the files written. */
export async function writeMarketplaceCatalog(
  deps: CatalogDeps,
  t: DiskTarget,
  { sourceMarketplace, builtPlugins }: CatalogBuild
): Promise<number> {
  const { contract } = t;
  if (!contract.buildMarketplaceCatalog || !contract.buildMarketplaceEntry) return 0;
  const entries: Record<string, unknown>[] = [];
  for (const built of builtPlugins) {
    entries.push(
      await contract.buildMarketplaceEntry({
        name: built.name,
        pluginSrc: join(t.outDir, "plugins", built.name),
        outDir: t.outDir,
        srcEntry: sourceMarketplace.plugins.find((p) => p.name === built.name),
        fs: deps.fs,
      })
    );
  }
  const { catalog, schemaName, destRelPath } = await contract.buildMarketplaceCatalog(
    sourceMarketplace,
    entries,
    deps.fs
  );
  if (schemaName) {
    deps.jsonSchemaValidator.validate(deps.assetProvider.loadSchema(schemaName), catalog);
  }
  await deps.fs.writeFile(join(t.outDir, destRelPath), `${JSON.stringify(catalog, null, 2)}\n`);
  return 1;
}
