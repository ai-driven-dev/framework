import {
  NativePluginCliError,
  UnreadableBuiltCatalogError,
} from "../../../../shared/domain/errors.js";
import { samePath } from "../../../../shared/domain/paths.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { BuiltCatalogs } from "../../contract/built-catalogs.js";
import type { ClaimsView } from "../../contract/claims-view.js";
import { judgeRegistration } from "../../domain/policy/registration-policy.js";
import type {
  NativeMarketplaceRegistration,
  NativeMarketplaceSource,
} from "../../domain/record/native-marketplace-source.js";
import { pluginRefsOf, recordedMarketplaces } from "../../domain/record/registration-record.js";
import type { HostActions } from "../../ports/host-actions.js";
import { bestEffortNativeCall, skippedWarning } from "../confirmation.js";
import {
  marketplaceCatalogProbePath,
  readMarketplaceCatalogIdentity,
} from "../read-marketplace-catalog-identity.js";
import {
  guardAgainstConflict,
  type HostRegistries,
  marketplaceRegistryOf,
  nativeCatalogProof,
  proveAddedSource,
  type RegistrationRun,
  type RegistrationSubject,
  warnRegistration,
} from "./catalog-source-guard.js";
import { reclaimOrReport } from "./reclaim-dead-registration.js";

/** What a registration says while it runs. The caller's own logger satisfies it. */
export interface RegistrationLogger {
  readonly debug: (message: string) => void;
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
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

export interface RegisterPluginWithHostCommand<M extends RegistrationSubject> {
  readonly toolId: ToolId;
  readonly projectRoot: string;
  readonly scope: Scope;
  readonly marketplaces: readonly M[];
  readonly claims: ClaimsView;
  readonly build: BuiltCatalogs<M>;
  /** The refs this run enables, given the host name each proven marketplace answers to. */
  readonly refsToEnable: (hostNameByAlias: ReadonlyMap<string, string>) => string[];
  readonly userCacheRoot: () => string;
  /** Every warning goes to the logger and is kept, in order, for the caller's result. */
  readonly sink: { readonly logger: RegistrationLogger; readonly warnings: string[] };
}

export type RegisterPluginWithHostResult =
  | { readonly status: "unconfigured" }
  | { readonly status: "binary-missing"; readonly binary: string }
  | { readonly status: "activated"; readonly outcome: HostRegistrationOutcome };

/** A marketplace the host holds and this project may claim; its absence is a refusal. */
interface MarketplaceClaim {
  readonly hostName: string;
  readonly provenance: NativeMarketplaceSource | undefined;
  readonly addedThisRun?: true;
}

export class RegisterPluginWithHost {
  constructor(
    private readonly fs: FileReader,
    /** Native plugin CLI activators, keyed by the `binary` each profile declares. */
    private readonly activators: ReadonlyMap<string, HostActions>,
    /** Only a tool whose profile declares a registry is ever looked up here, so a tool absent
     * from a map still registers. */
    private readonly hosts: HostRegistries,
    /** The platform whose path rules compare what a host stored with what this run resolved. */
    private readonly platform: string,
    private readonly tools: ToolCatalog
  ) {}

