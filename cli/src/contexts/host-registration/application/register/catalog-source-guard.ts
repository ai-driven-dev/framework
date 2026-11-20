import { MarketplaceSourceConflictError } from "../../../../shared/domain/errors.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ClaimsView } from "../../contract/claims-view.js";
import type { MarketplaceSourceDriftFound } from "../../contract/marketplace-source-drift.js";
import { isRefOnHost } from "../../domain/record/host-ref.js";
import type {
  NativeMarketplaceRegistration,
  NativeMarketplaceSource,
} from "../../domain/record/native-marketplace-source.js";
import { pluginRefsOf, recordedMarketplaces } from "../../domain/record/registration-record.js";
import {
  describePluginDiff,
  judgeConflict,
  type MarketplaceCatalogIdentity,
  pluginSetDifference,
} from "../../domain/source/marketplace-source-conflict.js";
import { judgeDrift } from "../../domain/source/marketplace-source-drift.js";
import type { HostActions } from "../../ports/host-actions.js";
import type { HostMarketplaceRegistry } from "../../ports/host-marketplace-registry.js";
import type { HostMarketplaceSources } from "../../ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../ports/host-plugin-registry.js";
import type { CatalogProbeTool, NativeHostTool } from "../../ports/host-tool.js";
import {
  hostMarketplaceSourceConflict,
  isDriftFound,
} from "../host-marketplace-source-conflict.js";
import { inspectNativeMarketplaceSource } from "../native-marketplace-source-proof.js";

/** A marketplace as the host sees it: aidd's own local name and the scope it lives at. */
export interface RegistrationSubject {
  readonly name: string;
  readonly scope: Scope;
}

/** One tool's registration as it runs: what the host was asked, what this project holds, and the
 * warnings kept for the caller. */
export interface RegistrationRun {
  readonly toolId: ToolId;
  readonly profile: NativeHostTool & CatalogProbeTool;
  readonly activator: HostActions;
  readonly fs: FileReader;
  readonly hosts: HostRegistries;
  readonly projectRoot: string;
  readonly claims: ClaimsView;
  readonly userCacheRoot: () => string;
  readonly platform: string;
  readonly logger: Logger;
  readonly warnings: string[];
}

/** The per-tool registries a host's native state is read and written through. */
export interface HostRegistries {
  readonly marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>;
  readonly pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>;
  readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources>;
}

interface NativeCatalogProof {
  readonly canonical: boolean;
  readonly hostReadable: boolean;
  readonly sourceStatus: "absent" | "owned" | "unproven";
  readonly source?: NativeMarketplaceSource;
  readonly sourceReason?: string;
  readonly foreignRef?: string;
  readonly unreadable?: string;
}

/** Every warning goes to the logger and is kept, in order, for the caller's result. */
export function warnRegistration(run: RegistrationRun, message: string): void {
  run.logger.warn(message);
  run.warnings.push(message);
}

/** The host's marketplace registry, for a tool whose profile declares one: a reader a test or a
 * caller hands for any other tool is never consulted. */
export function marketplaceRegistryOf(
  run: Pick<RegistrationRun, "hosts" | "profile">
): HostMarketplaceRegistry | undefined {
  const { profile } = run;
  return profile.nativeActivation()?.keepsMarketplaceRegistry() === true
    ? run.hosts.marketplaceRegistries.get(profile.toolId)
    : undefined;
}

export async function nativeCatalogProof(
  run: RegistrationRun,
  hostName: string,
  fresh?: NativeMarketplaceRegistration
): Promise<NativeCatalogProof> {
  const { profile, projectRoot, claims } = run;
  const machine = await claims.machine();
  const machineMarketplaces = recordedMarketplaces(machine);
  const persisted = await claims.persistedProject();
  const localRegistration = profile.pluginEnablementIsMachineGlobal()
    ? undefined
    : recordedMarketplaces(persisted).find((entry) => entry.hostName === hostName);
  const canonical =
    fresh !== undefined ||
    machineMarketplaces.some((entry) => entry.hostName === hostName) ||
    localRegistration !== undefined;
  const registration = fresh ??
    machineMarketplaces.find((entry) => entry.hostName === hostName) ??
    localRegistration ?? {
      alias: hostName,
      hostName,
    };
  const sourceProof = await inspectNativeMarketplaceSource(
    run.hosts.sources.get(profile.toolId),
    projectRoot,
    registration
  );
  const reader = run.hosts.pluginRegistries.get(profile.toolId);
  const base = {
    canonical,
    sourceStatus: sourceProof.status,
    ...(sourceProof.current === undefined ? {} : { source: sourceProof.current }),
    ...(sourceProof.reason === undefined ? {} : { sourceReason: sourceProof.reason }),
  };
  if (reader === undefined) return { ...base, hostReadable: false };
  const reading = await reader.read(projectRoot);
  if (reading.absent === true) return { ...base, hostReadable: true };
  if (reading.refs === undefined)
    return { ...base, hostReadable: false, unreadable: reading.unreadable ?? reading.location };
  const claimed = new Set([
    ...(machine?.pluginClaims ?? []).map((claim) => claim.ref),
    ...(profile.pluginEnablementIsMachineGlobal() ? [] : pluginRefsOf(persisted)),
  ]);
  const foreignRef = [...reading.refs].find(
    ([ref, entry]) =>
      profile.hostRefInUse(entry.enabled) && isRefOnHost(ref, hostName) && !claimed.has(ref)
  )?.[0];
  return { ...base, hostReadable: true, ...(foreignRef === undefined ? {} : { foreignRef }) };
}

