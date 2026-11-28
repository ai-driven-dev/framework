import { RegistrationRefusedError } from "../contract/host-registration.error.js";
import type { HostPluginRegistryEntry } from "../domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceRegistration } from "../domain/record/native-marketplace-source.js";
import {
  findForeignRef,
  type HostRefsVerdict,
  inspectSourceReading,
  type NativeMarketplaceSourceInspection,
} from "../domain/source-proof.js";
import type { HostMarketplaceSources } from "../ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../ports/host-plugin-registry.js";
import type { HostRefCounter } from "../ports/host-tool.js";

type HostPluginRefs = ReadonlyMap<string, HostPluginRegistryEntry>;

export async function inspectHostSource(
  reader: HostMarketplaceSources | undefined,
  projectRoot: string,
  registration: NativeMarketplaceRegistration
): Promise<NativeMarketplaceSourceInspection> {
  if (reader === undefined)
    return {
      status: "unproven",
      reason: `Catalogue '${registration.hostName}': host source reader unavailable; reconcile manually.`,
    };
  return inspectSourceReading(await reader.read(projectRoot), registration);
}

/** A source may be AIDD-owned while the host still carries the person's own plugin from it. */
export async function inspectNativeRefs(
  host: {
    readonly reader: HostPluginRegistry | undefined;
    readonly tool: HostRefCounter | undefined;
  },
  claim: {
    readonly hostName: string;
    readonly ownedRefs: ReadonlySet<string>;
    readonly projectRoot: string;
  }
): Promise<HostRefsVerdict> {
  const { tool } = host;
  const { hostName, ownedRefs, projectRoot } = claim;
  const read = await readPluginRefs(host.reader, hostName, projectRoot);
  if ("refusal" in read) return read;
  const foreign = findForeignRef(read.refs, {
    hostName,
    ownedRefs,
    inUse: (enabled) => tool?.hostRefInUse(enabled) ?? true,
  });
  return foreign === undefined ? read : { ...read, foreignRef: foreign };
}

/** `inspectNativeRefs`, refusing a removal that would take a ref no claim names with it. */
export async function assertNoForeignNativeRefs(
  host: Parameters<typeof inspectNativeRefs>[0],
  claim: Parameters<typeof inspectNativeRefs>[1]
): Promise<HostPluginRefs> {
  const verdict = await inspectNativeRefs(host, claim);
  if ("refusal" in verdict) throw verdict.refusal;
  if (verdict.foreignRef !== undefined)
    throw new RegistrationRefusedError(
      `Catalogue '${claim.hostName}' includes foreign host ref '${verdict.foreignRef}'; no host mutation made.`
    );
  return verdict.refs;
}

async function readPluginRefs(
  reader: HostPluginRegistry | undefined,
  hostName: string,
  projectRoot: string
): Promise<HostRefsVerdict> {
  const refuse = (why: string): HostRefsVerdict => ({
    refusal: new RegistrationRefusedError(
      `Catalogue '${hostName}': ${why}; no host mutation made.`
    ),
  });
  if (reader === undefined) return refuse("host plugin registry reader unavailable");
  const reading = await reader.read(projectRoot);
  if (reading.refs === undefined && reading.absent !== true)
    return refuse(`host plugin registry unreadable (${reading.unreadable ?? reading.location})`);
  return { refs: reading.refs ?? new Map<string, HostPluginRegistryEntry>() };
}
