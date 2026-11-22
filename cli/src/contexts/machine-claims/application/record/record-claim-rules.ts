import type { RecordClaimRules } from "../../contract/record-claim-rules.js";
import { claimsKeeping, mergeRefClaims } from "../../domain/ref-claims.js";
import type { HostRecordRules } from "../../ports/host-record.js";

/** Whether a ref stays once the alias's marketplace goes: every ref stays for an alias that was
 * never registered. */
function offMarketplace(
  host: HostRecordRules,
  record: Readonly<Record<string, unknown>>,
  alias: string
): (ref: string) => boolean {
  const hostName = host.marketplaceOf(record, alias)?.hostName;
  return (ref) => hostName === undefined || !host.isRefOnHost(ref, hostName);
}

/** The claim rules over a record, each one following the host registration's own part of it. The
 * claims list always goes last, after the host data. */
export function recordClaimRules(host: HostRecordRules): RecordClaimRules {
  return {
    claimsOnMarketplace: (record, alias) => {
      const off = offMarketplace(host, record, alias);
      return claimsKeeping(record.pluginClaims, (ref) => !off(ref));
    },
    withoutMarketplace: (record, alias) => ({
      ...host.withoutMarketplace(record, alias),
      pluginClaims: claimsKeeping(record.pluginClaims, offMarketplace(host, record, alias)),
    }),
    withoutClaimedRef: (record, ref) => ({
      ...host.withoutRef(record, ref),
      pluginClaims: claimsKeeping(record.pluginClaims, (claimed) => claimed !== ref),
    }),
    mergeCatalogueClaims: (existing, claimed, fallbackBinary) => {
      const merged = host.mergeCatalogueMarketplaces(
        existing,
        claimed.marketplaces,
        fallbackBinary
      );
      const claims = mergeRefClaims(existing?.pluginClaims ?? [], claimed.refs, claimed.dependent);
      return {
        record: { ...merged.record, pluginClaims: claims.entries },
        changed: merged.changed || claims.changed,
      };
    },
  };
}
