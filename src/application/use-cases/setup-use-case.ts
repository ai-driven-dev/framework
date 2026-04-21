import { isLocalPath } from "../../domain/models/framework-path.js";
import { Manifest } from "../../domain/models/manifest.js";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import type { AuthTokenProvider } from "../../domain/ports/auth-token-provider.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";
import type { FrameworkResolver } from "../../domain/ports/framework-resolver.js";
import type { Git } from "../../domain/ports/git.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { Platform } from "../../domain/ports/platform.js";
import type { Prompter } from "../../domain/ports/prompter.js";
import { AdoptRequiresVersionError, InputRequiredError } from "../errors.js";
import { AdoptUseCase } from "./adopt-use-case.js";
import { InitUseCase } from "./init-use-case.js";
import type { InstallToolResult } from "./install-use-case.js";
import { InstallUseCase } from "./install-use-case.js";
import { ResolveFrameworkUseCase } from "./resolve-framework-use-case.js";
import { type AdoptSignal, SetupStateDetector } from "./shared/setup-state-detector.js";
import { UpdateUseCase } from "./update-use-case.js";

export type { AdoptSignal, SetupState } from "./shared/setup-state-detector.js";

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
}

interface InstallSummary {
  results: InstallToolResult[];
}

export type SetupResult =
  | { kind: "initialized"; docsDir: string; fileCount: number; install: InstallSummary }
  | {
      kind: "adopted";
      version: string;
      toolCount: number;
      totalRegistered: number;
      docsRegistered: number;
    }
  | { kind: "installed"; install: InstallSummary }
  | { kind: "update-cancelled" }
  | {
      kind: "updated";
      version: string;
      totalWritten: number;
      totalDeleted: number;
      toolCount: number;
      additionalInstall?: InstallSummary;
    }
  | { kind: "up-to-date"; hasAdditionalTools: boolean; additionalInstall?: InstallSummary };

