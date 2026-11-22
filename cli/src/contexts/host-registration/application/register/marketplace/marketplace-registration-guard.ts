import { samePath } from "../../../../../shared/domain/paths.js";
import type { HostMarketplaceRegistryReading } from "../../../domain/reading/marketplace-registry-reading.js";
import type { NativeCatalogProof } from "../native-catalog-proof.js";
import { marketplaceRegistryOf, type RegistrationRun } from "../registration-run.js";
import { type CatalogRequest, guardAgainstConflict } from "./catalog-source-guard.js";

/**
 * Why a marketplace the host may already hold is left untouched, or `undefined` when its
 * registration may go on. A name the host holds under a different catalog throws from the
 * conflict guard before any warning is chosen.
 */
export async function untouchedReason(
  run: RegistrationRun,
  request: CatalogRequest,
  proof: NativeCatalogProof
): Promise<string | undefined> {
  const lead = `${run.toolId}: catalogue '${request.identity.name}'`;
  const reading = await marketplaceRegistryOf(run)?.read();
  const heldByHost = reading?.entries?.has(request.identity.name) === true;
  const unproven = sourceUnproven(proof);
  const collision = heldByHost && !proof.canonical;
  if (unproven || collision) {
    if (heldByHost) await guardAgainstConflict(run, request);
    return unproven
      ? `${lead} host source unproven (${proof.sourceReason ?? "unknown"}); registration left untouched.`
      : `${lead} is already registered on the host without a canonical AIDD claim; same-name collision left untouched.`;
  }
  return unreadableRegistryReason(lead, reading, proof);
}

const sourceUnproven = (proof: NativeCatalogProof): boolean =>
  proof.sourceStatus === "unproven" || (proof.sourceStatus === "owned" && !proof.source);

/** Why a registry that cannot answer, or a ref that is not ours, leaves the registration alone. */
function unreadableRegistryReason(
  lead: string,
  reading: HostMarketplaceRegistryReading | undefined,
  proof: NativeCatalogProof
): string | undefined {
  if (reading !== undefined && reading.entries === undefined && reading.absent !== true)
    return `${lead} host registry is unreadable; ownership unproven and registration left untouched.`;
  if (proof.hostReadable && proof.foreignRef === undefined && proof.unreadable === undefined)
    return undefined;
  return proof.foreignRef === undefined
    ? `${lead} collides with unreadable host plugin registry (${proof.unreadable}); registration left untouched.`
    : `${lead} carries foreign host ref '${proof.foreignRef}'; registration left untouched.`;
}

/** True when the host already follows exactly the catalog this run built. */
export function followsRequestedSource(
  proof: NativeCatalogProof,
  requestedSource: string,
  platform: string
): boolean {
  const { source } = proof;
  if (proof.sourceStatus !== "owned" || source?.source === undefined) return false;
  if (!samePath(source.source, requestedSource, platform)) return false;
  return (
    source.kind === "registry" ||
    (source.kind === "effective-list" &&
      samePath(source.root, requestedSource, platform) &&
      source.sourceType === "local")
  );
}
