import { errorMessage } from "../../../shared/domain/describe-error.js";
import { judgeRegistration, type SourceProof } from "../domain/policy/registration-policy.js";
import type {
  HostPluginRegistryEntry,
  HostPluginRegistryReading,
} from "../domain/reading/plugin-registry-reading.js";
import { isRefOnHost } from "../domain/record/host-ref.js";
import type { NativeMarketplaceRegistration } from "../domain/record/native-marketplace-source.js";
import {
  type NativeMarketplaceSource,
  sameNativeMarketplaceSource,
} from "../domain/record/native-marketplace-source.js";
import type { NativeMarketplaceSourceReading } from "../domain/record/native-marketplace-source-reading.js";
import type { HostMarketplaceSources } from "../ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../ports/host-plugin-registry.js";
import type { HostRefCounter } from "../ports/host-tool.js";

export interface NativeMarketplaceSourceInspection {
  readonly status: "absent" | "owned" | "unproven";
  readonly current?: NativeMarketplaceSource;
  readonly reason?: string;
}

export async function inspectHostSource(
  reader: HostMarketplaceSources | undefined,
  projectRoot: string,
  registration: NativeMarketplaceRegistration
): Promise<NativeMarketplaceSourceInspection> {
  const name = registration.hostName;
  const unproven = (why: string): NativeMarketplaceSourceInspection => ({
    status: "unproven",
    reason: `Catalogue '${name}': ${why}; reconcile manually.`,
  });
  if (reader === undefined) return unproven("host source reader unavailable");
  const reading = await readSources(reader, projectRoot);
  if (typeof reading === "string") return unproven(reading);
  if (reading.entries === undefined)
    return unproven(reading.unreadable ?? `host source unreadable at ${reading.location}`);
  if (!reading.entries.has(name)) return { status: "absent" };
  const current = reading.entries.get(name);
  if (current === undefined || current === null) return unproven("current host source is unproven");
  const why = provenanceDisproof(registration.provenance, current);
  return why === undefined ? { status: "owned", current } : unproven(why);
}

/** The reading, or the reason it could not be had. */
async function readSources(
  reader: HostMarketplaceSources,
  projectRoot: string
): Promise<NativeMarketplaceSourceReading | string> {
  try {
    return await reader.read(projectRoot);
  } catch (error) {
    return `host source read failed (${errorMessage(error)})`;
  }
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

/** A source may be AIDD-owned while the host still carries somebody else's plugin from it. */
export async function assertNoForeignNativeRefs(
  host: {
    readonly reader: HostPluginRegistry | undefined;
    readonly tool: HostRefCounter | undefined;
  },
  claim: {
    readonly hostName: string;
    readonly ownedRefs: ReadonlySet<string>;
    readonly projectRoot: string;
  }
): Promise<ReadonlyMap<string, HostPluginRegistryEntry>> {
  const { tool } = host;
  const { hostName, ownedRefs, projectRoot } = claim;
  const refs = await readPluginRefs(host.reader, hostName, projectRoot);
  const foreign = [...refs].find(
    ([ref, entry]) =>
      (tool?.hostRefInUse(entry.enabled) ?? true) &&
      isRefOnHost(ref, hostName) &&
      !ownedRefs.has(ref)
  )?.[0];
  if (foreign !== undefined)
    throw new Error(
      `Catalogue '${hostName}' includes foreign host ref '${foreign}'; no host mutation made.`
    );
  return refs;
}

async function readPluginRefs(
  reader: HostPluginRegistry | undefined,
  hostName: string,
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
      `Catalogue '${hostName}': host plugin registry read failed (${errorMessage(error)}); no host mutation made.`
    );
  }
  if (reading.refs === undefined && reading.absent !== true)
    throw new Error(
      `Catalogue '${hostName}': host plugin registry unreadable (${reading.unreadable ?? reading.location}); no host mutation made.`
    );
  return reading.refs ?? new Map<string, HostPluginRegistryEntry>();
}

/** Refuses a catalogue whose host source the proof does not show owned, saying why when it can. */
export function assertSourceOwned(
  proof: NativeMarketplaceSourceInspection,
  unproven: string
): void {
  const verdict = judgeCatalogueWithdrawal(proof);
  if (verdict.outcome === "refuse") throw new Error(verdict.reconcile ?? unproven);
}

/** A catalogue withdrawal's verdict: the source must be owned and, when named, `unenabledClaim` is a
 * claimed ref the host does not provably enable. */
export function judgeCatalogueWithdrawal(source: SourceProof, unenabledClaim?: string) {
  return judgeRegistration({ intent: "withdraw-catalog", source, unenabledClaim });
}
