import { readFile, realpath } from "node:fs/promises";
import { describeError } from "../../../../shared/domain/describe-error.js";
import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { HostMarketplaceRegistryReading } from "../../domain/reading/marketplace-registry-reading.js";
import { marketplaceCatalogProbePath } from "../../domain/source/catalog-probe-path.js";
import type { MarketplaceCatalogIdentity } from "../../domain/source/marketplace-source-conflict.js";
import type { CatalogIdentityReader } from "../../ports/catalog-identity-reader.js";
import type { HostMarketplaceRegistry } from "../../ports/host-marketplace-registry.js";
import type { CatalogProbeTool } from "../../ports/host-tool.js";

/**
 * Reads a host's own marketplace registry: a JSON object keyed by marketplace name. Of the
 * entry a host's own `marketplace add` writes, `installLocation` is the field that
 * decides what the name currently resolves to: `source.path` is only what the CLI was
 * pointed at. The file is the declaration's, never repeated as a literal here.
 */
export class InstallLocationsByNameReader implements HostMarketplaceRegistry {
  constructor(private readonly path: string) {}

  async read(): Promise<HostMarketplaceRegistryReading> {
    let content: string;
    try {
      content = await readFile(this.path, "utf8");
    } catch (error) {
      const described = describeError(error);
      if (described === "ENOENT") return { location: this.path, absent: true };
      return { location: this.path, unreadable: described };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return { location: this.path, unreadable: describeError(error) };
    }
    const registry = asPlainObject(parsed);
    if (registry === null) {
      return { location: this.path, unreadable: "not a JSON object" };
    }
    const entries = new Map<string, string>();
    for (const [name, value] of Object.entries(registry)) {
      const installLocation = installLocationOf(value);
      if (installLocation === undefined) continue;
      entries.set(name, await resolvedPath(installLocation));
    }
    return { location: this.path, entries };
  }
}

function installLocationOf(value: unknown): string | undefined {
  const installLocation = asPlainObject(value)?.installLocation;
  return typeof installLocation === "string" ? installLocation : undefined;
}

/**
 * Both sides of a source comparison go through `realpath` before they are compared, the same
 * `/var` → `/private/var` lesson the plugin-registry reader already paid for. A path that
 * cannot be resolved falls back to itself rather than throwing: a dead registration should not
 * cost every other entry its answer.
 */
async function resolvedPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

/**
 * Reads a catalog's `name` and its plugin names, never `version`, from the file the tool's own
 * profile names, so this agrees with whatever that tool would actually read there. `undefined`
 * when the directory carries no readable catalog at that path, or the JSON found there names
 * nothing: which is what lets a dead registry entry or an unbuilt tree answer "no fact" instead
 * of a false "different catalog".
 */
export function catalogIdentityReader(fs: FileReader): CatalogIdentityReader {
  return { read: (tool, dir) => readCatalogIdentity(fs, tool, dir) };
}

async function readCatalogIdentity(
  fs: FileReader,
  tool: CatalogProbeTool,
  dir: string
): Promise<MarketplaceCatalogIdentity | undefined> {
  const path = marketplaceCatalogProbePath(tool, dir);
  if (path === undefined) return undefined;
  const content = await fs.readFileIfReadable(path);
  if (content === undefined) return undefined;
  const parsed = tryParseJson(content);
  const catalog = parsed.ok ? asPlainObject(parsed.value) : null;
  if (catalog === null || typeof catalog.name !== "string") return undefined;
  const pluginNames = Array.isArray(catalog.plugins) ? pluginNamesOf(catalog.plugins) : [];
  return { name: catalog.name, pluginNames };
}

function pluginNamesOf(plugins: readonly unknown[]): string[] {
  const names: string[] = [];
  for (const plugin of plugins) {
    const name = asPlainObject(plugin)?.name;
    if (typeof name === "string") names.push(name);
  }
  return names;
}
