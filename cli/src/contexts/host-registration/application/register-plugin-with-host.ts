import {
  MarketplaceSourceConflictError,
  NativePluginCliError,
  UnreadableBuiltCatalogError,
} from "../../../shared/domain/errors.js";
import {
  parseBuiltMarketplaceDir,
  parseUserBuiltMarketplaceDir,
  samePath,
  samePathSegment,
} from "../../../shared/domain/paths.js";
import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { HostActions } from "../contract/host-actions.js";
import type { HostMarketplaceRegistry } from "../contract/host-marketplace-registry.js";
import type {
  HostMarketplaceSources,
  NativeMarketplaceSource,
} from "../contract/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../contract/host-plugin-registry.js";
import {
  describePluginDiff,
  type MarketplaceCatalogIdentity,
  pluginSetDifference,
} from "../contract/marketplace-source-conflict.js";
import type { MarketplaceSourceDriftFound } from "../contract/marketplace-source-drift.js";
import type {
  NativeMarketplaceRegistration,
  RegistrationRecord,
} from "../contract/registration-record.js";
import { hostMarketplaceSourceConflict, isDriftFound } from "./host-marketplace-source-conflict.js";
import { inspectNativeMarketplaceSource } from "./native-marketplace-source-proof.js";
import {
  marketplaceCatalogProbePath,
  readMarketplaceCatalogIdentity,
} from "./read-marketplace-catalog-identity.js";

/** A marketplace as the host sees it: aidd's own local name and the scope it lives at. */
export interface RegistrationSubject {
  readonly name: string;
  readonly scope: MarketplaceScope;
}

export type RegisteredMarketplace = NativeMarketplaceRegistration;

/** What one tool's host registration left behind, for the caller to record. */
export interface HostRegistrationOutcome {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly preservedMarketplaces: readonly RegisteredMarketplace[];
  readonly catalogClaims: readonly RegisteredMarketplace[];
  readonly pluginRefs: readonly string[];
  /** A marketplace whose build failed was warned about and left unregistered this run: the
   * host's own registration for it is wherever it was before. */
  readonly buildFailed: boolean;
}

/** What the machine-wide record holds for a tool. Read when needed, never ahead of it. */
export interface MachineRegistrations {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly pluginClaims?: readonly { readonly ref: string }[];
}

/** What other records say about a tool's registrations, handed over by the caller that owns them. */
export interface RegistrationClaims {
  /** The registrations this run's own record already holds for the tool. */
  readonly recorded: RegistrationRecord | undefined;
  /** The machine-wide record, absent when it is empty or not kept. */
  readonly machine: () => Promise<MachineRegistrations | undefined>;
  /** Whether a machine-wide record is kept at all. */
  readonly machineKept: boolean;
  /** The project record as last saved. */
  readonly persistedProject: () => Promise<RegistrationRecord | undefined>;
}

export interface RegisterPluginWithHostCommand<M extends RegistrationSubject> {
  readonly tools: ToolCatalog;
  readonly toolId: ToolId;
  readonly projectRoot: string;
  readonly scope: MarketplaceScope;
  readonly marketplaces: readonly M[];
  readonly claims: RegistrationClaims;
  /** Builds the tree one marketplace is registered from; null when it cannot be built. */
  readonly build: (marketplace: M) => Promise<string | null>;
  /** The refs this run enables, given the host name each proven marketplace answers to. */
  readonly refsToEnable: (hostNameByAlias: ReadonlyMap<string, string>) => string[];
  readonly userCacheRoot: () => string;
  /** Every warning goes to the logger and is kept, in order, for the caller's result. */
  readonly sink: { readonly logger: Logger; readonly warnings: string[] };
}

export type RegisterPluginWithHostResult =
  | { readonly status: "unconfigured" }
  | { readonly status: "binary-missing"; readonly binary: string }
  | { readonly status: "activated"; readonly outcome: HostRegistrationOutcome };

interface NativeCatalogProof {
  readonly canonical: boolean;
  readonly hostReadable: boolean;
  readonly sourceStatus: "absent" | "owned" | "unproven";
  readonly source?: NativeMarketplaceSource;
  readonly sourceReason?: string;
  readonly foreignRef?: string;
  readonly unreadable?: string;
}

