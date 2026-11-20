import { samePath } from "../../../../shared/domain/paths.js";
import {
  type CatalogRequest,
  guardAgainstConflict,
  marketplaceRegistryOf,
  type NativeCatalogProof,
  type RegistrationRun,
} from "./catalog-source-guard.js";

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
  const { toolId } = run;
  const hostName = request.identity.name;
  const reading = await marketplaceRegistryOf(run)?.read();
  const heldByHost = reading?.entries?.has(hostName) === true;
  if (proof.sourceStatus === "unproven" || (proof.sourceStatus === "owned" && !proof.source)) {
    if (heldByHost) await guardAgainstConflict(run, request);
    return `${toolId}: catalogue '${hostName}' host source unproven (${proof.sourceReason ?? "unknown"}); registration left untouched.`;
  }
  if (heldByHost && !proof.canonical) {
    await guardAgainstConflict(run, request);
    return `${toolId}: catalogue '${hostName}' is already registered on the host without a canonical AIDD claim; same-name collision left untouched.`;
  }
  if (reading !== undefined && reading.entries === undefined && reading.absent !== true)
    return `${toolId}: catalogue '${hostName}' host registry is unreadable; ownership unproven and registration left untouched.`;
  if (!proof.hostReadable || proof.foreignRef !== undefined || proof.unreadable !== undefined)
    return proof.foreignRef === undefined
      ? `${toolId}: catalogue '${hostName}' collides with unreadable host plugin registry (${proof.unreadable}); registration left untouched.`
      : `${toolId}: catalogue '${hostName}' carries foreign host ref '${proof.foreignRef}'; registration left untouched.`;
  return undefined;
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
