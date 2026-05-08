import type { MarketplaceSourceMode } from "../../domain/models/marketplace-source-mode.js";
import { DOCS_DIR } from "../../domain/models/paths.js";
import type { PluginSource } from "../../domain/models/plugin-source.js";
import type { SetupFlow } from "../../domain/models/setup-flow.js";
import type { FileReader } from "../../domain/ports/file-reader.js";
import type { FileWriter } from "../../domain/ports/file-writer.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { VersionReader } from "../../domain/ports/version-reader.js";
import { InitUseCase } from "./init-use-case.js";
import type { MarketplaceRefreshUseCase } from "./marketplace/marketplace-refresh-use-case.js";
import type {
  MarketplaceRegisterFrameworkOptions,
  MarketplaceRegisterFrameworkUseCase,
} from "./marketplace/marketplace-register-framework-use-case.js";
import type { MarketplaceSyncSettingsUseCase } from "./marketplace/marketplace-sync-settings-use-case.js";
import type { SetupMarketplaceSourceUseCase } from "./setup/setup-marketplace-source-use-case.js";
import type { SetupPluginsPromptUseCase } from "./setup/setup-plugins-prompt-use-case.js";
import type { SetupToolsResult, SetupToolsUseCase } from "./setup/setup-tools-use-case.js";

export type { ToolInstallResult } from "./setup/setup-tools-use-case.js";
export type { SetupToolsResult };

export type SetupResult =
  | { kind: "initialized"; docsDir: string; install: SetupToolsResult }
  | { kind: "up-to-date"; install: SetupToolsResult };

export class SetupUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly setupMarketplaceSourceUseCase: SetupMarketplaceSourceUseCase,
    private readonly marketplaceRegisterFrameworkUseCase: MarketplaceRegisterFrameworkUseCase,
    private readonly marketplaceRefreshUseCase: MarketplaceRefreshUseCase,
    private readonly marketplaceSyncSettingsUseCase: MarketplaceSyncSettingsUseCase,
    private readonly setupToolsUseCase: SetupToolsUseCase,
    private readonly setupPluginsPromptUseCase: SetupPluginsPromptUseCase,
    private readonly currentVersionProvider: VersionReader
  ) {}

  async execute(flow: SetupFlow): Promise<SetupResult> {
    const source = await this.resolveSource(flow);
    const { docsDir, isNew } = await this.initManifest(flow);
    await this.registerMarketplace(flow, source);
    await this.refreshCatalog(flow);
    const install = await this.installTools(flow);
    await this.promptPlugins(flow);
    return this.buildResult(isNew, docsDir, install);
  }

  private async resolveSource(flow: SetupFlow): Promise<MarketplaceSourceMode> {
    return this.setupMarketplaceSourceUseCase.execute({
      projectRoot: flow.projectRoot,
      sourceFromCli: flow.source,
      interactive: flow.interactive,
    });
  }

  private async initManifest(flow: SetupFlow): Promise<{ docsDir: string; isNew: boolean }> {
    const existing = await this.manifestRepo.load();
    if (existing !== null) return { docsDir: DOCS_DIR, isNew: false };
    const result = await new InitUseCase(this.fs, this.manifestRepo).execute({
      projectRoot: flow.projectRoot,
      force: false,
    });
    return { docsDir: result.docsDir, isNew: true };
  }

  private async registerMarketplace(flow: SetupFlow, source: MarketplaceSourceMode): Promise<void> {
    const opts = this.buildRegisterOptions(flow, source);
    await this.marketplaceRegisterFrameworkUseCase.execute(opts);
  }

  private buildRegisterOptions(
    flow: SetupFlow,
    source: MarketplaceSourceMode
  ): MarketplaceRegisterFrameworkOptions {
    const pluginSource = this.toPluginSource(source);
    return { projectRoot: flow.projectRoot, pluginSource };
  }

  private toPluginSource(source: MarketplaceSourceMode): PluginSource {
    if (source.kind === "local") return { kind: "local", path: source.path };
    return { kind: "github", repo: source.repo };
  }

  private async refreshCatalog(flow: SetupFlow): Promise<void> {
    if (process.env.AIDD_SKIP_MARKETPLACE_REFRESH === "1") return;
    await this.marketplaceRefreshUseCase.execute({ projectRoot: flow.projectRoot });
    await this.marketplaceSyncSettingsUseCase.execute({ projectRoot: flow.projectRoot });
  }

  private async installTools(flow: SetupFlow): Promise<SetupToolsResult> {
    const version = this.currentVersionProvider.get();
    return this.setupToolsUseCase.execute({
      projectRoot: flow.projectRoot,
      aiTools: flow.aiTools,
      ideTools: flow.ideTools,
      force: flow.force,
      version,
    });
  }

  private async promptPlugins(flow: SetupFlow): Promise<void> {
    await this.setupPluginsPromptUseCase.execute({
      projectRoot: flow.projectRoot,
      mode: flow.pluginMode,
      pluginNames: [...flow.pluginNames],
      interactive: flow.interactive,
    });
  }

  private buildResult(isNew: boolean, docsDir: string, install: SetupToolsResult): SetupResult {
    if (isNew) return { kind: "initialized", docsDir, install };
    return { kind: "up-to-date", install };
  }
}
