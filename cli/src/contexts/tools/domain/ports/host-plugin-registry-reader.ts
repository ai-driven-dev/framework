import type { MarketplaceScope } from "../../../../kernel/scope.js";

/**
 * What a host's own plugin registry says, read from the file that host maintains itself.
 *
 * Readers use the `<plugin>@<marketplace>` refs their hosts record. A host with no reader
 * is absent from the map, never assumed to agree.
 */
/** What a registry says about one ref: whether the host records it enabled and, for a host
 * whose registry carries a per-entry scope (Claude), the scope of the entry that answers for
 * the project asked about. `undefined` for a host whose registry has no scope concept at all
 * (Codex, Copilot). Read before a registration is undone, since a real `claude` binary refuses
 * a mismatched-scope uninstall outright. */
export interface HostPluginRegistryEntry {
  readonly enabled: boolean;
  readonly scope?: MarketplaceScope;
}

export interface HostPluginRegistryReading {
  /** The file consulted, named whatever it answered, so a person can open the same one. */
  readonly location: string;
  /**
   * Every ref the registry carries. Absent when the file is missing or unreadable; only
   * `absent: true` proves no registry exists. An empty map is a parsed file with no refs,
   * distinct from a permissions error.
   */
  readonly refs?: ReadonlyMap<string, HostPluginRegistryEntry>;
  readonly absent?: true;
  /** Why an existing registry could not be read or understood. Never set with `absent`. */
  readonly unreadable?: string;
}

export interface HostPluginRegistryReader {
  read(projectRoot: string): Promise<HostPluginRegistryReading>;
}
