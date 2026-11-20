import { realpath } from "node:fs/promises";
import type { Scope } from "../../../shared/domain/scope.js";
import type {
  HostPluginRegistryEntry,
  HostPluginRegistryReading,
} from "../domain/reading/plugin-registry-reading.js";
import type { HostPluginRegistry } from "../ports/host-plugin-registry.js";
import { readPluginRegistryFile } from "./plugin-registry-file.js";

/**
 * A host registry kept as a JSON document whose `plugins` object is keyed by the same
 * `<plugin>@<marketplace>` ref `enabledPlugins` uses, each key holding one entry per scope the
 * ref was installed at. Presence is not the whole answer: an entry installed at a project
 * scope also carries `projectPath`, which is what tells one project's ref from a machine-wide
 * one.
 */
export class PluginEntriesByScopeReader implements HostPluginRegistry {
  constructor(private readonly path: string) {}

  read(projectRoot: string): Promise<HostPluginRegistryReading> {
    return readPluginRegistryFile(this.path, async (content) => {
      const plugins: unknown = Object(JSON.parse(content)).plugins;
      if (typeof plugins !== "object" || plugins === null)
        return { location: this.path, unreadable: "no `plugins` object" };
      const refs = new Map<string, HostPluginRegistryEntry>();
      const here = await resolvedPath(projectRoot);
      for (const [ref, entries] of Object.entries(plugins)) {
        const scope = await scopeForProject(entries, here);
        if (scope !== null) refs.set(ref, { enabled: true, scope });
      }
      return { location: this.path, refs };
    });
  }
}

/** One installed-plugin entry, narrowed to the two fields that decide whether a ref counts for
 * the project being diagnosed. Everything else the host records there describes what was
 * installed, never where it applies. */
interface ScopedEntry {
  readonly scope?: string;
  readonly projectPath?: string;
}

/** A user-scoped entry applies everywhere and carries no `projectPath`; any other scope applies
 * to the project it names, and an entry with neither is ignored rather than guessed. `null`
 * when nothing here answers for `projectRoot`. A user-scope entry wins over a project-path
 * match whatever the array's order, so a caller choosing an uninstall's own scope reads the
 * answer that is true rather than the one that sorted first. */
async function scopeForProject(
  entries: readonly ScopedEntry[],
  projectRoot: string
): Promise<Scope | null> {
  if (!Array.isArray(entries)) return null;
  if (entries.some((entry) => entry.scope === "user")) return "user";
  for (const entry of entries) {
    if (entry.projectPath === undefined) continue;
    if ((await resolvedPath(entry.projectPath)) === projectRoot) return "project";
  }
  return null;
}

/**
 * Both sides of the project comparison resolve through `realpath`: on macOS `/var` is a symlink
 * to `/private/var`, and comparing the raw strings there reports a registered plugin as
 * missing. A path that cannot be resolved falls back to itself rather than throwing, so a stale
 * entry for a deleted project fails to match instead of costing every other entry its answer.
 */
async function resolvedPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}