interface Run {
  readonly tools: ToolCatalog;
  readonly toolId: ToolId;
  readonly activator: HostActions;
  readonly projectRoot: string;
  readonly claims: RegistrationClaims;
  readonly userCacheRoot: () => string;
  readonly logger: Logger;
  readonly warnings: string[];
}

/** Whether enabling a plugin acts on the whole machine; true for an editor. */
export function enablementIsMachineGlobal(tools: ToolCatalog, toolId: ToolId): boolean {
  return tools.aiProfileIfAny(toolId)?.pluginEnablementIsMachineGlobal() ?? true;
}

/** Whether a ref the host lists is in use; true for an editor. */
function hostRefInUse(tools: ToolCatalog, toolId: ToolId, enabled: boolean): boolean {
  return tools.aiProfileIfAny(toolId)?.hostRefInUse(enabled) ?? true;
}

export class RegisterPluginWithHost {
  constructor(
    private readonly fs: FileReader,
    /** Native plugin CLI activators, keyed by the `binary` each profile declares. */
    private readonly activators: ReadonlyMap<string, HostActions>,
    /** Only a tool whose profile declares a marketplace registry is ever looked up here, so a
     * tool absent from this map still registers. */
    private readonly marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>,
    private readonly pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>,
    private readonly sources: ReadonlyMap<AiToolId, HostMarketplaceSources>
  ) {}

  /** Registers every marketplace with the tool's own CLI and enables the refs this run asks
   * for. Each step is independently best-effort: one failing plugin or marketplace warns and
   * lets the others through. Anything but a recoverable `NativePluginCliError` propagates. */
  async execute<M extends RegistrationSubject>(
    command: RegisterPluginWithHostCommand<M>
  ): Promise<RegisterPluginWithHostResult> {
    const { tools, toolId, projectRoot, scope, marketplaces, claims, sink } = command;
    const binary = tools.aiProfileIfAny(toolId)?.nativeActivation()?.hostBinary();
    const activator = binary === undefined ? undefined : this.activators.get(binary);
    if (binary === undefined || activator === undefined) return { status: "unconfigured" };
    if (!activator.isAvailable()) return { status: "binary-missing", binary };
    const run: Run = {
      tools,
      toolId,
      activator,
      projectRoot,
      claims,
      userCacheRoot: command.userCacheRoot,
      logger: sink.logger,
      warnings: sink.warnings,
    };
    // Every known marketplace, never only the ones a plugin points at: declaring a marketplace
    // and installing a plugin from it are two acts. Measured against the real `claude` binary —
    // a project with two registered marketplaces and no plugin was told about neither.
    const ownMarketplaces: RegisteredMarketplace[] = [];
    const preservedMarketplaces: RegisteredMarketplace[] = [];
    const catalogClaims: RegisteredMarketplace[] = [];
    const addedHostNames = new Set<string>();
    const recorded = claims.recorded?.marketplaces;
    let buildFailed = false;
    for (const marketplace of marketplaces) {
      const registration = await this.registerMarketplace(
        run,
        marketplace,
        command.build,
        catalogClaims
      );
      if (registration.outcome === "build-failed") buildFailed = true;
      if (registration.addedThisRun === true) addedHostNames.add(registration.hostName);
      const entry = {
        alias: marketplace.name,
        hostName: registration.hostName,
        ...(registration.provenance === undefined ? {} : { provenance: registration.provenance }),
      };
      const earlier = recorded?.find((m) => m.alias === marketplace.name);
      if (registration.outcome === "registered" && registration.claimable)
        ownMarketplaces.push(entry);
      if (registration.claimable) catalogClaims.push(entry);
      else if (earlier !== undefined) {
        const proof = await this.nativeCatalogProof(run, earlier.hostName);
        if (
          proof.canonical &&
          proof.hostReadable &&
          proof.sourceStatus === "owned" &&
          proof.foreignRef === undefined
        )
          ownMarketplaces.push(earlier);
        else preservedMarketplaces.push(earlier);
      }
    }
    if (!activator.enablesPlugins())
      return {
        status: "activated",
        outcome: {
          marketplaces: ownMarketplaces,
          preservedMarketplaces,
          catalogClaims,
          pluginRefs: [],
          buildFailed,
        },
      };
    const stillProven: RegisteredMarketplace[] = [];
    for (const registration of ownMarketplaces) {
      const fresh = catalogClaims.find((claim) => claim.hostName === registration.hostName);
      const proof = await this.nativeCatalogProof(run, registration.hostName, fresh);
      if (
        !proof.canonical ||
        !proof.hostReadable ||
        proof.sourceStatus !== "owned" ||
        proof.foreignRef !== undefined
      )
        continue;
      stillProven.push(registration);
      if (!addedHostNames.has(registration.hostName))
        this.bestEffort(
          run,
          () => activator.upgradeMarketplaces(registration.hostName),
          `upgrade marketplace '${registration.hostName}'`
        );
    }
    const hostNameByAlias = new Map(stillProven.map((m) => [m.alias, m.hostName]));
    const { refsToEnable, alreadyOwnedRefs } = await this.refsThisProjectEnables(
      run,
      command.refsToEnable(hostNameByAlias)
    );
    const enabledRefs = [...alreadyOwnedRefs];
    for (const ref of refsToEnable) {
      if (
        this.bestEffort(run, () => activator.enablePlugin(ref, scope), `enable plugin '${ref}'`)
      ) {
        enabledRefs.push(ref);
      }
    }
    return {
      status: "activated",
      outcome: {
        marketplaces: ownMarketplaces,
        preservedMarketplaces,
        catalogClaims,
        pluginRefs: enabledRefs,
        buildFailed,
      },
    };
  }

