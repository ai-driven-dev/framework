import { join } from "node:path";
import { generateCatalogContent } from "../../domain/models/catalog.js";
import type { Manifest } from "../../domain/models/manifest.js";
import type { FileSystem } from "../../domain/ports/file-system.js";

export async function writeCatalog(
  manifest: Manifest,
  docsDir: string,
  projectRoot: string,
  fs: FileSystem
): Promise<void> {
  const content = generateCatalogContent(manifest, docsDir);
  await fs.writeFile(join(projectRoot, docsDir, "CATALOG.md"), content);
}
