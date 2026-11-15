import { join, resolve } from "node:path";
import { BUILT_CACHE_SUBDIR } from "../../../../shared/domain/paths.js";
import type { MarketplaceScope } from "../../../../shared/domain/scope.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { VersionReader } from "../../../../shared/ports/version-reader.js";
import type { RegisterFrameworkMarketplace } from "../../../distribution/application/register-framework-marketplace.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../distribution/contract/marketplace.js";
import type { Marketplace } from "../../../distribution/domain/marketplace.js";
import type { MarketplaceRegistry } from "../../../distribution/ports/marketplace-registry.js";
import { sameNativeMarketplaceSource } from "../../../host-registration/application/native-marketplace-source-proof.js";
import {
  enablementIsMachineGlobal,
  type HostRegistrationOutcome,
  type RegisteredMarketplace,
  type RegisterPluginWithHost,
  type RegistrationClaims,
} from "../../../host-registration/application/register-plugin-with-host.js";
import type { BuiltMarketplaceEnsurer } from "../../../installation/application/shared/ensure-built-marketplace.js";
import type { NativeRegistrations } from "../../../installation/domain/manifest/native-registrations.js";
import { Manifest } from "../../../installation/domain/manifest.js";
import type { ManifestRepository } from "../../../installation/ports/manifest-repository.js";
import {
  frameworkSourceIsShared,
  resolveProjectRootForReferences,
  toleratingUnreadableSourceReferences,
} from "../../../machine-claims/application/shared-source-reference-support.js";
import type { UserSourceReferences } from "../../../machine-claims/ports/user-source-references.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import type { FrameworkBuildTarget } from "../../../translate/domain/build-target.js";
import { resolveCacheCandidate } from "../shared/purge-declared-cache.js";

export interface MarketplaceSyncSettingsOptions {
  projectRoot: string;
  /** The profiles of the tools this run may ask, handed per call. */
  tools: ToolCatalog;
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
  /**
   * Framework plugins a tool with native activation also enables at this run's scope, on top
   * of the ones its manifest records — what `setup --global --plugins` asks for, since a
   * machine-scope install records no plugin a host loads by itself.
   */
  enablePlugins?: readonly string[];
}

