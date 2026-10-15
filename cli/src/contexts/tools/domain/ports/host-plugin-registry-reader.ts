import type { MarketplaceScope } from "../../../../kernel/scope.js";

/**
 * What a host's own plugin registry says, read from the file that host maintains itself.
 *
 * Installation diagnostics read host records; delegation additionally checks native artifact
 * paths and project activation settings. Readers use the `<plugin>@<marketplace>` refs their
 * hosts record. A host with no implementation is absent from the map, never assumed to agree.
 */
/** What a registry says about one ref: whether the host records it enabled and, for a host
 * whose registry carries a per-entry scope (Claude), the scope of the entry that answers for
 * the project asked about. `undefined` for a host whose registry has no scope concept at all
 * (Codex, Copilot). Read before a registration is undone, since a real `claude` binary refuses
 * a mismatched-scope uninstall outright. */
export interface HostPluginRegistryEntry {
  readonly enabled: boolean;
  readonly scope?: MarketplaceScope;
  /** Native plugin directory from the host's registration and documented layout. */
  readonly installPath?: string;
  readonly activationUnverified?: string;
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
  /** Delegation includes artifact paths and project activation; the default retains installation
   * diagnostic semantics. Neither mode establishes the effective runtime configuration. */
  read(projectRoot: string, forDelegation?: boolean): Promise<HostPluginRegistryReading>;
}