  private bestEffort(run: Run, action: () => void, label: string): boolean {
    try {
      action();
      return true;
    } catch (error) {
      if (!(error instanceof NativePluginCliError)) throw error;
      const message = `Native plugin activation — ${label} skipped: ${error.message}`;
      run.logger.warn(message);
      run.warnings.push(message);
      return false;
    }
  }

  private warn(run: Run, message: string): void {
    run.logger.warn(message);
    run.warnings.push(message);
  }

  private async refsThisProjectEnables(
    run: Run,
    refs: string[]
  ): Promise<{ refsToEnable: string[]; alreadyOwnedRefs: string[] }> {
    const { tools, toolId, claims } = run;
    const hostRegistry = tools.isAiTool(toolId) ? this.pluginRegistries.get(toolId) : undefined;
    if (hostRegistry === undefined) return { refsToEnable: refs, alreadyOwnedRefs: [] };
    const ownRefs = claims.recorded?.pluginRefs;
    const onHost = (await hostRegistry.read(run.projectRoot)).refs;
    const machineClaims = (await claims.machine())?.pluginClaims ?? [];
    const refsToEnable: string[] = [];
    const alreadyOwnedRefs: string[] = [];
    for (const ref of refs) {
      if (onHost?.get(ref)?.enabled !== true) {
        refsToEnable.push(ref);
        continue;
      }
      if (machineClaims.some((claim) => claim.ref === ref)) {
        alreadyOwnedRefs.push(ref);
        continue;
      }
      if (ownRefs?.includes(ref) === true) {
        if (!enablementIsMachineGlobal(tools, toolId) || !claims.machineKept)
          alreadyOwnedRefs.push(ref);
        continue;
      }
      run.logger.info(
        `${toolId}: '${ref}' was already enabled before this project asked for it — left as it is, and this project's clean will leave it enabled.`
      );
    }
    return { refsToEnable, alreadyOwnedRefs };
  }