type ActivationOutcome = HostRegistrationOutcome;

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
    private readonly registerPluginWithHost: RegisterPluginWithHost,
    private readonly ensureBuilt: BuiltMarketplaceEnsurer,
    /** Root of a user-scope marketplace's built tree, mirroring `EnsureBuiltMarketplace`'s
     * own `userCacheRoot` — the version a drift is decided against comes from `builtDir` itself,
     * already built before this runs, never from a path recomputed without one. */
    private readonly userCacheRoot: () => string = () => "",
    /** Re-registers the shared machine-scope source when this run finds no marketplace at all.
     * Absent keeps the silent no-op instead of guessing what to register. */
    private readonly marketplaceRegisterFrameworkUseCase?: Pick<
      RegisterFrameworkMarketplace,
      "execute"
    >,
    private readonly userSourceReferences?: UserSourceReferences,
    private readonly currentVersionProvider?: VersionReader,
    private readonly userManifestRepo?: ManifestRepository & Lock
  ) {}

  async execute(options: MarketplaceSyncSettingsOptions): Promise<MarketplaceSyncSettingsResult> {
    if ((options.scope ?? "project") === "project" && this.userManifestRepo !== undefined) {
      return this.userManifestRepo.withExclusiveAccess(() => this.executeLocked(options));
    }
    return this.executeLocked(options);
  }

  private async executeLocked(
    options: MarketplaceSyncSettingsOptions
  ): Promise<MarketplaceSyncSettingsResult> {
    const { projectRoot, tools } = options;
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
        if (tools.aiProfileIfAny(toolId)?.marketplaceRegistration()?.requiresNativeProof())
          continue;
        if (await this.syncTool(tools, toolId, projectRoot, manifest, marketplaces))
          anyToolUpdated = true;
      }
    }
    if (anyToolUpdated) await manifestRepo.save(manifest);
    const activation = await this.activateNativeTools(
      tools,
      projectRoot,
      manifest,
      marketplaces,
      toolIds,
      scope,
      options.enablePlugins ?? []
    );
    let declarativeChanged = false;
    if (scope === "project") {
      for (const [toolId, outcome] of activation.outcomes) {
        const settings = tools.aiProfileIfAny(toolId)?.marketplaceRegistration();
        if (settings?.requiresNativeProof() !== true) continue;
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
    const wroteHashes = await this.recordWhatActivationWrote(tools, projectRoot, manifest, [
      ...activation.outcomes.keys(),
    ]);
    const wroteRegistrations = this.recordNativeRegistrations(
      tools,
      manifest,
      activation.outcomes,
      options.marketplaceNames !== undefined
    );
    if (wroteHashes || wroteRegistrations) await manifestRepo.save(manifest);
    await this.recordMachinePluginClaims(
      tools,
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
    tools: ToolCatalog,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    toolIds: readonly ToolId[],
    scope: MarketplaceScope,
    enablePlugins: readonly string[]
  ): Promise<ActivationRun> {
    const outcomes = new Map<ToolId, ActivationOutcome>();
    const binaryMissing: { toolId: ToolId; binary: string }[] = [];
    const warnings: string[] = [];
    const errors: { scope: string; message: string }[] = [];
    for (const toolId of toolIds) {
      try {
        const result = await this.registerPluginWithHost.execute({
          tools,
          toolId,
          projectRoot,
          scope,
          marketplaces,
          claims: this.claimsOf(toolId, manifest),
          build: (marketplace) => this.buildForTool(toolId, marketplace, projectRoot),
          refsToEnable: (hostNameByAlias) =>
            this.refsToEnableOn(
              toolId,
              manifest,
              marketplaces,
              hostNameByAlias,
              scope,
              enablePlugins
            ),
          userCacheRoot: this.userCacheRoot,
          sink: { logger: this.logger, warnings },
        });
        if (result.status === "binary-missing") {
          this.logger.warn(
            `${result.binary} CLI not found on PATH — skipping native plugin activation.${
              enablePlugins.length > 0 ? " Rerun `aidd setup --global` once it is installed." : ""
            }`
          );
          binaryMissing.push({ toolId, binary: result.binary });
        } else if (result.status === "activated") outcomes.set(toolId, result.outcome);
      } catch (error) {
        errors.push({ scope: toolId, message: (error as Error).message });
      }
    }
    return { outcomes, binaryMissing, warnings, errors };
  }

  private claimsOf(toolId: ToolId, manifest: Manifest): RegistrationClaims {
    return {
      recorded: manifest.getNativeRegistrations(toolId),
      machine: async () => (await this.userManifestRepo?.load())?.getNativeRegistrations(toolId),
      machineKept: this.userManifestRepo !== undefined,
      persistedProject: async () =>
        (await this.manifestRepo.load())?.getNativeRegistrations(toolId),
    };
  }

  /** The refs this run enables: the manifest's own, plus the framework plugins a caller asked
   * for, which only the framework marketplace can resolve. */
  private refsToEnableOn(
    toolId: ToolId,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    hostNameByAlias: ReadonlyMap<string, string>,
    scope: MarketplaceScope,
    enablePlugins: readonly string[]
  ): string[] {
    const frameworkHost = hostNameByAlias.get(FRAMEWORK_MARKETPLACE_NAME);
    const requested =
      frameworkHost === undefined ? [] : enablePlugins.map((name) => `${name}@${frameworkHost}`);
    return [
      ...new Set([
        ...this.pluginRefsToEnable(toolId, manifest, marketplaces, hostNameByAlias, scope),
        ...requested,
      ]),
    ];
  }

  /** Only for a tool this run actually activated. A `narrowed` run's `outcome` carries only the
   * marketplace it touched, so every other entry must survive the merge; an unnarrowed run replaces
   * outright, since anything absent from `outcome` is a dead registration nothing else ever drops.
   * `pluginRefs` merge by the `@<hostName>` suffix only for a hostName no retained marketplace
   * still owns — two local aliases may resolve to one hostName. */
  private recordNativeRegistrations(
    tools: ToolCatalog,
    manifest: Manifest,
    activated: ReadonlyMap<ToolId, ActivationOutcome>,
    narrowed: boolean
  ): boolean {
    let changed = false;
    for (const [toolId, outcome] of activated) {
      const binary = this.nativeActivationBinary(tools, toolId);
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
    tools: ToolCatalog,
    projectRoot: string,
    manifest: Manifest,
    activated: readonly ToolId[]
  ): Promise<boolean> {
    let changed = false;
    for (const toolId of activated) {
      const settingsPath = this.marketplaceSettingsOf(tools, toolId)?.sharedSettingsFile();
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

  private marketplaceSettingsOf(
    tools: ToolCatalog,
    toolId: ToolId
  ): MarketplaceRegistrationAnswers | undefined {
    return tools.aiProfileIfAny(toolId)?.marketplaceRegistration() ?? undefined;
  }

  private nativeActivationBinary(tools: ToolCatalog, toolId: ToolId): string | undefined {
    return tools.aiProfileIfAny(toolId)?.nativeActivation()?.hostBinary();
  }

  private async recordMachinePluginClaims(
    tools: ToolCatalog,
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
        scope === "user" || enablementIsMachineGlobal(tools, toolId) ? outcome.pluginRefs : [];
      const machineMarketplaces = outcome.catalogClaims.filter((registration) =>
        marketplaces.some(
          (marketplace) =>
            marketplace.name === registration.alias &&
            (marketplace.scope === "user" || enablementIsMachineGlobal(tools, toolId))
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
          binary: existing?.binary ?? this.nativeActivationBinary(tools, toolId) ?? toolId,
          marketplaces: registered,
          pluginRefs: existing?.pluginRefs ?? [],
          pluginClaims: claims,
        });
    }
    if (changed) await this.userManifestRepo.save(machine);
  }

  /** Keyed by `hostName`, not `plugin.marketplace` (aidd's own alias): the host resolves the
   * marketplace half of a ref against its own registry, which knows this catalog only by the
   * name it declares itself. */
  private pluginRefsToEnable(
    toolId: ToolId,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    hostNameByAlias: ReadonlyMap<string, string>,
    scope: MarketplaceScope
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
    // Native-only global installs record successful activations, not copied plugin files.
    // Claims also recover a selection an older sync dropped from its projection.
    if (scope === "user") {
      const native = manifest.getNativeRegistrations(toolId);
      const provenHosts = [...hostNameByAlias.values()];
      for (const ref of [
        ...(native?.pluginRefs ?? []),
        ...(native?.pluginClaims ?? []).map((claim) => claim.ref),
      ]) {
        if (provenHosts.some((hostName) => ref.endsWith(`@${hostName}`))) refs.push(ref);
      }
    }
    return refs;
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
    tools: ToolCatalog,
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[]
  ): Promise<boolean> {
    const marketplaceSettings = tools.aiProfileIfAny(toolId)?.marketplaceRegistration();
    if (marketplaceSettings == null) return false;
    return this.syncToolSettings(toolId, projectRoot, manifest, marketplaces, marketplaceSettings);
  }

  private async syncToolSettings(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    settings: MarketplaceRegistrationAnswers
  ): Promise<boolean> {
    const marketplaceChanged = await this.syncMarketplacesFile(
      toolId,
      projectRoot,
      manifest,
      settings,
      marketplaces
    );
    const pluginsChanged = await this.syncEnabledPluginsFile(
      toolId,
      projectRoot,
      manifest,
      marketplaces,
      settings
    );
    return marketplaceChanged || pluginsChanged;
  }

  // The marketplaces key names built trees by absolute path, so a profile may send it to a file
  // of its own. That file is written but never hashed: an absolute path recorded in the manifest
  // would read as drift on every other machine.
  private async syncMarketplacesFile(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    settings: MarketplaceRegistrationAnswers,
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
    settings: MarketplaceRegistrationAnswers
  ): Promise<boolean> {
    const sharedPath = resolve(projectRoot, settings.sharedSettingsFile());
    const shared = await this.loadSettings(sharedPath);
    const without = settings.withoutMarketplaces(shared);
    if (without === null) return false;
    const content = JSON.stringify(without, null, 2);
    await this.fs.writeFile(sharedPath, content);
    manifest.updateTrackedFileHash(
      toolId,
      settings.sharedSettingsFile(),
      this.hasher.hash(content)
    );
    return true;
  }

  private async syncEnabledPluginsFile(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    settings: MarketplaceRegistrationAnswers,
    provenRefs?: readonly string[]
  ): Promise<boolean> {
    const pluginsPath = resolve(projectRoot, settings.sharedSettingsFile());
    const json = await this.loadSettings(pluginsPath);
    const enabled = settings.withEnabledPlugins(
      json,
      this.refsToEnable(settings, toolId, manifest, marketplaces, provenRefs)
    );
    if (enabled === null) return false;
    const content = JSON.stringify(enabled, null, 2);
    await this.fs.writeFile(pluginsPath, content);
    manifest.updateTrackedFileHash(
      toolId,
      settings.sharedSettingsFile(),
      this.hasher.hash(content)
    );
    return true;
  }

  private refsToEnable(
    settings: MarketplaceRegistrationAnswers,
    toolId: ToolId,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    provenRefs?: readonly string[]
  ): readonly string[] {
    if (provenRefs !== undefined) return provenRefs;
    const refs: string[] = [];
    const marketplaceByName = new Map(marketplaces.map((m) => [m.name, m]));
    for (const plugin of manifest.getPlugins(toolId)) {
      if (plugin.marketplace == null) continue;
      const marketplace = marketplaceByName.get(plugin.marketplace);
      if (marketplace == null) continue;
      const entryKey = settings.entryKeyFor({
        name: marketplace.name,
        source: marketplace.source,
      });
      if (entryKey == null) continue;
      refs.push(`${plugin.name}@${entryKey}`);
    }
    return refs;
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
  a: readonly RegisteredMarketplace[],
  b: readonly RegisteredMarketplace[]
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
