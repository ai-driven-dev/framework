import { isAbsolute, join, resolve } from "node:path";
import { InvalidPluginManifestError } from "../../domain/errors.js";
import { type PluginCatalog, parsePluginCatalog } from "../../domain/models/plugin-catalog.js";
import type { PluginSource } from "../../domain/models/plugin-source.js";
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
    const catalog = await this.readCatalog(fullPath);
    return this.resolveLocalPaths(catalog, frameworkPath);
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

  private resolveLocalPaths(catalog: PluginCatalog, frameworkPath: string): PluginCatalog {
    const plugins = catalog.plugins.map((entry) => ({
      ...entry,
      source: this.resolveSource(entry.source, frameworkPath),
    }));
    return { plugins };
  }

  private resolveSource(source: PluginSource, frameworkPath: string): PluginSource {
    if (source.kind !== "local") return source;
    if (isAbsolute(source.path)) return source;
    return { kind: "local", path: resolve(frameworkPath, source.path) };
  }
}
