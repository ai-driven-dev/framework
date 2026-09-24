import { join, resolve } from "node:path";
import {
  MarketplaceSourceConflictError,
  NativePluginCliError,
  UnreadableBuiltCatalogError,
} from "../../../../kernel/errors.js";
import {
  BUILT_CACHE_SUBDIR,
  parseBuiltMarketplaceDir,
  parseUserBuiltMarketplaceDir,
  samePath,
  samePathSegment,
} from "../../../../kernel/paths.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { Logger } from "../../../../kernel/ports/logger.js";
import type { VersionReader } from "../../../../kernel/ports/version-reader.js";
import type { MarketplaceScope } from "../../../../kernel/scope.js";
import { type AiToolId, isAiToolId, type ToolId } from "../../../../kernel/tool.js";
import type { MarketplaceRegisterFramework } from "../../../distribution/application/marketplace-register-framework-use-case.js";
import {
  FRAMEWORK_MARKETPLACE_NAME,
  type Marketplace,
} from "../../../distribution/domain/marketplace.js";
import type { MarketplaceRegistry } from "../../../distribution/domain/ports/marketplace-registry.js";
import type { MarketplaceSettings } from "../../../tools/domain/marketplace-settings.js";
import {
  describePluginDiff,
  type MarketplaceCatalogIdentity,
  pluginSetDifference,
} from "../../../tools/domain/marketplace-source-conflict.js";
import type { HostMarketplaceRegistryReader } from "../../../tools/domain/ports/host-marketplace-registry-reader.js";
import type { HostPluginRegistryReader } from "../../../tools/domain/ports/host-plugin-registry-reader.js";
import type {
  NativeMarketplaceSource,
  NativeMarketplaceSourceReader,
} from "../../../tools/domain/ports/native-marketplace-source-reader.js";
import type { NativePluginActivator } from "../../../tools/domain/ports/native-plugin-activator.js";
import {
  nativeActivationOf,
  pluginEnablementIsMachineGlobal,
  resolvePluginsCapability,
} from "../../../tools/domain/registry.js";
import type { FrameworkBuildTarget } from "../../../translate/domain/build-target.js";
import type {
  NativeMarketplaceRegistration,
  NativeRegistrations,
} from "../../domain/manifest/native-registrations.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { UserSourceReferences } from "../../domain/ports/user-source-references.js";
import {
  inspectNativeMarketplaceSource,
  sameNativeMarketplaceSource,
} from "../ownership/native-marketplace-source-proof.js";
import type { EnsureBuiltMarketplace } from "../shared/ensure-built-marketplace-use-case.js";
import {
  hostMarketplaceSourceConflict,
  isDriftFound,
  type MarketplaceSourceDriftFound,
} from "../shared/host-marketplace-source-conflict.js";
import { resolveCacheCandidate } from "../shared/purge-declared-cache.js";
import {
  marketplaceCatalogProbePath,
  readMarketplaceCatalogIdentity,
} from "../shared/read-marketplace-catalog-identity.js";
import {
  frameworkSourceIsShared,
  resolveProjectRootForReferences,
  toleratingUnreadableSourceReferences,
} from "../shared/shared-source-reference-support.js";

export interface MarketplaceSyncSettingsOptions {
  projectRoot: string;
  /** Limits both the settings sync and the native activation to these tools; every
   * installed tool when absent. */
  toolIds?: readonly ToolId[];
  /** Re-registers the framework marketplace when this run finds none at all — `sync` alone
   * sets it, so every other caller reads an empty registry as found rather than repopulating it. */
  recreateFrameworkIfMissing?: boolean;
  /**
   * The scope this run enables plugins at, which is a different question than a marketplace's
   * own `scope`. `"user"` also writes nothing under `projectRoot`, so `syncTool` is skipped.
   */
  scope?: MarketplaceScope;
  /**
   * Overrides the manifest this run reads and writes — the user-scope manifest under
   * `userConfigDir()`, which only `setup --scope user` and `sync --scope user` ever pass.
   */
  manifestRepo?: ManifestRepository;
  /**
   * Narrows the settings sync and native activation to the marketplaces named here; absent
   * activates every registered one. A name matching nothing resolves to zero marketplaces,
   * never a fallback to every one.
   */
  marketplaceNames?: readonly string[];
}

interface ActivationOutcome {
  marketplaces: readonly NativeMarketplaceRegistration[];
  preservedMarketplaces: readonly NativeMarketplaceRegistration[];
  catalogClaims: readonly NativeMarketplaceRegistration[];
  pluginRefs: readonly string[];
  /** A marketplace whose build failed was warned about and left unregistered this run — the
   * host's own registration for it is wherever it was before. */
  buildFailed: boolean;
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

export interface MarketplaceSyncSettingsResult {
  /** Tools whose own CLI actually ran, whether or not every step inside it succeeded. */
  activated: readonly ToolId[];
  /** Tools with a native activation whose binary was not on PATH — nothing of theirs
   * ran, so the settings this pass wrote will not load until it has. */
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  /** What a recoverable, best-effort step logged — the same text `logger.warn` received. */
  warnings: readonly string[];
  /** A hard failure that is not the recoverable `NativePluginCliError` family: a bug in an
   * activator, or the source-conflict guard's deliberate refusal. Returned rather than thrown,
   * so whether the whole command fails stays the caller's decision. */
  errors: readonly { scope: string; message: string }[];
}

const EMPTY_RESULT: MarketplaceSyncSettingsResult = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [],
};

export interface MarketplaceSyncSettings {
  execute(options: MarketplaceSyncSettingsOptions): Promise<MarketplaceSyncSettingsResult>;
}

interface ActivationRun {
  outcomes: ReadonlyMap<ToolId, ActivationOutcome>;
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  warnings: readonly string[];
  errors: readonly { scope: string; message: string }[];
}

