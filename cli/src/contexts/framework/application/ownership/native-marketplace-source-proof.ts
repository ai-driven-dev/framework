import type {
  HostPluginRegistryEntry,
  HostPluginRegistryReader,
  HostPluginRegistryReading,
} from "../../../tools/domain/ports/host-plugin-registry-reader.js";
import type {
  NativeMarketplaceSource,
  NativeMarketplaceSourceReader,
  NativeMarketplaceSourceReading,
} from "../../../tools/domain/ports/native-marketplace-source-reader.js";
import type { NativeMarketplaceRegistration } from "../../domain/manifest/native-registrations.js";

export interface NativeMarketplaceSourceInspection {
  readonly status: "absent" | "owned" | "unproven";
  readonly current?: NativeMarketplaceSource;
  readonly reason?: string;
}

export function sameNativeMarketplaceSource(
  recorded: NativeMarketplaceSource,
  current: NativeMarketplaceSource
): boolean {
  if (recorded.kind !== current.kind || recorded.source !== current.source) return false;
  if (recorded.kind === "registry" && current.kind === "registry") return true;
  return (
    recorded.kind === "effective-list" &&
    current.kind === "effective-list" &&
    recorded.root === current.root &&
    recorded.sourceType === current.sourceType
  );
}

export async function inspectNativeMarketplaceSource(
  reader: NativeMarketplaceSourceReader | undefined,
  projectRoot: string,
  registration: NativeMarketplaceRegistration
): Promise<NativeMarketplaceSourceInspection> {
  const name = registration.hostName;
  if (reader === undefined)
    return {
      status: "unproven",
      reason: `Catalogue '${name}': host source reader unavailable; reconcile manually.`,
    };
  let reading: NativeMarketplaceSourceReading;
  try {
    reading = await reader.read(projectRoot);
  } catch (error) {
    return {
      status: "unproven",
      reason: `Catalogue '${name}': host source read failed (${error instanceof Error ? error.message : String(error)}); reconcile manually.`,
    };
  }
  if (reading.entries === undefined)
    return {
      status: "unproven",
      reason: `Catalogue '${name}': ${reading.unreadable ?? `host source unreadable at ${reading.location}`}; reconcile manually.`,
    };
  if (!reading.entries.has(name)) return { status: "absent" };
  const current = reading.entries.get(name);
  if (current === undefined || current === null)
    return {
      status: "unproven",
      reason: `Catalogue '${name}': current host source is unproven; reconcile manually.`,
    };
  if (registration.provenance === undefined)
    return {
      status: "unproven",
      reason: `Catalogue '${name}': legacy claim has no source proof; reconcile manually.`,
    };
  if (!sameNativeMarketplaceSource(registration.provenance, current))
    return {
      status: "unproven",
      reason: `Catalogue '${name}': current host source differs from AIDD's recorded source; reconcile manually.`,
    };
  return { status: "owned", current };
}

/** A source may be AIDD-owned while the host still carries somebody else's plugin from it. */
export async function assertNoForeignNativeRefs(
  reader: HostPluginRegistryReader | undefined,
  hostName: string,
  ownedRefs: ReadonlySet<string>,
  projectRoot: string
): Promise<ReadonlyMap<string, HostPluginRegistryEntry>> {
  if (reader === undefined)
    throw new Error(
      `Catalogue '${hostName}': host plugin registry reader unavailable; no host mutation made.`
    );
  let reading: HostPluginRegistryReading;
  try {
    reading = await reader.read(projectRoot);
  } catch (error) {
    throw new Error(
      `Catalogue '${hostName}': host plugin registry read failed (${error instanceof Error ? error.message : String(error)}); no host mutation made.`
    );
  }
  if (reading.refs === undefined && reading.absent !== true)
    throw new Error(
      `Catalogue '${hostName}': host plugin registry unreadable (${reading.unreadable ?? reading.location}); no host mutation made.`
    );
  const refs = reading.refs ?? new Map<string, HostPluginRegistryEntry>();
  const foreign = [...refs.keys()].find(
    (ref) => ref.endsWith(`@${hostName}`) && !ownedRefs.has(ref)
  );
  if (foreign !== undefined)
    throw new Error(
      `Catalogue '${hostName}' includes foreign host ref '${foreign}'; no host mutation made.`
    );
  return refs;
}
