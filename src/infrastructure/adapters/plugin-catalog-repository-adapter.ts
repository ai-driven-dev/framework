import { join } from "node:path";
import { InvalidPluginManifestError } from "../../domain/errors.js";
import { type PluginCatalog, parsePluginCatalog } from "../../domain/models/plugin-catalog.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { PluginCatalogRepository } from "../../domain/ports/plugin-catalog-repository.js";

const MARKETPLACE_PATH = ".claude-plugin/marketplace.json";

export class PluginCatalogRepositoryAdapter implements PluginCatalogRepository {
  constructor(private readonly fs: FileSystem) {}

  async load(frameworkPath: string): Promise<PluginCatalog | null> {
    const fullPath = join(frameworkPath, MARKETPLACE_PATH);
    if (!(await this.fs.fileExists(fullPath))) {
      return null;
    }
    return this.readCatalog(fullPath);
  }

  private async readCatalog(fullPath: string): Promise<PluginCatalog> {
    let raw: unknown;
    try {
      raw = JSON.parse(await this.fs.readFile(fullPath));
    } catch {
      throw new InvalidPluginManifestError(`marketplace.json at "${fullPath}" is not valid JSON`);
    }
    try {
      return parsePluginCatalog(raw);
    } catch (err) {
      if (err instanceof InvalidPluginManifestError) throw err;
      throw new InvalidPluginManifestError(
        `marketplace.json at "${fullPath}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
