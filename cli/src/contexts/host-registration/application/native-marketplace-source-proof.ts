import { RegistrationRefusedError } from "../domain/host-registration.error.js";
import { judgeRegistration, type SourceProof } from "../domain/policy/registration-policy.js";
import type { HostPluginRegistryEntry } from "../domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceRegistration } from "../domain/record/native-marketplace-source.js";
import {
  findForeignRef,
  inspectSourceReading,
  type NativeMarketplaceSourceInspection,
} from "../domain/source-proof.js";
import type { HostMarketplaceSources } from "../ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../ports/host-plugin-registry.js";
import type { HostRefCounter } from "../ports/host-tool.js";

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

type HostPluginRefs = ReadonlyMap<string, HostPluginRegistryEntry>;

/** What the host's plugin registry lets a mutation do: its refs, or the refusal naming why not. */
export type HostRefsVerdict =
  | { readonly refs: HostPluginRefs }
  | { readonly refusal: RegistrationRefusedError };

/** A source may be AIDD-owned while the host still carries somebody else's plugin from it. */
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
  if (foreign === undefined) return read;
  return {
    refusal: new RegistrationRefusedError(
      `Catalogue '${hostName}' includes foreign host ref '${foreign}'; no host mutation made.`
    ),
  };
}

/** `inspectNativeRefs`, its refusal thrown. */
export async function assertNoForeignNativeRefs(
  host: Parameters<typeof inspectNativeRefs>[0],
  claim: Parameters<typeof inspectNativeRefs>[1]
): Promise<HostPluginRefs> {
  const verdict = await inspectNativeRefs(host, claim);
  if ("refusal" in verdict) throw verdict.refusal;
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

/** Refuses a catalogue whose host source the proof does not show owned, saying why when it can. */
export function assertSourceOwned(
  proof: NativeMarketplaceSourceInspection,
  unproven: string
): void {
  const verdict = judgeCatalogueWithdrawal(proof);
  if (verdict.outcome === "refuse")
    throw new RegistrationRefusedError(verdict.reconcile ?? unproven);
}

/** A catalogue withdrawal's verdict: the source must be owned and, when named, `unenabledClaim` is a
 * claimed ref the host does not provably enable. */
export function judgeCatalogueWithdrawal(source: SourceProof, unenabledClaim?: string) {
  return judgeRegistration({ intent: "withdraw-catalog", source, unenabledClaim });
}
