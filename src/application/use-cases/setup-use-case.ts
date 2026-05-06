import { isLocalPath } from "../../domain/models/framework.js";
import { type DistributionMode, Manifest } from "../../domain/models/manifest.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../domain/models/marketplace.js";
import { marketplaceCacheDir } from "../../domain/models/paths.js";
import type { AiToolId, IdeToolId } from "../../domain/models/tool-ids.js";
import type { AssetProvider } from "../../domain/ports/asset-provider.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkResolver } from "../../domain/ports/framework-resolver.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { MarketplaceRegistry } from "../../domain/ports/marketplace-registry.js";
import type { PluginCatalogRepository } from "../../domain/ports/plugin-catalog-repository.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import type { VersionReader } from "../../domain/ports/version-reader.js";
import {
  AI_TOOL_IDS,
  getToolConfig,
  IDE_TOOL_IDS,
  isAiTool,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/tools/registry.js";
import { AdoptRequiresVersionError, InputRequiredError } from "../errors.js";
import { AdoptUseCase } from "./adopt/adopt-use-case.js";
import { InitUseCase } from "./init-use-case.js";
import type {
  InstallIdeConfigResult,
  InstallIdeConfigUseCase,
} from "./install/install-ide-config-use-case.js";
import type {
  InstallRuntimeConfigResult,
  InstallRuntimeConfigUseCase,
} from "./install/install-runtime-config-use-case.js";
import type { InstallFrameworkPluginsUseCase } from "./install-framework-plugins-use-case.js";
import { type AdoptSignal, SetupStateService } from "./shared/setup-state-service.js";

export type { AdoptSignal, SetupState } from "./shared/setup-state-service.js";

export type ToolInstallResult = InstallRuntimeConfigResult | InstallIdeConfigResult;

interface SetupOptions {
  projectRoot: string;
  path?: string;
  release?: string;
  repo?: string;
  docsDir?: string;
  toolIds?: ToolId[];
  from?: string;
  interactive?: boolean;
  mode?: DistributionMode;
  switchMode?: boolean;
}

interface InstallSummary {
  results: ToolInstallResult[];
}

export type SetupResult =
  | { kind: "initialized"; docsDir: string; install: InstallSummary; resolvedRef?: string }
  | { kind: "adopted"; version: string; toolCount: number; totalRegistered: number }
  | { kind: "installed"; install: InstallSummary; resolvedRef?: string }
  | { kind: "up-to-date"; hasAdditionalTools: boolean; additionalInstall?: InstallSummary }
  | { kind: "mode-switched"; newMode: DistributionMode };

export class SetupUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly prompter: Prompter,
    private readonly assets: AssetProvider,
    private readonly installRuntimeConfigUseCase: InstallRuntimeConfigUseCase,
    private readonly installIdeConfigUseCase: InstallIdeConfigUseCase,
    private readonly installFrameworkPluginsUseCase: InstallFrameworkPluginsUseCase,
    private readonly currentVersionProvider: VersionReader,
    private readonly marketplaceRegistry?: MarketplaceRegistry,
    private readonly pluginCatalogRepository?: PluginCatalogRepository,
    private readonly frameworkResolver?: FrameworkResolver
  ) {}

  async execute(options: SetupOptions): Promise<SetupResult> {
    if (options.switchMode) return this.handleSwitchMode(options);
    const state = await new SetupStateService(this.manifestRepo, this.fs).detect(
      options.projectRoot
    );
    switch (state.kind) {
      case "needs-init":
        return this.handleInit(options);
      case "needs-adopt":
        return this.handleAdopt(options, state.signals);
      case "needs-install":
      case "needs-update":
        return this.handleInstall(options);
      case "up-to-date":
        return this.handleUpToDate(options);
    }
  }

  private async handleInit(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, repo } = options;
    const { docsDir, explicitDocsDir } = this.resolveDocsDir(options);

    // Step 1 — tools first (logical: user picks tools before deciding marketplace)
    const toolIds = options.toolIds ?? (options.interactive ? await this.promptForTools() : []);

    // Step 2 — plugin marketplace opt-in (default yes)
    const wantsMarketplace = await this.resolveWantsMarketplace(options);

    // Step 3 — if wants marketplace, ask mode + source + version
    const resolvedMode = wantsMarketplace
      ? await this.resolveMode(options)
      : "local";
    const { frameworkPath, frameworkRepo } = wantsMarketplace
      ? await this.resolveFrameworkSource(options, resolvedMode)
      : {};
    const version = wantsMarketplace
      ? await this.resolveVersion(options, frameworkRepo, frameworkPath)
      : this.currentVersionProvider.get();

    const repoForManifest = frameworkRepo ?? repo;
    const initResult = await this.runInit(docsDir, explicitDocsDir, projectRoot, repoForManifest);
    await this.persistMode(resolvedMode);

    const installResults = await this.installToolsFromAssets(
      toolIds.length > 0 ? toolIds : undefined,
      projectRoot,
      version,
      false
    );

    if (wantsMarketplace && resolvedMode === "local" && frameworkPath) {
      await this.installLocalPluginsAt(frameworkPath, version, projectRoot);
    }

    return {
      kind: "initialized",
      docsDir: initResult.docsDir,
      install: { results: installResults },
      resolvedRef: wantsMarketplace ? version : undefined,
    };
  }

  private async resolveWantsMarketplace(options: SetupOptions): Promise<boolean> {
    if (options.mode) return true; // explicit --mode flag implies yes
    if (!options.interactive) return true; // non-interactive defaults to yes
    return this.prompter.confirm("Install framework plugin marketplace?", true);
  }

  private async handleInstall(options: SetupOptions): Promise<SetupResult> {
    const version = await this.resolveVersion(options, undefined, options.path);
    const installResults = await this.installToolsFromAssets(
      options.toolIds,
      options.projectRoot,
      version,
      options.interactive ?? false
    );
    return { kind: "installed", install: { results: installResults }, resolvedRef: version };
  }

  private async handleUpToDate(options: SetupOptions): Promise<SetupResult> {
    const manifest = await this.manifestRepo.load();
    const installedIds = manifest?.getInstalledToolIds() ?? [];
    const missingTools = VALID_TOOL_IDS.filter((id) => !installedIds.includes(id));
    if (missingTools.length === 0) return { kind: "up-to-date", hasAdditionalTools: false };
    if (!options.interactive) return { kind: "up-to-date", hasAdditionalTools: true };

    const wantsMore = await this.prompter.confirm("Install additional tools?");
    if (!wantsMore) return { kind: "up-to-date", hasAdditionalTools: true };

    const version = this.currentVersionProvider.get();
    const installResults = await this.installToolsFromAssets(
      undefined,
      options.projectRoot,
      version,
      true
    );
    return {
      kind: "up-to-date",
      hasAdditionalTools: true,
      additionalInstall: { results: installResults },
    };
  }

  private async handleSwitchMode(options: SetupOptions): Promise<SetupResult> {
    const manifest = await this.manifestRepo.load();
    if (!manifest) throw new InputRequiredError("No manifest found. Run `aidd setup` first.");
    const currentMode = manifest.getMode();
    const newMode = await this.resolveNewMode(options, currentMode);
    manifest.setMode(newMode);
    await this.manifestRepo.save(manifest);
    if (newMode === "local") await this.installPluginsForSwitchToLocal(options);
    return { kind: "mode-switched", newMode };
  }

  private async resolveNewMode(
    options: SetupOptions,
    currentMode: DistributionMode
  ): Promise<DistributionMode> {
    if (options.mode) return options.mode;
    if (!options.interactive) {
      throw new InputRequiredError("--mode is required in non-interactive mode.");
    }
    return this.prompter.select<DistributionMode>(`Switch mode (current: ${currentMode}):`, [
      { name: "local (copy plugins from local framework into project)", value: "local" },
      { name: "remote (fetch plugins from registered marketplace)", value: "remote" },
    ]);
  }

  private async installPluginsForSwitchToLocal(options: SetupOptions): Promise<void> {
    const path = options.path ?? ".";
    if (!isLocalPath(path)) {
      throw new InputRequiredError("Switch to local mode requires --path to a local framework.");
    }
    const version = options.release ?? this.currentVersionProvider.get();
    await this.installFrameworkPluginsUseCase.execute({
      frameworkPath: path,
      projectRoot: options.projectRoot,
      version,
      force: true,
    });
  }

  private async installLocalPluginsAt(
    frameworkPath: string,
    version: string,
    projectRoot: string
  ): Promise<void> {
    if (!(await this.fs.fileExists(frameworkPath))) {
      this.logger.warn(`Local framework path not found: ${frameworkPath}`);
      return;
    }
    await this.installFrameworkPluginsUseCase.execute({ frameworkPath, projectRoot, version });
  }

  private async installToolsFromAssets(
    toolIds: ToolId[] | undefined,
    projectRoot: string,
    version: string,
    interactive: boolean
  ): Promise<ToolInstallResult[]> {
    const ids = toolIds ?? (interactive ? await this.promptForTools() : []);
    if (ids.length === 0) return [];
    const manifest = (await this.manifestRepo.load()) ?? Manifest.create();
    const results: ToolInstallResult[] = [];
    for (const toolId of ids) {
      const config = getToolConfig(toolId);
      if (isAiTool(config)) {
        results.push(
          await this.installRuntimeConfigUseCase.execute({
            toolId: toolId as AiToolId,
            projectRoot,
            manifest,
            force: false,
            version,
          })
        );
      } else {
        results.push(
          await this.installIdeConfigUseCase.execute({
            toolId: toolId as IdeToolId,
            projectRoot,
            manifest,
            force: false,
            version,
          })
        );
      }
    }
    return results;
  }

  private async promptForTools(): Promise<ToolId[]> {
    const aiChecked = await this.prompter.checkbox(
      "Which AI tools do you want to install?",
      AI_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }))
    );
    const ideChecked = await this.prompter.checkbox(
      "Which IDE integrations do you want to install?",
      IDE_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }))
    );
    return [...aiChecked, ...ideChecked] as ToolId[];
  }

  private async resolveMode(options: SetupOptions): Promise<DistributionMode> {
    if (options.mode) return options.mode;
    if (!options.interactive) return "local";
    return this.prompter.select<DistributionMode>("Distribution mode:", [
      { name: "local (copy plugins from local framework into project)", value: "local" },
      { name: "remote (fetch plugins from registered marketplace)", value: "remote" },
    ]);
  }

  private async persistMode(mode: DistributionMode): Promise<void> {
    if (mode === "local") return;
    const manifest = await this.manifestRepo.load();
    if (!manifest) return;
    manifest.setMode(mode);
    await this.manifestRepo.save(manifest);
  }

  private async runInit(
    docsDir: string,
    explicitDocsDir: string,
    projectRoot: string,
    repo: string | undefined
  ): Promise<{ docsDir: string }> {
    return new InitUseCase(this.fs, this.manifestRepo).execute({
      docsDir,
      explicitDocsDir,
      projectRoot,
      force: false,
      repo,
    });
  }

  private resolveDocsDir(options: SetupOptions): { docsDir: string; explicitDocsDir: string } {
    if (options.docsDir !== undefined) {
      Manifest.validateDocsDir(options.docsDir);
      return { docsDir: options.docsDir, explicitDocsDir: options.docsDir };
    }
    return { docsDir: Manifest.DEFAULT_DOCS_DIR, explicitDocsDir: "" };
  }

  private async resolveFrameworkSource(
    options: SetupOptions,
    mode: DistributionMode
  ): Promise<{ frameworkPath?: string; frameworkRepo?: string }> {
    if (options.path !== undefined) {
      if (!options.path) return {};
      if (isLocalPath(options.path)) return { frameworkPath: options.path };
      return { frameworkRepo: options.path };
    }
    if (mode === "local") return this.resolveLocalSource(options);
    return this.resolveRemoteSource(options);
  }

  private async resolveLocalSource(options: SetupOptions): Promise<{ frameworkPath?: string }> {
    const pathInput = options.interactive
      ? await this.prompter.input("Local framework path:", ".")
      : ".";
    if (!pathInput) return {};
    return { frameworkPath: pathInput };
  }

  private async resolveRemoteSource(options: SetupOptions): Promise<{ frameworkRepo?: string }> {
    const existingManifest = await this.manifestRepo.load();
    const repoDefault = existingManifest?.repo ?? Manifest.DEFAULT_REPO;
    const repoInput = options.interactive
      ? await this.prompter.input("Marketplace repository (owner/repo):", repoDefault)
      : repoDefault;
    if (!repoInput) return {};
    return { frameworkRepo: repoInput };
  }

  private async resolveVersion(
    options: SetupOptions,
    frameworkRepo: string | undefined,
    frameworkPath: string | undefined
  ): Promise<string> {
    if (options.release) return options.release;
    const versionDefault = await this.discoverVersionDefault(
      frameworkRepo,
      frameworkPath,
      options.projectRoot
    );
    if (!options.interactive) return versionDefault ?? this.currentVersionProvider.get();
    const label = versionDefault
      ? `Marketplace catalog version (latest: ${versionDefault}):`
      : "Marketplace catalog version:";
    const input = await this.prompter.input(label, versionDefault ?? "");
    return input || versionDefault || this.currentVersionProvider.get();
  }

  private async discoverVersionDefault(
    frameworkRepo: string | undefined,
    frameworkPath: string | undefined,
    projectRoot: string
  ): Promise<string | undefined> {
    if (frameworkPath && isLocalPath(frameworkPath)) {
      return this.readLocalCatalogVersion(frameworkPath);
    }
    const remoteVersion = await this.fetchLatestRemoteVersion(frameworkRepo);
    if (remoteVersion) return remoteVersion;
    return this.fetchCatalogVersion(projectRoot);
  }

  private async readLocalCatalogVersion(frameworkPath: string): Promise<string | undefined> {
    if (!this.pluginCatalogRepository) return undefined;
    const catalog = await this.pluginCatalogRepository.load(frameworkPath).catch(() => null);
    return catalog?.version;
  }

  private async fetchLatestRemoteVersion(
    frameworkRepo: string | undefined
  ): Promise<string | undefined> {
    if (!this.frameworkResolver) return undefined;
    return this.frameworkResolver.fetchLatestVersion(frameworkRepo).catch(() => undefined);
  }

  private async fetchCatalogVersion(projectRoot: string): Promise<string | undefined> {
    if (!this.marketplaceRegistry || !this.pluginCatalogRepository) return undefined;
    const marketplaces = await this.marketplaceRegistry.list(projectRoot).catch(() => []);
    const framework = marketplaces.find((m) => m.name === FRAMEWORK_MARKETPLACE_NAME);
    if (!framework) return undefined;
    const cacheDir = marketplaceCacheDir(projectRoot, framework.name);
    const catalog = await this.pluginCatalogRepository.load(cacheDir).catch(() => null);
    return catalog?.version;
  }

  private async handleAdopt(options: SetupOptions, signals: AdoptSignal[]): Promise<SetupResult> {
    const { projectRoot, repo } = options;
    this.validateAdoptNonInteractive(options, repo, signals);
    const selected = await this.resolveAdoptTools(options);
    const fromInput = await this.resolveAdoptFrom(options, repo, signals);
    const adoptResult = await new AdoptUseCase(
      this.fs,
      this.manifestRepo,
      this.logger,
      this.assets
    ).execute({
      toolIds: selected as ToolId[],
      docsDir: Manifest.DEFAULT_DOCS_DIR,
      projectRoot,
      version: fromInput,
    });
    return {
      kind: "adopted",
      version: fromInput,
      toolCount: adoptResult.tools.length,
      totalRegistered: adoptResult.totalRegistered,
    };
  }

  private validateAdoptNonInteractive(
    options: SetupOptions,
    repo: string | undefined,
    signals: AdoptSignal[]
  ): void {
    if (options.interactive) return;
    if (!options.toolIds || options.toolIds.length === 0) {
      throw new InputRequiredError("--ai or --ide is required for adopt in non-interactive mode.");
    }
    if (options.from === undefined) {
      throw new AdoptRequiresVersionError(repo, this.formatSignalDiagnostic(signals));
    }
  }

  private formatSignalDiagnostic(signals: AdoptSignal[]): string {
    if (signals.length === 0) return "";
    const lines = ["Detected existing AIDD files:"];
    for (const signal of signals) lines.push(`  • ${signal.file} — run: cat ${signal.file}`);
    return lines.join("\n");
  }

  private async resolveAdoptTools(options: SetupOptions): Promise<ToolId[]> {
    if (options.toolIds !== undefined && options.toolIds.length > 0) return options.toolIds;
    const aiChecked = await this.prompter.checkbox(
      "Which AI tools do you want to adopt?",
      AI_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }))
    );
    const ideChecked = await this.prompter.checkbox(
      "Which IDE integrations do you want to adopt?",
      IDE_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }))
    );
    const checkedIds = [...aiChecked, ...ideChecked];
    if (checkedIds.length === 0) throw new InputRequiredError("No tools selected.");
    return checkedIds as ToolId[];
  }

  private async resolveAdoptFrom(
    options: SetupOptions,
    repo: string | undefined,
    signals: AdoptSignal[]
  ): Promise<string> {
    if (options.from !== undefined) {
      if (!options.from)
        throw new AdoptRequiresVersionError(repo, this.formatSignalDiagnostic(signals));
      return options.from;
    }
    const fromInput = await this.prompter.input(
      "Which version of the framework do you already have installed? (e.g. v1.2.3):",
      ""
    );
    if (!fromInput) throw new AdoptRequiresVersionError(repo, this.formatSignalDiagnostic(signals));
    return fromInput;
  }
}