export async function proveAddedSource(
  run: RegistrationRun,
  hostName: string,
  builtDir: string
): Promise<NativeMarketplaceSource | undefined> {
  const { toolId } = run;
  const reading = await run.hosts.sources.get(run.profile.toolId)?.read(run.projectRoot);
  const current = reading?.entries?.get(hostName);
  const expected = await run.fs.realpath(builtDir).catch(() => builtDir);
  const sourceMatches =
    current?.source === expected &&
    (current.kind === "registry" ||
      (current.kind === "effective-list" &&
        current.sourceType === "local" &&
        current.root === expected));
  if (sourceMatches) return current;
  warnRegistration(
    run,
    `${toolId}: catalogue '${hostName}' add returned but effective host source could not be proven as '${expected}'; no AIDD claim or enablement recorded. Reconcile manually.`
  );
  return undefined;
}

/** The catalogue a run is about to register: where it was built, what it declares about itself,
 * and the marketplace it belongs to. */
export interface CatalogRequest {
  readonly builtDir: string;
  readonly identity: MarketplaceCatalogIdentity;
  readonly marketplace: RegistrationSubject;
}

/**
 * Refuses `addMarketplace` where it would silently replace a *different catalog* the host holds
 * under this name: measured: claude derives the registered name from the source's own catalog
 * and re-adds over it with no prompt and no error. A local alias differing from the catalog's
 * declared name is supported and never compared here, and the same catalog reached through a
 * differently resolved path is no conflict. A drift decides first: a host on a newer shared build
 * returns `"skip"` and is never written backward, one on a pre-migration cache proceeds.
 */
export async function guardAgainstConflict(
  run: RegistrationRun,
  request: CatalogRequest
): Promise<"skip" | undefined> {
  const { builtDir, identity: requestedIdentity, marketplace } = request;
  const { profile } = run;
  const reader = marketplaceRegistryOf(run);
  if (reader === undefined) return undefined;
  const requestedSource = await run.fs.realpath(builtDir).catch(() => builtDir);
  const check = await hostMarketplaceSourceConflict(
    { fs: run.fs, tool: profile, reader },
    {
      requestedSource,
      requestedIdentity,
      driftContext: {
        userCacheRoot: run.userCacheRoot(),
        projectRoot: run.projectRoot,
        marketplaceName: marketplace.name,
        target: profile.toolId,
        platform: run.platform,
      },
    }
  );
  if (check !== undefined && isDriftFound(check)) return decideOnDrift(run, check);
  const verdict = judgeConflict(check);
  if (verdict.outcome === "proceed") return undefined;
  const { conflict } = verdict;
  const diff = pluginSetDifference(conflict.registeredIdentity, conflict.requestedIdentity);
  throw new MarketplaceSourceConflictError(
    `Marketplace '${conflict.name}' is already registered from a different catalog: ` +
      `${conflict.registeredSource} differs from the one requested, ${conflict.requestedSource} ` +
      `— plugins ${describePluginDiff(diff)}, per ${conflict.location}. ` +
      `Do not remove a catalogue another user or project may depend on. ` +
      `Reconcile the host source manually before retrying \`aidd sync\`.`
  );
}

/**
 * A host already following a newer build is never written backward: warned, not thrown, so a
 * caller iterating several tools still proceeds. A host tracking *another* project's
 * pre-migration cache can proceed only through the separate host-source proof; discovering a
 * path here never creates a shared-source claim before registration succeeds.
 */
function decideOnDrift(
  run: RegistrationRun,
  found: MarketplaceSourceDriftFound
): "skip" | undefined {
  const verdict = judgeDrift(found.drift);
  if (verdict.outcome !== "skip") return undefined;
  const { registeredVersion, requestedVersion } = verdict.reason;
  warnRegistration(
    run,
    `${run.toolId}'s marketplace registry (${found.location}) already carries a newer ` +
      `aidd-framework build, ${registeredVersion}, than this run's own ${requestedVersion} — ` +
      "not registering this run's build over it. Run `aidd update` to bring this project's " +
      "CLI to at least the version the host already follows."
  );
  return "skip";
}
