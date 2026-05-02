import { isLocalPath } from "../../domain/models/framework.js";
import { type DistributionMode, Manifest } from "../../domain/models/manifest.js";
import type { AssetProvider } from "../../domain/ports/asset-provider.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkResolver } from "../../domain/ports/framework-resolver.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Platform } from "../../domain/ports/platform.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import type { TokenProvider } from "../../domain/ports/token-provider.js";
import {
  AI_TOOL_IDS,
  IDE_TOOL_IDS,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/tools/registry.js";
import { AdoptRequiresVersionError, InputRequiredError } from "../errors.js";
import { AdoptUseCase } from "./adopt/adopt-use-case.js";
import { InitUseCase } from "./init-use-case.js";
import type { InstallToolResult } from "./install/install-use-case.js";
import { InstallUseCase } from "./install/install-use-case.js";
import type { InstallFrameworkPluginsUseCase } from "./install-framework-plugins-use-case.js";
import { ResolveFrameworkUseCase } from "./resolve-framework-use-case.js";
import { type AdoptSignal, SetupStateService } from "./shared/setup-state-service.js";
import { UpdateUseCase } from "./update/update-use-case.js";

export type { AdoptSignal, SetupState } from "./shared/setup-state-service.js";

interface SetupOptions {
  projectRoot: string;
  path?: string;
  release?: string;
  repo?: string;
  // Non-interactive overrides: when provided, matching prompts are skipped
  docsDir?: string;
  toolIds?: ToolId[];
  from?: string;
  interactive?: boolean;
  mode?: DistributionMode;
  switchMode?: boolean;
}

interface InstallSummary {
  results: InstallToolResult[];
}

export type SetupResult = { resolvedFrameworkPath?: string } & (
  | { kind: "initialized"; docsDir: string; install: InstallSummary }
  | {
      kind: "adopted";
      version: string;
      toolCount: number;
      totalRegistered: number;
    }
  | { kind: "installed"; install: InstallSummary }
  | { kind: "update-cancelled" }
  | {
      kind: "updated";
      version: string;
      totalWritten: number;
      totalDeleted: number;
      toolCount: number;
      pluginsUpdated: number;
      pluginsDeleted: number;
      additionalInstall?: InstallSummary;
    }
  | { kind: "up-to-date"; hasAdditionalTools: boolean; additionalInstall?: InstallSummary }
  | { kind: "mode-switched"; newMode: DistributionMode }
);

export class SetupUseCase {
  private readonly frameworkResolver: ResolveFrameworkUseCase;

  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly platform: Platform,
    private readonly prompter: Prompter,
    private readonly resolver: FrameworkResolver,
    private readonly installFrameworkPluginsUseCase: InstallFrameworkPluginsUseCase,
    private readonly assets: AssetProvider,
    authReader?: TokenProvider
  ) {
    this.frameworkResolver = new ResolveFrameworkUseCase(resolver, logger, authReader);
  }

  async execute(options: SetupOptions): Promise<SetupResult> {
    if (options.switchMode) return this.handleSwitchMode(options);
    const state = await new SetupStateService(this.manifestRepo, this.fs, this.resolver).detect(
      options.projectRoot
    );
    switch (state.kind) {
      case "needs-init":
        return this.handleInit(options);
      case "needs-adopt":
        return this.handleAdopt(options, state.signals);
      case "needs-install":
        return this.handleInstall(options);
      case "needs-update":
        return this.handleUpdate(options);
      case "up-to-date":
        return this.handleUpToDate(options);
    }
  }

  private async handleInit(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, repo } = options;

    const { docsDir, explicitDocsDir } = await this.resolveDocsDir(options);
    const resolvedMode = await this.resolveMode(options);
    const { frameworkPath, frameworkRepo } = await this.resolveFrameworkSource(
      options,
      resolvedMode
    );
    const resolvedRelease = await this.resolveRelease(frameworkRepo, frameworkPath, options);
    const resolved = await this.frameworkResolver.execute({
      path: frameworkPath,
      release: resolvedRelease,
    });
    const repoForManifest = frameworkRepo ?? repo;

    const initResult = await this.runInit(docsDir, explicitDocsDir, projectRoot, repoForManifest);

    await this.persistMode(resolvedMode);

    const installResults = await this.runInstall(
      resolved.path,
      resolved.version,
      projectRoot,
      repoForManifest,
      options.toolIds,
      options.interactive
    );

    if (resolvedMode === "local") {
      await this.installLocalPlugins(resolved.path, resolved.version, projectRoot);
    }

    return {
      kind: "initialized",
      docsDir: initResult.docsDir,
      install: { results: installResults },
      resolvedFrameworkPath: this.localPathOf(frameworkPath, resolved.path),
    };
  }

  private async installLocalPlugins(
    frameworkPath: string,
    version: string,
    projectRoot: string
  ): Promise<void> {
    await this.installFrameworkPluginsUseCase.execute({ frameworkPath, projectRoot, version });
  }

  private async resolveMode(options: SetupOptions): Promise<DistributionMode> {
    if (options.mode) return options.mode;
    if (!options.interactive) return "local";
    return this.prompter.select<DistributionMode>("Distribution mode:", [
      { name: "local (copy plugins to project)", value: "local" },
      { name: "remote (GitHub marketplace at release tag)", value: "remote" },
    ]);
  }

  private async persistMode(mode: DistributionMode): Promise<void> {
    if (mode === "local") return;
    const manifest = await this.manifestRepo.load();
    if (!manifest) return;
    manifest.setMode(mode);
    await this.manifestRepo.save(manifest);
  }

  private async handleSwitchMode(options: SetupOptions): Promise<SetupResult> {
    const manifest = await this.manifestRepo.load();
    if (!manifest) throw new InputRequiredError("No manifest found. Run `aidd setup` first.");
    const currentMode = manifest.getMode();
    const newMode = await this.resolveNewMode(options, currentMode);
    manifest.setMode(newMode);
    await this.manifestRepo.save(manifest);
    if (newMode === "local") {
      await this.installPluginsForSwitchToLocal(options, manifest);
    }
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
      { name: "local (copy plugins to project)", value: "local" },
      { name: "remote (GitHub marketplace at release tag)", value: "remote" },
    ]);
  }

  private async installPluginsForSwitchToLocal(
    options: SetupOptions,
    manifest: Manifest
  ): Promise<void> {
    const { path: frameworkPath, version } = await this.frameworkResolver.execute({
      path: options.path,
      release: options.release,
      repo: manifest.repo,
    });
    await this.installFrameworkPluginsUseCase.execute({
      frameworkPath,
      projectRoot: options.projectRoot,
      version,
      force: true,
    });
  }

  private localPathOf(sourcePath: string | undefined, resolvedPath: string): string | undefined {
    return sourcePath && isLocalPath(sourcePath) ? resolvedPath : undefined;
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

  private async resolveDocsDir(
    options: SetupOptions
  ): Promise<{ docsDir: string; explicitDocsDir: string }> {
    if (options.docsDir !== undefined) {
      Manifest.validateDocsDir(options.docsDir);
      return { docsDir: options.docsDir, explicitDocsDir: options.docsDir };
    }
    if (!options.interactive) {
      return { docsDir: Manifest.DEFAULT_DOCS_DIR, explicitDocsDir: "" };
    }
    const docsDirInput = await this.prompter.input(
      "Documentation directory name:",
      Manifest.DEFAULT_DOCS_DIR
    );
    const docsDir = docsDirInput || Manifest.DEFAULT_DOCS_DIR;
    Manifest.validateDocsDir(docsDir);
    return { docsDir, explicitDocsDir: docsDirInput };
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
    const existingManifest = await this.manifestRepo.load();
    const repoDefault = existingManifest?.repo ?? this.resolver.getDefaultRepo() ?? "";
    const sourceDefault = mode === "local" ? "." : repoDefault;
    const sourceInput = options.interactive
      ? await this.prompter.input("Framework source (owner/repo or local path):", sourceDefault)
      : sourceDefault;
    if (!sourceInput) return {};
    if (isLocalPath(sourceInput)) return { frameworkPath: sourceInput };
    return { frameworkRepo: sourceInput };
  }

  private async resolveRelease(
    frameworkRepo: string | undefined,
    frameworkPath: string | undefined,
    options: SetupOptions
  ): Promise<string | undefined> {
    if (frameworkPath && isLocalPath(frameworkPath)) return options.release;
    if (options.release) return options.release;
    if (options.interactive) {
      const latest = await this.resolver.fetchLatestVersion(frameworkRepo).catch(() => "");
      const label = latest
        ? `Framework release tag (latest: ${latest}):`
        : "Framework release tag:";
      return (await this.prompter.input(label, latest)) || latest || undefined;
    }
    return this.resolver.fetchLatestVersion(frameworkRepo).catch(() => undefined);
  }

  private async handleAdopt(options: SetupOptions, signals: AdoptSignal[]): Promise<SetupResult> {
    const { projectRoot, repo } = options;
    this.validateAdoptNonInteractive(options, repo, signals);

    const selected = await this.resolveAdoptTools(options);
    const fromInput = await this.resolveAdoptFrom(options, repo, signals);
    const { path: frameworkPath, version } = await this.frameworkResolver.execute({
      from: fromInput,
    });
    const adoptResult = await this.runAdopt(
      selected as ToolId[],
      frameworkPath,
      projectRoot,
      version
    );

    return {
      kind: "adopted",
      version,
      toolCount: adoptResult.tools.length,
      totalRegistered: adoptResult.totalRegistered,
    };
  }

  private validateAdoptNonInteractive(
    options: SetupOptions,
    repo: string | undefined,
    signals: AdoptSignal[]
  ): void {
    if (!options.interactive) {
      if (!options.toolIds || options.toolIds.length === 0) {
        throw new InputRequiredError(
          "--ai or --ide is required for adopt in non-interactive mode."
        );
      }
      if (options.from === undefined)
        throw new AdoptRequiresVersionError(repo, this.formatSignalDiagnostic(signals));
    }
  }

  private formatSignalDiagnostic(signals: AdoptSignal[]): string {
    if (signals.length === 0) return "";
    const lines = ["Detected existing AIDD files:"];
    for (const signal of signals) {
      lines.push(`  • ${signal.file} — run: cat ${signal.file}`);
    }
    return lines.join("\n");
  }

  private async runAdopt(
    toolIds: ToolId[],
    _frameworkPath: string,
    projectRoot: string,
    version: string
  ): Promise<{
    tools: { registered: string[] }[];
    totalRegistered: number;
  }> {
    return new AdoptUseCase(this.fs, this.manifestRepo, this.logger, this.assets).execute({
      toolIds,
      docsDir: Manifest.DEFAULT_DOCS_DIR,
      projectRoot,
      version,
    });
  }

  private async resolveAdoptTools(options: SetupOptions): Promise<ToolId[]> {
    if (options.toolIds !== undefined && options.toolIds.length > 0) {
      return options.toolIds;
    }
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
      "Which version of the framework do you already have installed? (e.g. v1.2.3 or local path):",
      ""
    );
    if (!fromInput) throw new AdoptRequiresVersionError(repo, this.formatSignalDiagnostic(signals));
    return fromInput;
  }

  private async handleInstall(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, path, release, repo } = options;

    const { path: frameworkPath, version } = await this.frameworkResolver.execute({
      path,
      release,
      repo,
    });

    const installResults = await this.runInstall(
      frameworkPath,
      version,
      projectRoot,
      repo,
      options.toolIds,
      options.interactive
    );

    return {
      kind: "installed",
      install: { results: installResults },
      resolvedFrameworkPath: this.localPathOf(path, frameworkPath),
    };
  }

  private async handleUpdate(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, path, release, repo } = options;
    const { path: frameworkPath, version } = await this.frameworkResolver.execute({
      path,
      release,
      repo,
    });

    const updateResult = await new UpdateUseCase(
      this.fs,
      this.manifestRepo,
      this.hasher,
      this.logger,
      this.platform,
      this.prompter,
      this.assets
    ).execute({
      frameworkPath,
      version,
      projectRoot,
      interactive: options.interactive ?? false,
      repo,
    });

    if (updateResult.cancelled) return { kind: "update-cancelled" };

    const { pluginsUpdated, pluginsDeleted } = await this.installPluginsForUpdate(
      frameworkPath,
      projectRoot,
      version
    );

    return this.buildUpdateResult(
      updateResult,
      frameworkPath,
      version,
      projectRoot,
      repo,
      options.interactive,
      pluginsUpdated,
      pluginsDeleted,
      this.localPathOf(path, frameworkPath)
    );
  }

  private async installPluginsForUpdate(
    frameworkPath: string,
    projectRoot: string,
    version: string
  ): Promise<{ pluginsUpdated: number; pluginsDeleted: number }> {
    const manifest = await this.manifestRepo.load();
    const mode = manifest?.getMode() ?? "local";
    if (mode !== "local") return { pluginsUpdated: 0, pluginsDeleted: 0 };
    const pluginResult = await this.installFrameworkPluginsUseCase.execute({
      frameworkPath,
      projectRoot,
      version,
      cleanDeleted: true,
    });
    return {
      pluginsUpdated: pluginResult.installedCount,
      pluginsDeleted: pluginResult.deletedCount,
    };
  }

  private async buildUpdateResult(
    updateResult: { totalWritten: number; totalDeleted: number; toolCount: number },
    frameworkPath: string,
    version: string,
    projectRoot: string,
    repo: string | undefined,
    interactive: boolean | undefined,
    pluginsUpdated: number,
    pluginsDeleted: number,
    resolvedFrameworkPath?: string
  ): Promise<SetupResult> {
    const updatedManifest = await this.manifestRepo.load();
    const updatedInstalledIds = updatedManifest?.getInstalledToolIds() ?? [];
    const hasMissing = VALID_TOOL_IDS.some((id) => !updatedInstalledIds.includes(id));
    const additionalInstall = hasMissing
      ? await this.offerAdditionalInstall(frameworkPath, version, projectRoot, repo, interactive)
      : undefined;
    return {
      kind: "updated",
      version,
      totalWritten: updateResult.totalWritten,
      totalDeleted: updateResult.totalDeleted,
      toolCount: updateResult.toolCount,
      pluginsUpdated,
      pluginsDeleted,
      additionalInstall,
      resolvedFrameworkPath,
    };
  }

  private async handleUpToDate(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, path, release, repo } = options;

    const manifest = await this.manifestRepo.load();
    const installedIds = manifest?.getInstalledToolIds() ?? [];
    const missingTools = VALID_TOOL_IDS.filter((id) => !installedIds.includes(id));

    if (missingTools.length === 0) return { kind: "up-to-date", hasAdditionalTools: false };
    if (!options.interactive) return { kind: "up-to-date", hasAdditionalTools: true };

    const { path: frameworkPath, version } = await this.frameworkResolver.execute({
      path,
      release,
      repo,
    });
    const additionalInstall = await this.offerAdditionalInstall(
      frameworkPath,
      version,
      projectRoot,
      repo,
      options.interactive
    );
    return {
      kind: "up-to-date",
      hasAdditionalTools: true,
      additionalInstall,
      resolvedFrameworkPath: this.localPathOf(path, frameworkPath),
    };
  }

  private async offerAdditionalInstall(
    frameworkPath: string,
    version: string,
    projectRoot: string,
    repo: string | undefined,
    interactive?: boolean
  ): Promise<InstallSummary | undefined> {
    if (!interactive) return undefined;
    const wantsMore = await this.prompter.confirm("Install additional tools?");
    if (!wantsMore) return undefined;
    const installResults = await this.runInstall(
      frameworkPath,
      version,
      projectRoot,
      repo,
      undefined,
      true
    );
    return { results: installResults };
  }

  private async runInstall(
    frameworkPath: string,
    version: string,
    projectRoot: string,
    repo: string | undefined,
    toolIds?: ToolId[],
    interactive?: boolean
  ): Promise<InstallToolResult[]> {
    const isInteractive = interactive ?? false;
    if (!isInteractive && (toolIds === undefined || toolIds.length === 0)) {
      return [];
    }
    return new InstallUseCase(
      this.fs,
      this.manifestRepo,
      this.hasher,
      this.logger,
      this.platform,
      this.prompter,
      undefined,
      undefined,
      undefined,
      this.assets
    ).execute({
      frameworkPath,
      version,
      projectRoot,
      repo,
      toolIds,
      interactive: isInteractive,
    });
  }
}
