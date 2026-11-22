import type { SyncContext } from "../../../contexts/installation/application/sync/load-sync-context.use-case.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { ToolId } from "../../../shared/domain/tool.js";

export type SyncedManifest = SyncContext["manifest"];
type SyncedRecord = NonNullable<ReturnType<SyncContext["records"]["get"]>>;
export type SyncedMarketplaces = SyncContext["marketplaces"];

/** What the record rules answer about refs: the host name a ref sits under, and which recorded
 * refs sit on which host. */
export interface RefRules {
  readonly refOnHostName: (plugin: string, hostName: string) => string;
  readonly claimedRefs: (record: SyncedRecord) => readonly string[];
  readonly refsOnHosts: (
    record: SyncedRecord,
    claimedRefs: readonly string[],
    hostNames: Iterable<string>
  ) => string[];
}

export interface PluginRefsRun {
  toolId: ToolId;
  manifest: SyncedManifest;
  records: SyncContext["records"];
  marketplaces: SyncedMarketplaces;
  hostNameByAlias: ReadonlyMap<string, string>;
  scope: Scope;
}
