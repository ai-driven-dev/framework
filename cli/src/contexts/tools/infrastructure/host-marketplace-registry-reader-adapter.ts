import { readFile, realpath } from "node:fs/promises";
import { describeError } from "../../../kernel/describe-error.js";
import type {
  HostMarketplaceRegistryReader,
  HostMarketplaceRegistryReading,
} from "../domain/ports/host-marketplace-registry-reader.js";

/**
 * Reads a host's own marketplace registry: a JSON object keyed by marketplace name. Of the
 * entry a real `claude plugin marketplace add` writes, `installLocation` is the field that
 * decides what the name currently resolves to — `source.path` is only what the CLI was
 * pointed at. The file is the declaration's, never repeated as a literal here.
 */
export class InstallLocationsByNameReader implements HostMarketplaceRegistryReader {
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
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { location: this.path, unreadable: "not a JSON object" };
    }
    const entries = new Map<string, string>();
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      const installLocation = installLocationOf(value);
      if (installLocation === undefined) continue;
      entries.set(name, await resolvedPath(installLocation));
    }
    return { location: this.path, entries };
  }
}

function installLocationOf(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const installLocation = (value as { installLocation?: unknown }).installLocation;
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