  /** Registers every marketplace with the tool's own CLI and enables the refs this run asks
   * for. Each step is independently best-effort: one failing plugin or marketplace warns and
   * lets the others through. Anything but a recoverable `NativePluginCliError` propagates. */
  async execute<M extends RegistrationSubject>(
    command: RegisterPluginWithHostCommand<M>
  ): Promise<RegisterPluginWithHostResult> {
    const { toolId, projectRoot, scope, marketplaces, claims, sink } = command;
    const profile = this.tools.aiProfileIfAny(toolId);
    const binary = profile?.nativeActivation()?.hostBinary();
    const activator = binary === undefined ? undefined : this.activators.get(binary);
    if (profile === null || binary === undefined || activator === undefined)
      return { status: "unconfigured" };
    if (!activator.isAvailable()) return { status: "binary-missing", binary };
    const run: RegistrationRun = {
      toolId,
      profile,
      activator,
      fs: this.fs,
      hosts: this.hosts,
      projectRoot,
      claims,
      userCacheRoot: command.userCacheRoot,
      platform: this.platform,
      logger: sink.logger,
      warnings: sink.warnings,
    };
    // Every known marketplace, never only the ones a plugin points at: declaring a marketplace
    // and installing a plugin from it are two acts. Measured against the real `claude` binary -
    // a project with two registered marketplaces and no plugin was told about neither.
    const ownMarketplaces: RegisteredMarketplace[] = [];
    const preservedMarketplaces: RegisteredMarketplace[] = [];
    const catalogClaims: RegisteredMarketplace[] = [];
    const addedHostNames = new Set<string>();
    const recorded = recordedMarketplaces(claims.recorded);
    let buildFailed = false;
    for (const marketplace of marketplaces) {
      const builtDir = await command.build(marketplace);
      if (builtDir === null) buildFailed = true;
      const claim =
        builtDir === null
          ? undefined
          : await this.registerMarketplace(run, marketplace, builtDir, catalogClaims);
      const earlier = recorded?.find((m) => m.alias === marketplace.name);
      if (claim !== undefined) {
        const entry = {
          alias: marketplace.name,
          hostName: claim.hostName,
          ...(claim.provenance === undefined ? {} : { provenance: claim.provenance }),
        };
        ownMarketplaces.push(entry);
        catalogClaims.push(entry);
        if (claim.addedThisRun === true) addedHostNames.add(claim.hostName);
      } else if (earlier !== undefined) {
        const proof = await nativeCatalogProof(run, earlier.hostName);
        if (judgeRegistration({ intent: "register", ...proof }).outcome === "proceed")
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
    const warn = (message: string): void => warnRegistration(run, message);
    const stillProven: RegisteredMarketplace[] = [];
    for (const registration of ownMarketplaces) {
      const fresh = catalogClaims.find((claim) => claim.hostName === registration.hostName);
      const proof = await nativeCatalogProof(run, registration.hostName, fresh);
      if (judgeRegistration({ intent: "register", ...proof }).outcome === "refuse") continue;
      stillProven.push(registration);
      if (!addedHostNames.has(registration.hostName))
        bestEffortNativeCall(
          () => activator.upgradeMarketplaces(registration.hostName),
          skippedWarning(`upgrade marketplace '${registration.hostName}'`),
          warn
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
        bestEffortNativeCall(
          () => activator.enablePlugin(ref, scope),
          skippedWarning(`enable plugin '${ref}'`),
          warn
        ).confirmed
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

  private async refsThisProjectEnables(
    run: RegistrationRun,
    refs: string[]
  ): Promise<{ refsToEnable: string[]; alreadyOwnedRefs: string[] }> {
    const { profile, claims } = run;
    const hostRegistry = this.hosts.pluginRegistries.get(profile.toolId);
    if (hostRegistry === undefined) return { refsToEnable: refs, alreadyOwnedRefs: [] };
    const ownRefs = pluginRefsOf(claims.recorded);
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
        if (!profile.pluginEnablementIsMachineGlobal() || !claims.machineKept)
          alreadyOwnedRefs.push(ref);
        continue;
      }
      run.logger.info(
        `${run.toolId}: '${ref}' was already enabled before this project asked for it — left as it is, and this project's clean will leave it enabled.`
      );
    }
    return { refsToEnable, alreadyOwnedRefs };
  }

  // Returns the host's own catalog name, never this project's local alias: a catalog this
  // project just built and cannot read back is not registered at all (see the throw below).
  private async registerMarketplace<M extends RegistrationSubject>(
    run: RegistrationRun,
    marketplace: M,
    builtDir: string,
    freshClaims: readonly RegisteredMarketplace[]
  ): Promise<MarketplaceClaim | undefined> {
    const { toolId, profile, activator } = run;
    const requestedIdentity = await readMarketplaceCatalogIdentity(this.fs, profile, builtDir);
    if (requestedIdentity === undefined) {
      throw new UnreadableBuiltCatalogError(
        marketplaceCatalogProbePath(profile, builtDir) ?? builtDir
      );
    }
    const hostName = requestedIdentity.name;
    const request = { builtDir, identity: requestedIdentity, marketplace };
    const proof = await nativeCatalogProof(
      run,
      hostName,
      freshClaims.find((claim) => claim.hostName === hostName)
    );
    if (
      proof.sourceStatus === "unproven" ||
      (proof.sourceStatus === "owned" && proof.source === undefined)
    ) {
      const existing = await marketplaceRegistryOf(run)?.read();
      if (existing?.entries?.has(hostName) === true) await guardAgainstConflict(run, request);
      warnRegistration(
        run,
        `${toolId}: catalogue '${hostName}' host source unproven (${proof.sourceReason ?? "unknown"}); registration left untouched.`
      );
      return undefined;
    }
    const hostMarketplaceReading = await marketplaceRegistryOf(run)?.read();
    if (hostMarketplaceReading?.entries?.has(hostName) === true && !proof.canonical) {
      await guardAgainstConflict(run, request);
      warnRegistration(
        run,
        `${toolId}: catalogue '${hostName}' is already registered on the host without a canonical AIDD claim; same-name collision left untouched.`
      );
      return undefined;
    }
    if (
      hostMarketplaceReading !== undefined &&
      hostMarketplaceReading.entries === undefined &&
      hostMarketplaceReading.absent !== true
    ) {
      warnRegistration(
        run,
        `${toolId}: catalogue '${hostName}' host registry is unreadable; ownership unproven and registration left untouched.`
      );
      return undefined;
    }
    if (!proof.hostReadable || proof.foreignRef !== undefined || proof.unreadable !== undefined) {
      warnRegistration(
        run,
        proof.foreignRef === undefined
          ? `${toolId}: catalogue '${hostName}' collides with unreadable host plugin registry (${proof.unreadable}); registration left untouched.`
          : `${toolId}: catalogue '${hostName}' carries foreign host ref '${proof.foreignRef}'; registration left untouched.`
      );
      return undefined;
    }
    const requestedSource = await this.fs.realpath(builtDir).catch(() => builtDir);
    if (
      proof.sourceStatus === "owned" &&
      proof.source?.source !== undefined &&
      samePath(proof.source.source, requestedSource, this.platform) &&
      (proof.source.kind === "registry" ||
        (proof.source.kind === "effective-list" &&
          samePath(proof.source.root, requestedSource, this.platform) &&
          proof.source.sourceType === "local"))
    )
      return { hostName, provenance: proof.source };
    const decision = await guardAgainstConflict(run, request);
    // A "skip" is a host already following a newer shared build, never this project's own
    // pre-migration cache, so it counts as registered.
    if (decision === "skip")
      return proof.sourceStatus === "owned" ? { hostName, provenance: proof.source } : undefined;
    try {
      activator.addMarketplace(builtDir, marketplace.scope);
    } catch (error) {
      if (!(error instanceof NativePluginCliError)) throw error;
      const reclaimed = await reclaimOrReport(run, { marketplace, hostName, builtDir }, error);
      if (!reclaimed) return undefined;
    }
    return this.claimAdded(hostName, await proveAddedSource(run, hostName, builtDir));
  }

  private claimAdded(
    hostName: string,
    source: NativeMarketplaceSource | undefined
  ): MarketplaceClaim | undefined {
    return source === undefined ? undefined : { hostName, provenance: source, addedThisRun: true };
  }
}