  private async nativeCatalogProof(
    run: Run,
    hostName: string,
    fresh?: RegisteredMarketplace
  ): Promise<NativeCatalogProof> {
    const { tools, toolId, projectRoot, claims } = run;
    if (!tools.isAiTool(toolId))
      return { canonical: false, hostReadable: false, sourceStatus: "unproven" };
    const registrations = await claims.machine();
    const project = await claims.persistedProject();
    const localRegistration = enablementIsMachineGlobal(tools, toolId)
      ? undefined
      : project?.marketplaces.find((entry) => entry.hostName === hostName);
    const canonical =
      fresh !== undefined ||
      registrations?.marketplaces.some((entry) => entry.hostName === hostName) === true ||
      localRegistration !== undefined;
    const registration = fresh ??
      registrations?.marketplaces.find((entry) => entry.hostName === hostName) ??
      localRegistration ?? {
        alias: hostName,
        hostName,
      };
    const sourceProof = await inspectNativeMarketplaceSource(
      this.sources.get(toolId),
      projectRoot,
      registration
    );
    const reader = this.pluginRegistries.get(toolId);
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
      ...(registrations?.pluginClaims ?? []).map((claim) => claim.ref),
      ...(enablementIsMachineGlobal(tools, toolId) ? [] : (project?.pluginRefs ?? [])),
    ]);
    const foreignRef = [...reading.refs].find(
      ([ref, entry]) =>
        hostRefInUse(tools, toolId, entry.enabled) &&
        ref.endsWith(`@${hostName}`) &&
        !claimed.has(ref)
    )?.[0];
    return { ...base, hostReadable: true, ...(foreignRef === undefined ? {} : { foreignRef }) };
  }

  // Returns the host's own catalog name, never this project's local alias: a catalog this
  // project just built and cannot read back is not registered at all (see the throw below).
  private async registerMarketplace<M extends RegistrationSubject>(
    run: Run,
    marketplace: M,
    build: (marketplace: M) => Promise<string | null>,
    freshClaims: readonly RegisteredMarketplace[]
  ): Promise<{
    hostName: string;
    outcome: "registered" | "refused" | "build-failed";
    claimable: boolean;
    addedThisRun?: boolean;
    provenance?: NativeMarketplaceSource;
  }> {
    const { tools, toolId, activator } = run;
    const builtDir = await build(marketplace);
    if (builtDir === null)
      return { hostName: marketplace.name, outcome: "build-failed", claimable: false };
    const requestedIdentity = await readMarketplaceCatalogIdentity(
      this.fs,
      tools.profile(toolId),
      builtDir
    );
    if (requestedIdentity === undefined) {
      throw new UnreadableBuiltCatalogError(
        marketplaceCatalogProbePath(tools.profile(toolId), builtDir) ?? builtDir
      );
    }
    const hostName = requestedIdentity.name;
    const proof = await this.nativeCatalogProof(
      run,
      hostName,
      freshClaims.find((claim) => claim.hostName === hostName)
    );
    if (
      proof.sourceStatus === "unproven" ||
      (proof.sourceStatus === "owned" && proof.source === undefined)
    ) {
      if (
        tools.isAiTool(toolId) &&
        tools.aiProfileIfAny(toolId)?.nativeActivation()?.keepsMarketplaceRegistry() === true
      ) {
        const existing = await this.marketplaceRegistries.get(toolId)?.read();
        if (existing?.entries?.has(hostName) === true)
          await this.guardAgainstConflict(run, builtDir, requestedIdentity, marketplace);
      }
      this.warn(
        run,
        `${toolId}: catalogue '${hostName}' host source unproven (${proof.sourceReason ?? "unknown"}); registration left untouched.`
      );
      return { hostName, outcome: "refused", claimable: false };
    }
    const hostMarketplaceReading =
      tools.isAiTool(toolId) &&
      tools.aiProfileIfAny(toolId)?.nativeActivation()?.keepsMarketplaceRegistry() === true
        ? await this.marketplaceRegistries.get(toolId)?.read()
        : undefined;
    if (hostMarketplaceReading?.entries?.has(hostName) === true && !proof.canonical) {
      await this.guardAgainstConflict(run, builtDir, requestedIdentity, marketplace);
      this.warn(
        run,
        `${toolId}: catalogue '${hostName}' is already registered on the host without a canonical AIDD claim; same-name collision left untouched.`
      );
      return { hostName, outcome: "refused", claimable: false };
    }
    if (
      hostMarketplaceReading !== undefined &&
      hostMarketplaceReading.entries === undefined &&
      hostMarketplaceReading.absent !== true
    ) {
      this.warn(
        run,
        `${toolId}: catalogue '${hostName}' host registry is unreadable; ownership unproven and registration left untouched.`
      );
      return { hostName, outcome: "refused", claimable: false };
    }
    if (!proof.hostReadable || proof.foreignRef !== undefined || proof.unreadable !== undefined) {
      this.warn(
        run,
        proof.foreignRef === undefined
          ? `${toolId}: catalogue '${hostName}' collides with unreadable host plugin registry (${proof.unreadable}); registration left untouched.`
          : `${toolId}: catalogue '${hostName}' carries foreign host ref '${proof.foreignRef}'; registration left untouched.`
      );
      return { hostName, outcome: "refused", claimable: false };
    }
    const requestedSource = await this.fs.realpath(builtDir).catch(() => builtDir);
    if (
      proof.sourceStatus === "owned" &&
      proof.source?.source !== undefined &&
      samePath(proof.source.source, requestedSource) &&
      (proof.source.kind === "registry" ||
        (proof.source.kind === "effective-list" &&
          samePath(proof.source.root, requestedSource) &&
          proof.source.sourceType === "local"))
    )
      return { hostName, outcome: "registered", claimable: true, provenance: proof.source };
    const decision = await this.guardAgainstConflict(run, builtDir, requestedIdentity, marketplace);
    // A "skip" is a host already following a newer shared build, never this project's own
    // pre-migration cache, so it counts as registered.
    if (decision === "skip")
      return {
        hostName,
        outcome: "registered",
        claimable: proof.sourceStatus === "owned",
        provenance: proof.source,
      };
    try {
      activator.addMarketplace(builtDir, marketplace.scope);
    } catch (error) {
      if (!(error instanceof NativePluginCliError)) throw error;
      const reclaimed = await this.reclaimOrReport(run, marketplace, hostName, builtDir, error);
      if (!reclaimed) return { hostName, outcome: "refused", claimable: false };
      const afterReclaim = await this.proveAddedSource(run, hostName, builtDir);
      return {
        hostName,
        outcome: afterReclaim === undefined ? "refused" : "registered",
        claimable: afterReclaim !== undefined,
        addedThisRun: afterReclaim !== undefined,
        provenance: afterReclaim,
      };
    }
    const afterAdd = await this.proveAddedSource(run, hostName, builtDir);
    return {
      hostName,
      outcome: afterAdd === undefined ? "refused" : "registered",
      claimable: afterAdd !== undefined,
      addedThisRun: afterAdd !== undefined,
      provenance: afterAdd,
    };
  }

  private async proveAddedSource(
    run: Run,
    hostName: string,
    builtDir: string
  ): Promise<NativeMarketplaceSource | undefined> {
    const { tools, toolId } = run;
    if (!tools.isAiTool(toolId)) return undefined;
    const reading = await this.sources.get(toolId)?.read(run.projectRoot);
    const current = reading?.entries?.get(hostName);
    const expected = await this.fs.realpath(builtDir).catch(() => builtDir);
    const sourceMatches =
      current?.source === expected &&
      (current.kind === "registry" ||
        (current.kind === "effective-list" &&
          current.sourceType === "local" &&
          current.root === expected));
    if (sourceMatches) return current;
    this.warn(
      run,
      `${toolId}: catalogue '${hostName}' add returned but effective host source could not be proven as '${expected}'; no AIDD claim or enablement recorded. Reconcile manually.`
    );
    return undefined;
  }

  /**
   * Refuses `addMarketplace` where it would silently replace a *different catalog* the host holds
   * under this name — measured: claude derives the registered name from the source's own catalog
   * and re-adds over it with no prompt and no error. A local alias differing from the catalog's
   * declared name is supported and never compared here, and the same catalog reached through a
   * differently resolved path is no conflict. A drift decides first: a host on a newer shared build
   * returns `"skip"` and is never written backward, one on a pre-migration cache proceeds.
   */
  private async guardAgainstConflict(
    run: Run,
    builtDir: string,
    requestedIdentity: MarketplaceCatalogIdentity,
    marketplace: RegistrationSubject
  ): Promise<"proceed" | "skip"> {
    const { tools, toolId } = run;
    if (!tools.isAiTool(toolId)) return "proceed";
    if (tools.aiProfileIfAny(toolId)?.nativeActivation()?.keepsMarketplaceRegistry() !== true)
      return "proceed";
    const reader = this.marketplaceRegistries.get(toolId);
    if (reader === undefined) return "proceed";
    const requestedSource = await this.fs.realpath(builtDir).catch(() => builtDir);
    const check = await hostMarketplaceSourceConflict(
      this.fs,
      tools.aiProfile(toolId),
      reader,
      requestedSource,
      requestedIdentity,
      {
        userCacheRoot: run.userCacheRoot(),
        projectRoot: run.projectRoot,
        marketplaceName: marketplace.name,
        target: toolId,
      }
    );
    if (check === undefined) return "proceed";
    if (isDriftFound(check)) return this.decideOnDrift(run, check);
    const diff = pluginSetDifference(check.registeredIdentity, check.requestedIdentity);
    throw new MarketplaceSourceConflictError(
      `Marketplace '${check.name}' is already registered from a different catalog: ` +
        `${check.registeredSource} differs from the one requested, ${check.requestedSource} ` +
        `— plugins ${describePluginDiff(diff)}, per ${check.location}. ` +
        `Do not remove a catalogue another user or project may depend on. ` +
        `Reconcile the host source manually before retrying \`aidd sync\`.`
    );
  }

  /**
   * A host already following a newer build is never written backward — warned, not thrown, so a
   * caller iterating several tools still proceeds. A host tracking *another* project's
   * pre-migration cache can proceed only through the separate host-source proof; discovering a
   * path here never creates a shared-source claim before registration succeeds.
   */
  private decideOnDrift(run: Run, found: MarketplaceSourceDriftFound): "proceed" | "skip" {
    if (found.drift.kind === "unmigrated-foreign-project-source") return "proceed";
    if (found.drift.kind !== "version-behind") return "proceed";
    const { registeredVersion, requestedVersion } = found.drift;
    this.warn(
      run,
      `${run.toolId}'s marketplace registry (${found.location}) already carries a newer ` +
        `aidd-framework build, ${registeredVersion}, than this run's own ${requestedVersion} — ` +
        "not registering this run's build over it. Run `aidd update` to bring this project's " +
        "CLI to at least the version the host already follows."
    );
    return "skip";
  }

  // Reclaim only a dead Claude registration whose current source is recognisably AIDD-owned.
  // `hostName`, never the project's alias, names every host-facing call.
  private async reclaimOrReport(
    run: Run,
    marketplace: RegistrationSubject,
    hostName: string,
    builtDir: string,
    addError: NativePluginCliError
  ): Promise<boolean> {
    const { tools, toolId, activator, projectRoot } = run;
    const proof = await this.nativeCatalogProof(run, hostName);
    if (
      !proof.canonical ||
      !proof.hostReadable ||
      proof.sourceStatus !== "owned" ||
      proof.foreignRef !== undefined
    ) {
      this.warn(
        run,
        `Native plugin activation — catalogue '${hostName}' collides with unproven AIDD ownership` +
          `${proof.foreignRef === undefined ? "" : ` and foreign ref '${proof.foreignRef}'`}; host registration left untouched. ${addError.message}`
      );
      return false;
    }
    const registeredSource = tools.isAiTool(toolId)
      ? (await this.marketplaceRegistries.get(toolId)?.read())?.entries?.get(hostName)
      : undefined;
    const source =
      registeredSource === undefined
        ? undefined
        : await this.fs.realpath(registeredSource).catch(() => registeredSource);
    const projectSource =
      source === undefined
        ? undefined
        : parseBuiltMarketplaceDir(
            await this.fs.realpath(projectRoot).catch(() => projectRoot),
            source
          );
    const userRoot = run.userCacheRoot();
    const userSource =
      source === undefined || userRoot === ""
        ? undefined
        : parseUserBuiltMarketplaceDir(
            await this.fs.realpath(userRoot).catch(() => userRoot),
            source
          );
    const provenSource = [projectSource, userSource].some(
      (location) =>
        location !== undefined &&
        samePathSegment(location.marketplaceName, marketplace.name) &&
        samePathSegment(location.target, toolId)
    );
    if (!provenSource) {
      this.warn(
        run,
        `Native plugin activation — catalogue '${hostName}' host catalogue source is unproven; ` +
          `host registration left untouched. ${addError.message}`
      );
      return false;
    }
    if (activator.registrationState(hostName) !== "dead") {
      this.warn(
        run,
        `Native plugin activation — register marketplace '${hostName}' skipped: ${addError.message}`
      );
      return false;
    }
    this.warn(
      run,
      `Marketplace '${hostName}' was registered to a directory that no longer exists; re-registering it for this project. Plugins installed from it are removed and the ones this CLI manages are put back.`
    );
    if (
      !this.bestEffort(
        run,
        () => activator.removeMarketplace(hostName, marketplace.scope, { force: true }),
        `unregister stale marketplace '${hostName}'`
      )
    )
      return false;
    return this.bestEffort(
      run,
      () => activator.addMarketplace(builtDir, marketplace.scope),
      `register marketplace '${hostName}'`
    );
  }
}
