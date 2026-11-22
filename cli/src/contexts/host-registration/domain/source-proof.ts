import type { HostPluginRegistryEntry } from "./reading/plugin-registry-reading.js";
import { isRefOnHost } from "./record/host-ref.js";
import {
  type NativeMarketplaceRegistration,
  type NativeMarketplaceSource,
  sameNativeMarketplaceSource,
} from "./record/native-marketplace-source.js";
import type { NativeMarketplaceSourceReading } from "./record/native-marketplace-source-reading.js";

export interface NativeMarketplaceSourceInspection {
  readonly status: "absent" | "owned" | "unproven";
  readonly current?: NativeMarketplaceSource;
  readonly reason?: string;
}

/** What a host's marketplace source reading proves about one registered catalogue: absent, owned
 * by the source AIDD recorded, or unproven with the sentence saying why. */
export function inspectSourceReading(
  reading: NativeMarketplaceSourceReading,
  registration: NativeMarketplaceRegistration
): NativeMarketplaceSourceInspection {
  const name = registration.hostName;
  const unproven = (why: string): NativeMarketplaceSourceInspection => ({
    status: "unproven",
    reason: `Catalogue '${name}': ${why}; reconcile manually.`,
  });
  if (reading.entries === undefined)
    return unproven(reading.unreadable ?? `host source unreadable at ${reading.location}`);
  if (!reading.entries.has(name)) return { status: "absent" };
  const current = reading.entries.get(name);
  if (current === undefined || current === null) return unproven("current host source is unproven");
  const why = provenanceDisproof(registration.provenance, current);
  return why === undefined ? { status: "owned", current } : unproven(why);
}

/** Why the recorded source does not vouch for the current one, or `undefined` when it does. */
function provenanceDisproof(
  provenance: NativeMarketplaceSource | undefined,
  current: NativeMarketplaceSource
): string | undefined {
  if (provenance === undefined) return "legacy claim has no source proof";
  return sameNativeMarketplaceSource(provenance, current)
    ? undefined
    : "current host source differs from AIDD's recorded source";
}

/** The first ref on `hostName` that the host uses and AIDD does not own, if any. `inUse` says
 * whether a host counts an entry's enabled state as in use. */
export function findForeignRef(
  refs: ReadonlyMap<string, HostPluginRegistryEntry>,
  claim: {
    readonly hostName: string;
    readonly ownedRefs: ReadonlySet<string>;
    readonly inUse: (enabled: boolean) => boolean;
  }
): string | undefined {
  const { hostName, ownedRefs, inUse } = claim;
  return [...refs].find(
    ([ref, entry]) => inUse(entry.enabled) && isRefOnHost(ref, hostName) && !ownedRefs.has(ref)
  )?.[0];
}
