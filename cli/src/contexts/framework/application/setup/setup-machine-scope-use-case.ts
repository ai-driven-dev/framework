import type { VersionReader } from "../../../../kernel/ports/version-reader.js";
import { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { SetupFlow } from "../../domain/setup-flow.js";
import type {
  MarketplaceSyncSettings,
  MarketplaceSyncSettingsResult,
} from "../flows/marketplace-sync-settings-use-case.js";
import type { SetupResult } from "../setup-use-case.js";
import type { SetupMarketplaceRegistrationUseCase } from "../shared/setup-marketplace-registration-use-case.js";
import type { InstallGlobalPluginsUseCase } from "./install-global-plugins-use-case.js";
import type { SetupToolsResult } from "./setup-tools-use-case.js";

/**
 * `--scope user`: registers the shared framework source, installs the requested plugins in each
 * tool's user configuration directory and drives native activation machine-wide, writing nothing
 * under `flow.projectRoot` at all — no project tool content, no plugin prompt, no project-context
 * detection.
 *
 * Records no shared-source reference: `references.json` tracks which *project* still claims the
 * shared source, and a `--scope user` run has no project-scope manifest for a later `clean` to read
 * that claim back from, so one recorded here could never be decremented. Absence is the honest
 * state until `clean --scope user` purges the source unconditionally regardless.
 */
export class SetupMachineScopeUseCase {
  constructor(
    private readonly userManifestRepo: ManifestRepository,
    private readonly setupMarketplaceRegistration: SetupMarketplaceRegistrationUseCase,
    private readonly marketplaceSyncSettingsUseCase: MarketplaceSyncSettings,
    private readonly currentVersionProvider: VersionReader,
    private readonly installGlobalPluginsUseCase?: InstallGlobalPluginsUseCase
  ) {}

  async execute(flow: SetupFlow): Promise<SetupResult> {
    const source = await this.setupMarketplaceRegistration.resolveSourceIfNeeded(flow);
    if (this.userManifestRepo.withExclusiveAccess !== undefined) {
      return this.userManifestRepo.withExclusiveAccess(() => this.executeLocked(flow, source));
    }
    return this.executeLocked(flow, source);
  }

  private async executeLocked(
    flow: SetupFlow,
    source: Awaited<ReturnType<SetupMarketplaceRegistrationUseCase["resolveSourceIfNeeded"]>>
  ): Promise<SetupResult> {
    const isNew = await this.initUserManifest();
    await this.setupMarketplaceRegistration.registerIfPresent(flow, source);
    await this.registerUserScopeTools(flow);
    const plugins = await this.installGlobalPlugins(flow);
    const activation: MarketplaceSyncSettingsResult =
      await this.marketplaceSyncSettingsUseCase.execute({
        projectRoot: flow.projectRoot,
        scope: "user",
        manifestRepo: this.userManifestRepo,
        toolIds: flow.aiTools,
        enablePlugins: plugins,
      });
    const install: SetupToolsResult = { results: [] };
    const outcome = { install, activation, context: undefined, globalPlugins: plugins };
    return isNew ? { kind: "initialized", ...outcome } : { kind: "up-to-date", ...outcome };
  }

  /** Copies the chosen plugins' global files and returns their names, which every tool with
   * native activation then enables machine-wide. */
  private async installGlobalPlugins(flow: SetupFlow): Promise<readonly string[]> {
    if (this.installGlobalPluginsUseCase === undefined) return [];
    const manifest = await this.userManifestRepo.load();
    if (manifest === null) return [];
    const { plugins } = await this.installGlobalPluginsUseCase.execute(
      manifest,
      {
        projectRoot: flow.projectRoot,
        toolIds: flow.aiTools,
        mode: flow.pluginMode,
        pluginNames: flow.pluginNames,
      },
      (updated) => this.userManifestRepo.save(updated)
    );
    return plugins;
  }

  private async initUserManifest(): Promise<boolean> {
    const existing = await this.userManifestRepo.load();
    if (existing !== null) return false;
    await this.userManifestRepo.save(Manifest.create());
    return true;
  }

  /** Every requested AI tool gets a manifest entry with no files at all — the honest record of
   * "registered at user scope, nothing installed under any project" — so tool selection has
   * something to iterate. A tool already present is left alone rather than reset. */
  private async registerUserScopeTools(flow: SetupFlow): Promise<void> {
    const manifest = await this.userManifestRepo.load();
    if (manifest === null) return;
    const version = this.currentVersionProvider.get();
    let changed = false;
    for (const toolId of flow.aiTools) {
      if (manifest.hasTool(toolId)) continue;
      manifest.addTool(toolId, version, []);
      changed = true;
    }
    if (changed) await this.userManifestRepo.save(manifest);
  }
}