export class SetupUseCase {
  private readonly frameworkResolver: ResolveFrameworkUseCase;

  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly git: Git,
    private readonly platform: Platform,
    private readonly prompter: Prompter,
    private readonly resolver: FrameworkResolver,
    authReader?: AuthTokenProvider
  ) {
    this.frameworkResolver = new ResolveFrameworkUseCase(resolver, logger, authReader);
  }

  async execute(options: SetupOptions): Promise<SetupResult> {
    const state = await new SetupStateDetector(this.manifestRepo, this.fs, this.resolver).detect(
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
    const { frameworkPath, frameworkRepo } = await this.resolveFrameworkSource(options);
    const resolvedRelease = await this.resolveRelease(frameworkRepo, options);
    const resolved = await this.frameworkResolver.execute({
      path: frameworkPath,
      release: resolvedRelease,
    });
    const repoForManifest = frameworkRepo ?? repo;

    const initResult = await this.runInit(
      resolved.path,
      resolved.version,
      docsDir,
      explicitDocsDir,
      projectRoot,
      repoForManifest
    );

    const installResults = await this.runInstall(
      resolved.path,
      resolved.version,
      projectRoot,
      repoForManifest,
      options.toolIds,
      options.interactive
    );

    return {
      kind: "initialized",
      docsDir: initResult.docsDir,
      fileCount: initResult.fileCount,
      install: { results: installResults },
    };
  }

  private async runInit(
    frameworkPath: string,
    version: string,
    docsDir: string,
    explicitDocsDir: string,
    projectRoot: string,
    repo: string | undefined
  ): Promise<{ docsDir: string; fileCount: number }> {
    return new InitUseCase(
      this.fs,
      this.manifestRepo,
      this.loader,
      this.hasher,
      this.logger
    ).execute({
      frameworkPath,
      version,
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
    options: SetupOptions
  ): Promise<{ frameworkPath?: string; frameworkRepo?: string }> {
    if (options.path !== undefined) {
      if (!options.path) return {};
      if (isLocalPath(options.path)) return { frameworkPath: options.path };
      return { frameworkRepo: options.path };
    }
    const existingManifest = await this.manifestRepo.load();
    const sourceDefault = existingManifest?.repo ?? this.resolver.getDefaultRepo() ?? "";
    const sourceInput = options.interactive
      ? await this.prompter.input("Framework source (owner/repo or local path):", sourceDefault)
      : sourceDefault;
    if (!sourceInput) return {};
    if (isLocalPath(sourceInput)) return { frameworkPath: sourceInput };
    return { frameworkRepo: sourceInput };
  }

  private async resolveRelease(
    frameworkRepo: string | undefined,
    options: SetupOptions
  ): Promise<string | undefined> {
    if (options.path && isLocalPath(options.path)) return options.release;
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
      docsRegistered: adoptResult.docsRegistered,
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
          "--tools <ids> is required for adopt in non-interactive mode."
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
    frameworkPath: string,
    projectRoot: string,
    version: string
  ): Promise<{
    tools: { registered: string[] }[];
    totalRegistered: number;
    docsRegistered: number;
  }> {
    return new AdoptUseCase(
      this.fs,
      this.manifestRepo,
      this.loader,
      this.hasher,
      this.logger,
      this.platform
    ).execute({
      toolIds,
      frameworkPath,
      docsDir: Manifest.DEFAULT_DOCS_DIR,
      projectRoot,
      version,
    });
  }

  private async resolveAdoptTools(options: SetupOptions): Promise<ToolId[]> {
    if (options.toolIds !== undefined && options.toolIds.length > 0) {
      return options.toolIds;
    }
    const choices = VALID_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }));
    const checkedIds = await this.prompter.checkbox("Which tools do you want to adopt?", choices);
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

    return { kind: "installed", install: { results: installResults } };
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
      this.loader,
      this.hasher,
      this.logger,
      this.git,
      this.platform,
      this.prompter
    ).execute({
      frameworkPath,
      version,
      projectRoot,
      interactive: options.interactive ?? false,
      repo,
    });

    if (updateResult.cancelled) return { kind: "update-cancelled" };

    return this.buildUpdateResult(
      updateResult,
      frameworkPath,
      version,
      projectRoot,
      repo,
      options.interactive
    );
  }

  private async buildUpdateResult(
    updateResult: { totalWritten: number; totalDeleted: number; toolCount: number },
    frameworkPath: string,
    version: string,
    projectRoot: string,
    repo: string | undefined,
    interactive?: boolean
  ): Promise<SetupResult> {
    const updatedManifest = await this.manifestRepo.load();
    const updatedInstalledIds = updatedManifest?.getInstalledToolIds() ?? [];
    const missingTools = VALID_TOOL_IDS.filter((id) => !updatedInstalledIds.includes(id));
    const additionalInstall = await this.offerAdditionalInstall(
      missingTools.length > 0,
      frameworkPath,
      version,
      projectRoot,
      repo,
      interactive
    );
    return {
      kind: "updated",
      version,
      totalWritten: updateResult.totalWritten,
      totalDeleted: updateResult.totalDeleted,
      toolCount: updateResult.toolCount,
      additionalInstall,
    };
  }

  private async handleUpToDate(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, path, release, repo } = options;

    const manifest = await this.manifestRepo.load();
    const installedIds = manifest?.getInstalledToolIds() ?? [];
    const missingTools = VALID_TOOL_IDS.filter((id) => !installedIds.includes(id));

    if (missingTools.length === 0) return { kind: "up-to-date", hasAdditionalTools: false };
    if (!options.interactive) return { kind: "up-to-date", hasAdditionalTools: true };

    const wantsMore = await this.prompter.confirm("Install additional tools?");
    if (!wantsMore) return { kind: "up-to-date", hasAdditionalTools: true };

    return this.installAdditionalTools(path, release, repo, projectRoot);
  }

  private async installAdditionalTools(
    path: string | undefined,
    release: string | undefined,
    repo: string | undefined,
    projectRoot: string
  ): Promise<SetupResult> {
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
      undefined,
      true
    );
    return {
      kind: "up-to-date",
      hasAdditionalTools: true,
      additionalInstall: { results: installResults },
    };
  }

  private async offerAdditionalInstall(
    hasMissing: boolean,
    frameworkPath: string,
    version: string,
    projectRoot: string,
    repo: string | undefined,
    interactive?: boolean
  ): Promise<InstallSummary | undefined> {
    if (!hasMissing) return undefined;
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
      this.loader,
      this.hasher,
      this.logger,
      this.git,
      this.platform,
      this.prompter
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