export class MarketplaceSyncSettingsUseCase implements MarketplaceSyncSettings {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly marketplaceRegistry: MarketplaceRegistry,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    /** Native plugin CLI activators, keyed by the `binary` each profile declares. */
    private readonly activators: ReadonlyMap<string, NativePluginActivator>,
    private readonly ensureBuilt: EnsureBuiltMarketplace,
    /** Readers of a host's own marketplace registry, keyed by `AiToolId` — only a tool whose
     * profile declares `NativeActivation.marketplaceRegistry` is ever looked up here, so a tool
     * absent from this map still syncs. */
    private readonly hostMarketplaceRegistries: ReadonlyMap<
      AiToolId,
      HostMarketplaceRegistryReader
    > = new Map(),
    /** Root of a user-scope marketplace's built tree, mirroring `EnsureBuiltMarketplaceUseCase`'s
     * own `userCacheRoot` — the version a drift is decided against comes from `builtDir` itself,
     * already built before this runs, never from a path recomputed without one. */
    private readonly userCacheRoot: () => string = () => "",
    /** Re-registers the shared machine-scope source when this run finds no marketplace at all.
     * Absent keeps the silent no-op instead of guessing what to register. */
    private readonly marketplaceRegisterFrameworkUseCase?: MarketplaceRegisterFramework,
    private readonly userSourceReferences?: UserSourceReferences,
    private readonly currentVersionProvider?: VersionReader,
    private readonly hostPluginRegistries: ReadonlyMap<
      AiToolId,
      HostPluginRegistryReader
    > = new Map(),
    private readonly userManifestRepo?: ManifestRepository,
    private readonly nativeSources: ReadonlyMap<AiToolId, NativeMarketplaceSourceReader> = new Map()
  ) {}

  async execute(options: MarketplaceSyncSettingsOptions): Promise<MarketplaceSyncSettingsResult> {
    if (
      (options.scope ?? "project") === "project" &&
      this.userManifestRepo?.withExclusiveAccess !== undefined
    ) {
      return this.userManifestRepo.withExclusiveAccess(() => this.executeLocked(options));
    }
    return this.executeLocked(options);
  }

  private async executeLocked(
    options: MarketplaceSyncSettingsOptions
  ): Promise<MarketplaceSyncSettingsResult> {
    const { projectRoot } = options;
    const manifestRepo = options.manifestRepo ?? this.manifestRepo;
    const scope = options.scope ?? "project";
    const [manifest, initialMarketplaces] = await Promise.all([
      manifestRepo.load().catch(() => null),
      this.marketplaceRegistry.list(projectRoot),
    ]);
    if (manifest === null) return EMPTY_RESULT;
    const recreatedMarketplaces = options.recreateFrameworkIfMissing
      ? await this.ensureFrameworkRegistered(projectRoot, initialMarketplaces)
      : initialMarketplaces;
    const marketplaces =
      options.marketplaceNames === undefined
        ? recreatedMarketplaces
        : recreatedMarketplaces.filter((m) => options.marketplaceNames?.includes(m.name));
    if (marketplaces.length === 0) return EMPTY_RESULT;
    const toolIds = this.selectToolIds(manifest, options.toolIds);
    let anyToolUpdated = false;
    // A user-scope run lands nothing under `projectRoot`, so no project settings file mirrors it.
    if (scope === "project") {
      for (const toolId of toolIds) {
        if (
          resolvePluginsCapability(toolId)?.marketplaceSettings
            ?.declarativePluginActivationRequiresNativeProof === true
        )
          continue;
        if (await this.syncTool(toolId, projectRoot, manifest, marketplaces)) anyToolUpdated = true;
      }
    }
    if (anyToolUpdated) await manifestRepo.save(manifest);
    const activation = await this.activateNativeTools(
      projectRoot,
      manifest,
      marketplaces,
      toolIds,
      scope
    );
    let declarativeChanged = false;
    if (scope === "project") {
      for (const [toolId, outcome] of activation.outcomes) {
        const settings = resolvePluginsCapability(toolId)?.marketplaceSettings;
        if (settings?.declarativePluginActivationRequiresNativeProof !== true) continue;
        const hostNames = new Set(outcome.marketplaces.map((entry) => entry.hostName));
        const provenRefs = outcome.pluginRefs.filter((ref) =>
          [...hostNames].some((hostName) => ref.endsWith(`@${hostName}`))
        );
        if (
          provenRefs.length > 0 &&
          (await this.syncEnabledPluginsFile(
            toolId,
            projectRoot,
            manifest,
            marketplaces,
            settings,
            provenRefs
          ))
        )
          declarativeChanged = true;
      }
    }
    if (declarativeChanged) await manifestRepo.save(manifest);
    // A refused or unproven host registration cannot establish a new shared-source claim.
    // User-scope runs have no project manifest for a later `clean` to decrement it.
    if (scope !== "user") {
      await this.recordSharedSourceReference(projectRoot, marketplaces, activation.outcomes);
    }
    const wroteHashes = await this.recordWhatActivationWrote(projectRoot, manifest, [
      ...activation.outcomes.keys(),
    ]);
    const wroteRegistrations = this.recordNativeRegistrations(
      manifest,
      activation.outcomes,
      options.marketplaceNames !== undefined
    );
    if (wroteHashes || wroteRegistrations) await manifestRepo.save(manifest);
    await this.recordMachinePluginClaims(
      manifest,
      activation.outcomes,
      marketplaces,
      scope,
      scope === "project" ? projectRoot : undefined
    );
    if (options.recreateFrameworkIfMissing === true && scope === "project") {
      await this.purgeStaleProjectCache(projectRoot, marketplaces, activation);
    }
    return {
      activated: [...activation.outcomes.keys()],
      binaryMissing: activation.binaryMissing,
      warnings: activation.warnings,
      errors: activation.errors,
    };
  }

  /**
   * Only ever called when `recreateFrameworkIfMissing` is set: every other caller reaching an
   * empty registry is reading a deliberate choice to have no marketplace at all. A project-scope
   * `aidd-framework` entry is retired to the machine-scope one here, carrying forward its own
   * `pluginSource` — the register use case's default would silently replace a project installed
   * from GitHub or a custom path with `{ kind: "local", path: "." }`.
   */
  private async ensureFrameworkRegistered(
    projectRoot: string,
    marketplaces: readonly Marketplace[]
  ): Promise<readonly Marketplace[]> {
    const framework = marketplaces.find((m) => m.name === FRAMEWORK_MARKETPLACE_NAME);
    if (marketplaces.length > 0 && framework?.scope !== "project") return marketplaces;
    if (this.marketplaceRegisterFrameworkUseCase === undefined) return marketplaces;
    await this.marketplaceRegisterFrameworkUseCase.execute({
      projectRoot,
      pluginSource: framework?.source,
    });
    return this.marketplaceRegistry.list(projectRoot);
  }

  /**
   * Never run before every tool's own native activation: a host's CLI needs the tree it is
   * unregistering from to still exist, and a binary off `PATH` or a failed build can leave a
   * registration still naming this project's own pre-migration cache. `resolveCacheCandidate`
   * refuses anything that does not `realpath` strictly inside `projectRoot`.
   */
  private async purgeStaleProjectCache(
    projectRoot: string,
    marketplaces: readonly Marketplace[],
    activation: ActivationRun
  ): Promise<void> {
    if (activation.errors.length > 0) return;
    const framework = marketplaces.find((m) => frameworkSourceIsShared(m.name, m.scope));
    if (framework === undefined) return;
    if (activation.binaryMissing.length > 0) {
      this.logger.warn(
        "This project's own pre-migration framework cache kept: a requested tool's CLI " +
          "was not on PATH this run, so its own registration may still point at it — run " +
          "`aidd sync` again once every tool's CLI is on PATH."
      );
      return;
    }
    if ([...activation.outcomes.values()].some((outcome) => outcome.buildFailed)) {
      this.logger.warn(
        "This project's own pre-migration framework cache kept: a requested tool's build " +
          "failed this run, so its own registration may still point at it — fix the build " +
          "warning above, then run `aidd sync` again."
      );
      return;
    }
    const candidate = await resolveCacheCandidate(
      this.fs,
      this.logger,
      projectRoot,
      join(BUILT_CACHE_SUBDIR, FRAMEWORK_MARKETPLACE_NAME),
      "This project's own pre-migration framework cache"
    );
    if (candidate === null) return;
    await this.fs.deleteDirectory(candidate);
    this.logger.info(`This project's own pre-migration framework cache purged: ${candidate}`);
  }

  /**
   * Refreshed only after native activation proves that the host uses the shared source.
   */
  private async recordSharedSourceReference(
    projectRoot: string,
    marketplaces: readonly Marketplace[],
    outcomes: ReadonlyMap<ToolId, ActivationOutcome>
  ): Promise<void> {
    if (this.userSourceReferences === undefined || this.currentVersionProvider === undefined) {
      return;
    }
    const framework = marketplaces.find((m) => frameworkSourceIsShared(m.name, m.scope));
    if (framework === undefined) return;
    if (
      ![...outcomes.values()].some((outcome) =>
        outcome.marketplaces.some((registration) => registration.alias === framework.name)
      )
    )
      return;
    await this.recordReferenceForRoot(projectRoot);
  }

  private async recordReferenceForRoot(root: string): Promise<void> {
    if (this.userSourceReferences === undefined || this.currentVersionProvider === undefined) {
      return;
    }
    const userSourceReferences = this.userSourceReferences;
    const currentVersionProvider = this.currentVersionProvider;
    await toleratingUnreadableSourceReferences(this.logger, undefined, async () => {
      const resolvedRoot = await resolveProjectRootForReferences(this.fs, root);
      await userSourceReferences.addReference(currentVersionProvider.get(), resolvedRoot);
    });
  }

  private selectToolIds(
    manifest: Manifest,
    toolIds: readonly ToolId[] | undefined
  ): readonly ToolId[] {
    const installed = manifest.getInstalledToolIds();
    if (toolIds === undefined) return installed;
    const requested = new Set(toolIds);
    return installed.filter((toolId) => requested.has(toolId));
  }

  /** Never a tool with no native activation, and never one whose binary is absent: neither wrote
   * anything, so a settings file that differs for it differs because a person changed it. */
  private async activateNativeTools(
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    toolIds: readonly ToolId[],
    scope: MarketplaceScope
  ): Promise<ActivationRun> {
    const outcomes = new Map<ToolId, ActivationOutcome>();
    const binaryMissing: { toolId: ToolId; binary: string }[] = [];
    const warnings: string[] = [];
    const errors: { scope: string; message: string }[] = [];
    for (const toolId of toolIds) {
      const binary = this.nativeActivationBinary(toolId);
      const activator = binary === undefined ? undefined : this.activators.get(binary);
      if (binary === undefined || activator === undefined) continue;
      if (!activator.isAvailable()) {
        this.logger.warn(`${binary} CLI not found on PATH — skipping native plugin activation.`);
        binaryMissing.push({ toolId, binary });
        continue;
      }
      try {
        const outcome = await this.activateTool(
          toolId,
          activator,
          projectRoot,
          manifest,
          marketplaces,
          warnings,
          scope
        );
        outcomes.set(toolId, outcome);
      } catch (error) {
        errors.push({ scope: toolId, message: (error as Error).message });
      }
    }
    return { outcomes, binaryMissing, warnings, errors };
  }

  /** Only for a tool this run actually activated. A `narrowed` run's `outcome` carries only the
   * marketplace it touched, so every other entry must survive the merge; an unnarrowed run replaces
   * outright, since anything absent from `outcome` is a dead registration nothing else ever drops.
   * `pluginRefs` merge by the `@<hostName>` suffix only for a hostName no retained marketplace
   * still owns — two local aliases may resolve to one hostName. */
  private recordNativeRegistrations(
    manifest: Manifest,
    activated: ReadonlyMap<ToolId, ActivationOutcome>,
    narrowed: boolean
  ): boolean {
    let changed = false;
    for (const [toolId, outcome] of activated) {
      const binary = this.nativeActivationBinary(toolId);
      if (binary === undefined) continue;
      const existing = manifest.getNativeRegistrations(toolId);
      const projected = [...outcome.marketplaces, ...outcome.preservedMarketplaces];
      const touchedAliases = new Set(projected.map((m) => m.alias));
      const touchedHostNames = new Set(projected.map((m) => m.hostName));
      const retainedMarketplaces = narrowed
        ? (existing?.marketplaces ?? []).filter((m) => !touchedAliases.has(m.alias))
        : [];
      const retainedHostNames = new Set(retainedMarketplaces.map((m) => m.hostName));
      const retainedRefs = narrowed
        ? (existing?.pluginRefs ?? []).filter(
            (ref) =>
              ![...touchedHostNames].some(
                (hostName) => !retainedHostNames.has(hostName) && ref.endsWith(`@${hostName}`)
              )
          )
        : [];
      const preservedHostNames = new Set(outcome.preservedMarketplaces.map((m) => m.hostName));
      const preservedRefs = (existing?.pluginRefs ?? []).filter((ref) =>
        [...preservedHostNames].some((hostName) => ref.endsWith(`@${hostName}`))
      );
      const registrations: NativeRegistrations = {
        binary,
        marketplaces: [...retainedMarketplaces, ...projected],
        pluginRefs: [...new Set([...retainedRefs, ...preservedRefs, ...outcome.pluginRefs])],
        ...(existing?.pluginClaims === undefined ? {} : { pluginClaims: existing.pluginClaims }),
      };
      if (nativeRegistrationsEqual(existing, registrations)) continue;
      manifest.setNativeRegistrations(toolId, registrations);
      changed = true;
    }
    return changed;
  }

  /**
   * A host's own CLI writes its registration into the very file `syncTool` had just hashed, so
   * the hash is re-read from disk after activation rather than re-derived — what is stored is
   * then the observation, not a guess at what the host would have written.
   */
  private async recordWhatActivationWrote(
    projectRoot: string,
    manifest: Manifest,
    activated: readonly ToolId[]
  ): Promise<boolean> {
    let changed = false;
    for (const toolId of activated) {
      const settingsPath = this.marketplaceSettingsOf(toolId)?.settingsPath;
      if (settingsPath === undefined) continue;
      const tracked = manifest
        .getToolFiles(toolId)
        .find((file) => file.relativePath === settingsPath);
      if (tracked === undefined) continue;
      const content = await this.fs.readFile(resolve(projectRoot, settingsPath)).catch(() => null);
      if (content === null) continue;
      const hash = this.hasher.hash(content);
      if (hash.value === tracked.hash.value) continue;
      manifest.updateTrackedFileHash(toolId, settingsPath, hash);
      changed = true;
    }
    return changed;
  }

  private marketplaceSettingsOf(toolId: ToolId): MarketplaceSettings | undefined {
    return resolvePluginsCapability(toolId)?.marketplaceSettings ?? undefined;
  }

  private nativeActivationBinary(toolId: ToolId): string | undefined {
    return nativeActivationOf(toolId)?.binary;
  }

  /** The caller has already checked `isAvailable()`, so every failure reaching here is either a
   * recoverable `NativePluginCliError` — collected into `warnings`, never thrown — or a genuine
   * bug in the activator, which propagates. */
  private async activateTool(
    toolId: ToolId,
    activator: NativePluginActivator,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    warnings: string[],
    scope: MarketplaceScope
  ): Promise<ActivationOutcome> {
    // Every known marketplace, never only the ones a plugin points at: declaring a marketplace
    // and installing a plugin from it are two acts. Measured against the real `claude` binary —
    // a project with two registered marketplaces and no plugin was told about neither.
    //
    // Each step is independently best-effort: one failing plugin or marketplace must warn and
    // let the others through, never abort the whole activation.
    const ownMarketplaces: NativeMarketplaceRegistration[] = [];
    const preservedMarketplaces: NativeMarketplaceRegistration[] = [];
    const catalogClaims: NativeMarketplaceRegistration[] = [];
    const addedHostNames = new Set<string>();
    const recorded = manifest.getNativeRegistrations(toolId)?.marketplaces;
    let buildFailed = false;
    for (const marketplace of marketplaces) {
      const registration = await this.registerMarketplace(
        activator,
        toolId,
        marketplace,
        projectRoot,
        warnings,
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
        const proof = await this.nativeCatalogProof(toolId, earlier.hostName, projectRoot);
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
        marketplaces: ownMarketplaces,
        preservedMarketplaces,
        catalogClaims,
        pluginRefs: [],
        buildFailed,
      };
    const stillProven: NativeMarketplaceRegistration[] = [];
    for (const registration of ownMarketplaces) {
      const fresh = catalogClaims.find((claim) => claim.hostName === registration.hostName);
      const proof = await this.nativeCatalogProof(
        toolId,
        registration.hostName,
        projectRoot,
        fresh
      );
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
          () => activator.upgradeMarketplaces(registration.hostName),
          `upgrade marketplace '${registration.hostName}'`,
          warnings
        );
    }
    const hostNameByAlias = new Map(stillProven.map((m) => [m.alias, m.hostName]));
    const { refsToEnable, alreadyOwnedRefs } = await this.refsThisProjectEnables(
      toolId,
      this.pluginRefsToEnable(toolId, manifest, marketplaces, hostNameByAlias),
      manifest,
      projectRoot
    );
    const enabledRefs = [...alreadyOwnedRefs];
    for (const ref of refsToEnable) {
      if (
        this.bestEffort(
          () => activator.enablePlugin(ref, scope),
          `enable plugin '${ref}'`,
          warnings
        )
      ) {
        enabledRefs.push(ref);
      }
    }
    return {
      marketplaces: ownMarketplaces,
      preservedMarketplaces,
      catalogClaims,
      pluginRefs: enabledRefs,
      buildFailed,
    };
  }

  private async refsThisProjectEnables(
    toolId: ToolId,
    refs: string[],
    manifest: Manifest,
    projectRoot: string
  ): Promise<{ refsToEnable: string[]; alreadyOwnedRefs: string[] }> {
    const hostRegistry = isAiToolId(toolId) ? this.hostPluginRegistries.get(toolId) : undefined;
    if (hostRegistry === undefined) return { refsToEnable: refs, alreadyOwnedRefs: [] };
    const ownRefs = manifest.getNativeRegistrations(toolId)?.pluginRefs;
    const onHost = (await hostRegistry.read(projectRoot)).refs;
    const machine = await this.userManifestRepo?.load();
    const machineClaims = machine?.getNativeRegistrations(toolId)?.pluginClaims ?? [];
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
        if (!pluginEnablementIsMachineGlobal(toolId) || this.userManifestRepo === undefined)
          alreadyOwnedRefs.push(ref);
        continue;
      }
      this.logger.info(
        `${toolId}: '${ref}' was already enabled before this project asked for it — left as it is, and this project's clean will leave it enabled.`
      );
    }
    return { refsToEnable, alreadyOwnedRefs };
  }

  private async recordMachinePluginClaims(
    project: Manifest,
    outcomes: ReadonlyMap<ToolId, ActivationOutcome>,
    marketplaces: readonly Marketplace[],
    scope: MarketplaceScope,
    projectRoot?: string
  ): Promise<void> {
    if (this.userManifestRepo === undefined) return;
    const machine = (await this.userManifestRepo.load()) ?? Manifest.create();
    const root = projectRoot === undefined ? undefined : await this.fs.realpath(projectRoot);
    let changed = false;
    for (const [toolId, outcome] of outcomes) {
      const machineRefs =
        scope === "user" || pluginEnablementIsMachineGlobal(toolId) ? outcome.pluginRefs : [];
      const machineMarketplaces = outcome.catalogClaims.filter((registration) =>
        marketplaces.some(
          (marketplace) =>
            marketplace.name === registration.alias &&
            (marketplace.scope === "user" || pluginEnablementIsMachineGlobal(toolId))
        )
      );
      if (machineRefs.length === 0 && machineMarketplaces.length === 0) continue;
      if (!machine.hasTool(toolId)) {
        const version = project.getToolVersion(toolId);
        if (version === undefined) continue;
        machine.addTool(toolId, version, []);
      }
      const existing = machine.getNativeRegistrations(toolId);
      const registered = [...(existing?.marketplaces ?? [])];
      for (const registration of machineMarketplaces) {
        const index = registered.findIndex(
          (entry) => entry.alias === registration.alias && entry.hostName === registration.hostName
        );
        if (index >= 0) {
          if (
            registration.provenance === undefined ||
            (registered[index].provenance !== undefined &&
              sameNativeMarketplaceSource(registered[index].provenance, registration.provenance))
          )
            continue;
          registered[index] = registration;
        } else registered.push(registration);
        changed = true;
      }
      const claims = [...(existing?.pluginClaims ?? [])].map((claim) => ({
        ref: claim.ref,
        dependents: [...claim.dependents],
      }));
      for (const ref of machineRefs) {
        const claim = claims.find((candidate) => candidate.ref === ref);
        if (claim === undefined) {
          claims.push({ ref, dependents: root === undefined ? [] : [root] });
          changed = true;
        } else if (root !== undefined && !claim.dependents.includes(root)) {
          claim.dependents.push(root);
          changed = true;
        }
      }
      if (changed)
        machine.setNativeRegistrations(toolId, {
          binary: existing?.binary ?? this.nativeActivationBinary(toolId) ?? toolId,
          marketplaces: registered,
          pluginRefs: existing?.pluginRefs ?? [],
          pluginClaims: claims,
        });
    }
    if (changed) await this.userManifestRepo.save(machine);
  }

  private bestEffort(action: () => void, label: string, warnings: string[]): boolean {
    try {
      action();
      return true;
    } catch (error) {
      if (!(error instanceof NativePluginCliError)) throw error;
      const message = `Native plugin activation — ${label} skipped: ${error.message}`;
      this.logger.warn(message);
      warnings.push(message);
      return false;
    }
  }

  /** Keyed by `hostName`, not `plugin.marketplace` (aidd's own alias): the host resolves the
   * marketplace half of a ref against its own registry, which knows this catalog only by the
   * name it declares itself. */
  private pluginRefsToEnable(
    toolId: ToolId,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    hostNameByAlias: ReadonlyMap<string, string>
  ): string[] {
    const byName = new Map(marketplaces.map((m) => [m.name, m]));
    const refs: string[] = [];
    for (const plugin of manifest.getPlugins(toolId)) {
      const marketplace = plugin.marketplace == null ? undefined : byName.get(plugin.marketplace);
      if (marketplace === undefined) continue;
      const hostName = hostNameByAlias.get(marketplace.name);
      if (hostName === undefined) continue;
      refs.push(`${plugin.name}@${hostName}`);
    }
    return refs;
  }

  private async nativeCatalogProof(
    toolId: ToolId,
    hostName: string,
    projectRoot: string,
    fresh?: NativeMarketplaceRegistration
  ): Promise<NativeCatalogProof> {
    if (!isAiToolId(toolId))
      return { canonical: false, hostReadable: false, sourceStatus: "unproven" };
    const machine = await this.userManifestRepo?.load();
    const registrations = machine?.getNativeRegistrations(toolId);
    const project = await this.manifestRepo.load();
    const localRegistration = pluginEnablementIsMachineGlobal(toolId)
      ? undefined
      : project
          ?.getNativeRegistrations(toolId)
          ?.marketplaces.find((entry) => entry.hostName === hostName);
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
      this.nativeSources.get(toolId),
      projectRoot,
      registration
    );
    const reader = this.hostPluginRegistries.get(toolId);
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
      ...(pluginEnablementIsMachineGlobal(toolId)
        ? []
        : (project?.getNativeRegistrations(toolId)?.pluginRefs ?? [])),
    ]);
    const foreignRef = [...reading.refs.keys()].find(
      (ref) => ref.endsWith(`@${hostName}`) && !claimed.has(ref)
    );
    return { ...base, hostReadable: true, ...(foreignRef === undefined ? {} : { foreignRef }) };
  }

  // Returns the host's own catalog name, never this project's local alias: a catalog this
  // project just built and cannot read back is not registered at all (see the throw below).
  private async registerMarketplace(
    activator: NativePluginActivator,
    toolId: ToolId,
    marketplace: Marketplace,
    projectRoot: string,
    warnings: string[],
    freshClaims: readonly NativeMarketplaceRegistration[]
  ): Promise<{
    hostName: string;
    outcome: "registered" | "refused" | "build-failed";
    claimable: boolean;
    addedThisRun?: boolean;
    provenance?: NativeMarketplaceSource;
  }> {
    const builtDir = await this.buildForTool(toolId, marketplace, projectRoot);
    if (builtDir === null)
      return { hostName: marketplace.name, outcome: "build-failed", claimable: false };
    const requestedIdentity = await readMarketplaceCatalogIdentity(this.fs, toolId, builtDir);
    if (requestedIdentity === undefined) {
      throw new UnreadableBuiltCatalogError(
        marketplaceCatalogProbePath(toolId, builtDir) ?? builtDir
      );
    }
    const hostName = requestedIdentity.name;
    const proof = await this.nativeCatalogProof(
      toolId,
      hostName,
      projectRoot,
      freshClaims.find((claim) => claim.hostName === hostName)
    );
    if (
      proof.sourceStatus === "unproven" ||
      (proof.sourceStatus === "owned" && proof.source === undefined)
    ) {
      if (isAiToolId(toolId) && nativeActivationOf(toolId)?.marketplaceRegistry !== undefined) {
        const existing = await this.hostMarketplaceRegistries.get(toolId)?.read();
        if (existing?.entries?.has(hostName) === true)
          await this.guardAgainstConflict(
            toolId,
            builtDir,
            requestedIdentity,
            marketplace,
            projectRoot,
            warnings
          );
      }
      const message = `${toolId}: catalogue '${hostName}' host source unproven (${proof.sourceReason ?? "unknown"}); registration left untouched.`;
      this.logger.warn(message);
      warnings.push(message);
      return { hostName, outcome: "refused", claimable: false };
    }
    const hostMarketplaceReading =
      isAiToolId(toolId) && nativeActivationOf(toolId)?.marketplaceRegistry !== undefined
        ? await this.hostMarketplaceRegistries.get(toolId)?.read()
        : undefined;
    if (hostMarketplaceReading?.entries?.has(hostName) === true && !proof.canonical) {
      await this.guardAgainstConflict(
        toolId,
        builtDir,
        requestedIdentity,
        marketplace,
        projectRoot,
        warnings
      );
      const message = `${toolId}: catalogue '${hostName}' is already registered on the host without a canonical AIDD claim; same-name collision left untouched.`;
      this.logger.warn(message);
      warnings.push(message);
      return { hostName, outcome: "refused", claimable: false };
    }
    if (
      hostMarketplaceReading !== undefined &&
      hostMarketplaceReading.entries === undefined &&
      hostMarketplaceReading.absent !== true
    ) {
      const message = `${toolId}: catalogue '${hostName}' host registry is unreadable; ownership unproven and registration left untouched.`;
      this.logger.warn(message);
      warnings.push(message);
      return { hostName, outcome: "refused", claimable: false };
    }
    if (!proof.hostReadable || proof.foreignRef !== undefined || proof.unreadable !== undefined) {
      const message =
        proof.foreignRef === undefined
          ? `${toolId}: catalogue '${hostName}' collides with unreadable host plugin registry (${proof.unreadable}); registration left untouched.`
          : `${toolId}: catalogue '${hostName}' carries foreign host ref '${proof.foreignRef}'; registration left untouched.`;
      this.logger.warn(message);
      warnings.push(message);
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
    const decision = await this.guardAgainstConflict(
      toolId,
      builtDir,
      requestedIdentity,
      marketplace,
      projectRoot,
      warnings
    );
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
      const reclaimed = await this.reclaimOrReport(
        toolId,
        activator,
        marketplace,
        hostName,
        builtDir,
        projectRoot,
        error,
        warnings
      );
      if (!reclaimed) return { hostName, outcome: "refused", claimable: false };
      const afterReclaim = await this.proveAddedSource(
        toolId,
        hostName,
        builtDir,
        projectRoot,
        warnings
      );
      return {
        hostName,
        outcome: afterReclaim === undefined ? "refused" : "registered",
        claimable: afterReclaim !== undefined,
        addedThisRun: afterReclaim !== undefined,
        provenance: afterReclaim,
      };
    }
    const afterAdd = await this.proveAddedSource(toolId, hostName, builtDir, projectRoot, warnings);
    return {
      hostName,
      outcome: afterAdd === undefined ? "refused" : "registered",
      claimable: afterAdd !== undefined,
      addedThisRun: afterAdd !== undefined,
      provenance: afterAdd,
    };
  }

  private async proveAddedSource(
    toolId: ToolId,
    hostName: string,
    builtDir: string,
    projectRoot: string,
    warnings: string[]
  ): Promise<NativeMarketplaceSource | undefined> {
    if (!isAiToolId(toolId)) return undefined;
    const reading = await this.nativeSources.get(toolId)?.read(projectRoot);
    const current = reading?.entries?.get(hostName);
    const expected = await this.fs.realpath(builtDir).catch(() => builtDir);
    const sourceMatches =
      current?.source === expected &&
      (current.kind === "registry" ||
        (current.kind === "effective-list" &&
          current.sourceType === "local" &&
          current.root === expected));
    if (sourceMatches) return current;
    const message = `${toolId}: catalogue '${hostName}' add returned but effective host source could not be proven as '${expected}'; no AIDD claim or enablement recorded. Reconcile manually.`;
    this.logger.warn(message);
    warnings.push(message);
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
    toolId: ToolId,
    builtDir: string,
    requestedIdentity: MarketplaceCatalogIdentity,
    marketplace: Marketplace,
    projectRoot: string,
    warnings: string[]
  ): Promise<"proceed" | "skip"> {
    if (!isAiToolId(toolId)) return "proceed";
    if (nativeActivationOf(toolId)?.marketplaceRegistry === undefined) return "proceed";
    const reader = this.hostMarketplaceRegistries.get(toolId);
    if (reader === undefined) return "proceed";
    const requestedSource = await this.fs.realpath(builtDir).catch(() => builtDir);
    const check = await hostMarketplaceSourceConflict(
      this.fs,
      toolId,
      reader,
      requestedSource,
      requestedIdentity,
      {
        userCacheRoot: this.userCacheRoot(),
        projectRoot,
        marketplaceName: marketplace.name,
        target: toolId,
      }
    );
    if (check === undefined) return "proceed";
    if (isDriftFound(check)) return await this.decideOnDrift(toolId, check, warnings);
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
  private async decideOnDrift(
    toolId: ToolId,
    found: MarketplaceSourceDriftFound,
    warnings: string[]
  ): Promise<"proceed" | "skip"> {
    if (found.drift.kind === "unmigrated-foreign-project-source") return "proceed";
    if (found.drift.kind !== "version-behind") return "proceed";
    const { registeredVersion, requestedVersion } = found.drift;
    const message =
      `${toolId}'s marketplace registry (${found.location}) already carries a newer ` +
      `aidd-framework build, ${registeredVersion}, than this run's own ${requestedVersion} — ` +
      "not registering this run's build over it. Run `aidd update` to bring this project's " +
      "CLI to at least the version the host already follows.";
    this.logger.warn(message);
    warnings.push(message);
    return "skip";
  }

  // Reclaim only a dead Claude registration whose current source is recognisably AIDD-owned.
  // `hostName`, never the project's alias, names every host-facing call.
  private async reclaimOrReport(
    toolId: ToolId,
    activator: NativePluginActivator,
    marketplace: Marketplace,
    hostName: string,
    builtDir: string,
    projectRoot: string,
    addError: NativePluginCliError,
    warnings: string[]
  ): Promise<boolean> {
    const proof = await this.nativeCatalogProof(toolId, hostName, projectRoot);
    if (
      !proof.canonical ||
      !proof.hostReadable ||
      proof.sourceStatus !== "owned" ||
      proof.foreignRef !== undefined
    ) {
      const message =
        `Native plugin activation — catalogue '${hostName}' collides with unproven AIDD ownership` +
        `${proof.foreignRef === undefined ? "" : ` and foreign ref '${proof.foreignRef}'`}; host registration left untouched. ${addError.message}`;
      this.logger.warn(message);
      warnings.push(message);
      return false;
    }
    const registeredSource = isAiToolId(toolId)
      ? (await this.hostMarketplaceRegistries.get(toolId)?.read())?.entries?.get(hostName)
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
    const userRoot = this.userCacheRoot();
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
      const message =
        `Native plugin activation — catalogue '${hostName}' host catalogue source is unproven; ` +
        `host registration left untouched. ${addError.message}`;
      this.logger.warn(message);
      warnings.push(message);
      return false;
    }
    if (activator.registrationState(hostName) !== "dead") {
      const message = `Native plugin activation — register marketplace '${hostName}' skipped: ${addError.message}`;
      this.logger.warn(message);
      warnings.push(message);
      return false;
    }
    const reclaimMessage = `Marketplace '${hostName}' was registered to a directory that no longer exists; re-registering it for this project. Plugins installed from it are removed and the ones this CLI manages are put back.`;
    this.logger.warn(reclaimMessage);
    warnings.push(reclaimMessage);
    if (
      !this.bestEffort(
        () => activator.removeMarketplace(hostName, marketplace.scope, { force: true }),
        `unregister stale marketplace '${hostName}'`,
        warnings
      )
    )
      return false;
    return this.bestEffort(
      () => activator.addMarketplace(builtDir, marketplace.scope),
      `register marketplace '${hostName}'`,
      warnings
    );
  }

  private async buildForTool(
    toolId: ToolId,
    marketplace: Marketplace,
    projectRoot: string
  ): Promise<string | null> {
    try {
      const { builtDir } = await this.ensureBuilt.execute({
        projectRoot,
        marketplace,
        target: toolId as FrameworkBuildTarget,
        mode: "marketplace",
      });
      return builtDir;
    } catch (error) {
      this.logger.warn(
        `Native plugin activation — build '${marketplace.name}' for ${toolId} skipped: ${(error as Error).message}`
      );
      return null;
    }
  }

  /**
   * The registration pointing at these trees is written by the tool's own CLI, so nothing here
   * needs the built paths back — but the build has to happen either way, including on a machine
   * where that CLI is absent and activation stops short.
   */
  private async buildAllForTool(
    toolId: ToolId,
    marketplaces: readonly Marketplace[],
    projectRoot: string
  ): Promise<void> {
    for (const m of marketplaces) await this.buildForTool(toolId, m, projectRoot);
  }

  private async syncTool(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[]
  ): Promise<boolean> {
    const marketplaceSettings = resolvePluginsCapability(toolId)?.marketplaceSettings;
    if (marketplaceSettings == null) return false;
    return this.syncToolSettings(toolId, projectRoot, manifest, marketplaces, marketplaceSettings);
  }

  private async syncToolSettings(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    settings: MarketplaceSettings
  ): Promise<boolean> {
    const marketplaceChanged = await this.syncMarketplacesFile(
      toolId,
      projectRoot,
      manifest,
      settings,
      marketplaces
    );
    const pluginsChanged =
      settings.enabledPluginsKey != null
        ? await this.syncEnabledPluginsFile(toolId, projectRoot, manifest, marketplaces, settings)
        : false;
    return marketplaceChanged || pluginsChanged;
  }

  // The marketplaces key names built trees by absolute path, so a profile may send it to a file
  // of its own. That file is written but never hashed: an absolute path recorded in the manifest
  // would read as drift on every other machine.
  private async syncMarketplacesFile(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    settings: MarketplaceSettings,
    marketplaces: readonly Marketplace[]
  ): Promise<boolean> {
    // Building the tree is this CLI's job whoever registers it: a tool that is not installed
    // today may be tomorrow, and the tree is what any registration points at.
    await this.buildAllForTool(toolId, marketplaces, projectRoot);
    return this.evictMarketplacesFromSharedFile(toolId, projectRoot, manifest, settings);
  }

  // The key kept an absolute path in the shared, committed file, wrong for everyone but its
  // author. Take it out and re-hash, so the move reaches projects that already exist.
  private async evictMarketplacesFromSharedFile(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    settings: MarketplaceSettings
  ): Promise<boolean> {
    const sharedPath = resolve(projectRoot, settings.settingsPath);
    const shared = await this.loadSettings(sharedPath);
    if (!(settings.settingsKey in shared)) return false;
    delete shared[settings.settingsKey];
    const content = JSON.stringify(shared, null, 2);
    await this.fs.writeFile(sharedPath, content);
    manifest.updateTrackedFileHash(toolId, settings.settingsPath, this.hasher.hash(content));
    return true;
  }

  private async syncEnabledPluginsFile(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    settings: MarketplaceSettings,
    provenRefs?: readonly string[]
  ): Promise<boolean> {
    const pluginsPath = resolve(projectRoot, settings.settingsPath);
    const json = await this.loadSettings(pluginsPath);
    if (!this.mergeEnabledPlugins(json, settings, toolId, manifest, marketplaces, provenRefs))
      return false;
    const content = JSON.stringify(json, null, 2);
    await this.fs.writeFile(pluginsPath, content);
    manifest.updateTrackedFileHash(toolId, settings.settingsPath, this.hasher.hash(content));
    return true;
  }

  private mergeEnabledPlugins(
    json: Record<string, unknown>,
    settings: MarketplaceSettings,
    toolId: ToolId,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    provenRefs?: readonly string[]
  ): boolean {
    const pluginsKey = settings.enabledPluginsKey;
    if (pluginsKey == null) return false;
    const existing = this.existingRecord(json, pluginsKey);
    const toAdd: Record<string, boolean> = {};
    if (provenRefs !== undefined) {
      for (const ref of provenRefs) if (!(ref in existing)) toAdd[ref] = true;
      if (Object.keys(toAdd).length === 0) return false;
      json[pluginsKey] = { ...existing, ...toAdd };
      return true;
    }
    const marketplaceByName = new Map(marketplaces.map((m) => [m.name, m]));
    for (const plugin of manifest.getPlugins(toolId)) {
      if (plugin.marketplace == null) continue;
      const marketplace = marketplaceByName.get(plugin.marketplace);
      if (marketplace == null) continue;
      const entryKey = settings.toEntryKey({
        name: marketplace.name,
        source: marketplace.source,
      });
      if (entryKey == null) continue;
      const key = `${plugin.name}@${entryKey}`;
      if (!(key in existing)) toAdd[key] = true;
    }
    if (Object.keys(toAdd).length === 0) return false;
    json[pluginsKey] = { ...existing, ...toAdd };
    return true;
  }

  private existingRecord(
    json: Record<string, unknown>,
    settingsKey: string
  ): Record<string, unknown> {
    const raw = json[settingsKey];
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
  }

  // These files are co-owned and the machine-local one is untracked and gitignored, which is
  // exactly the kind of file people hand-edit: a trailing comma must not take the whole sync
  // down with it.
  private async loadSettings(absPath: string): Promise<Record<string, unknown>> {
    if (!(await this.fs.fileExists(absPath))) return {};
    const content = await this.fs.readFile(absPath);
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      this.logger.warn(`Ignoring malformed JSON in ${absPath}; rewriting the keys this CLI owns.`);
      return {};
    }
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  }
}

/** Order included: both sides are built from the same marketplace/plugin iteration order each
 * run, so a difference is real. Keeps a no-op sync from rewriting the manifest. */
function nativeRegistrationsEqual(
  a: NativeRegistrations | undefined,
  b: NativeRegistrations
): boolean {
  if (a === undefined) return false;
  return (
    a.binary === b.binary &&
    marketplaceRegistrationsEqual(a.marketplaces, b.marketplaces) &&
    arraysEqual(a.pluginRefs, b.pluginRefs)
  );
}

function marketplaceRegistrationsEqual(
  a: readonly NativeMarketplaceRegistration[],
  b: readonly NativeMarketplaceRegistration[]
): boolean {
  return (
    a.length === b.length &&
    a.every((value, index) => {
      const other = b[index];
      if (other === undefined || value.alias !== other.alias || value.hostName !== other.hostName)
        return false;
      if (value.provenance === undefined || other.provenance === undefined)
        return value.provenance === other.provenance;
      return sameNativeMarketplaceSource(value.provenance, other.provenance);
    })
  );
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
