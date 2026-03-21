import { Manifest } from "../../domain/models/manifest.js";
import { compareSemver, isSemver } from "../../domain/models/semver.js";
import {
  getAllRegisteredTools,
  hasToolSignals,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/models/tool-config.js";
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
import { AdoptRequiresVersionError } from "../errors.js";
import { requireAuth } from "../require-auth.js";
import { AdoptUseCase } from "./adopt-use-case.js";
import { InitUseCase } from "./init-use-case.js";
import type { InstallToolResult } from "./install-use-case.js";
import { InstallUseCase } from "./install-use-case.js";
import { resolveFramework } from "./resolve-framework-use-case.js";
import { UpdateUseCase } from "./update-use-case.js";

interface SetupOptions {
  projectRoot: string;
  path?: string;
  release?: string;
  repo?: string;
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

export type SetupState =
  | { kind: "needs-init" }
  | { kind: "needs-adopt" }
  | { kind: "needs-install" }
  | { kind: "needs-update"; currentVersion: string; latestVersion: string }
  | { kind: "up-to-date" };

export class SetupUseCase {
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
    private readonly authReader?: AuthTokenProvider
  ) {}

  async execute(options: SetupOptions): Promise<SetupResult> {
    if (this.authReader) {
      await requireAuth(this.authReader);
    }

    const state = await detectSetupState(
      this.manifestRepo,
      this.fs,
      this.resolver,
      options.projectRoot
    );
    switch (state.kind) {
      case "needs-init":
        return this.handleInit(options);
      case "needs-adopt":
        return this.handleAdopt(options);
      case "needs-install":
        return this.handleInstall(options);
      case "needs-update":
        return this.handleUpdate(options);
      case "up-to-date":
        return this.handleUpToDate(options);
    }
  }

  private async handleInit(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, path, release, repo } = options;

    const docsDirInput = await this.prompter.input(
      "Documentation directory name:",
      Manifest.DEFAULT_DOCS_DIR
    );
    const docsDir = docsDirInput || Manifest.DEFAULT_DOCS_DIR;
    Manifest.validateDocsDir(docsDir);

    const existingManifest = await this.manifestRepo.load();
    const sourceDefault = path ?? existingManifest?.repo ?? this.resolver.getDefaultRepo() ?? "";
    const sourceInput = await this.prompter.input(
      "Framework source (owner/repo or local path):",
      sourceDefault
    );

    let interactivePath: string | undefined;
    let interactiveRepo: string | undefined;

    if (sourceInput !== "") {
      if (
        sourceInput.startsWith("/") ||
        sourceInput.startsWith("./") ||
        sourceInput.startsWith("../")
      ) {
        interactivePath = sourceInput;
      } else {
        interactiveRepo = sourceInput;
      }
    }

    let resolvedRelease: string | undefined;
    if (!interactivePath && !release && interactiveRepo) {
      const latestTag = await this.resolver.fetchLatestVersion(interactiveRepo).catch(() => "");
      if (latestTag) {
        resolvedRelease = await this.prompter.input(
          `Framework release tag (latest: ${latestTag}):`,
          latestTag
        );
      } else {
        resolvedRelease = await this.prompter.input("Framework release tag:", "");
      }
    }

    const { path: frameworkPath, version } = await resolveFramework(this.resolver, this.logger, {
      path: interactivePath ?? path,
      release: resolvedRelease ?? release,
      repo: interactiveRepo,
    });

    const initResult = await new InitUseCase(
      this.fs,
      this.manifestRepo,
      this.loader,
      this.hasher,
      this.logger
    ).execute({
      frameworkPath,
      version,
      docsDir,
      explicitDocsDir: docsDirInput,
      projectRoot,
      force: false,
      repo: interactiveRepo,
    });

    const installResults = await this.runInstall(frameworkPath, version, projectRoot, repo);

    return {
      kind: "initialized",
      docsDir: initResult.docsDir,
      fileCount: initResult.fileCount,
      install: { results: installResults },
    };
  }

  private async handleAdopt(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, repo } = options;

    const choices = VALID_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }));
    const selected = await this.prompter.checkbox("Which tools do you want to adopt?", choices);
    if (selected.length === 0) throw new Error("No tools selected.");

    const fromInput = await this.prompter.input("Framework version tag or local path:", "");
    if (!fromInput) throw new AdoptRequiresVersionError(repo);

    const { path: frameworkPath, version } = await resolveFramework(this.resolver, this.logger, {
      from: fromInput,
    });

    const adoptResult = await new AdoptUseCase(
      this.fs,
      this.manifestRepo,
      this.loader,
      this.hasher,
      this.logger,
      this.platform
    ).execute({
      toolIds: selected as ToolId[],
      frameworkPath,
      docsDir: Manifest.DEFAULT_DOCS_DIR,
      projectRoot,
      version,
    });

    return {
      kind: "adopted",
      version,
      toolCount: adoptResult.tools.length,
      totalRegistered: adoptResult.totalRegistered,
      docsRegistered: adoptResult.docsRegistered,
    };
  }

  private async handleInstall(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, path, release, repo } = options;

    const { path: frameworkPath, version } = await resolveFramework(this.resolver, this.logger, {
      path,
      release,
      repo,
    });

    const installResults = await this.runInstall(frameworkPath, version, projectRoot, repo);

    return { kind: "installed", install: { results: installResults } };
  }

  private async handleUpdate(options: SetupOptions): Promise<SetupResult> {
    const { projectRoot, path, release, repo } = options;

    const { path: frameworkPath, version } = await resolveFramework(this.resolver, this.logger, {
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
      interactive: true,
      repo,
    });

    if (updateResult.cancelled) {
      return { kind: "update-cancelled" };
    }

    const updatedManifest = await this.manifestRepo.load();
    const updatedInstalledIds = updatedManifest?.getInstalledToolIds() ?? [];
    const missingTools = VALID_TOOL_IDS.filter((id) => !updatedInstalledIds.includes(id));
    const additionalInstall = await this.offerAdditionalInstall(
      missingTools.length > 0,
      frameworkPath,
      version,
      projectRoot,
      repo
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

    if (missingTools.length === 0) {
      return { kind: "up-to-date", hasAdditionalTools: false };
    }

    const wantsMore = await this.prompter.confirm("Install additional tools?");
    if (!wantsMore) {
      return { kind: "up-to-date", hasAdditionalTools: true };
    }

    const { path: frameworkPath, version } = await resolveFramework(this.resolver, this.logger, {
      path,
      release,
      repo,
    });
    const installResults = await this.runInstall(frameworkPath, version, projectRoot, repo);

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
    repo: string | undefined
  ): Promise<InstallSummary | undefined> {
    if (!hasMissing) return undefined;
    const wantsMore = await this.prompter.confirm("Install additional tools?");
    if (!wantsMore) return undefined;
    const installResults = await this.runInstall(frameworkPath, version, projectRoot, repo);
    return { results: installResults };
  }

  private async runInstall(
    frameworkPath: string,
    version: string,
    projectRoot: string,
    repo: string | undefined
  ): Promise<InstallToolResult[]> {
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
      interactive: true,
    });
  }
}

export async function detectSetupState(
  manifestRepo: ManifestRepository,
  fs: FileSystem,
  resolver: FrameworkResolver,
  projectRoot: string
): Promise<SetupState> {
  const manifest = await manifestRepo.load();

  if (manifest === null) {
    for (const tool of getAllRegisteredTools().values()) {
      if (await hasToolSignals(fs, tool, projectRoot)) return { kind: "needs-adopt" };
    }
    return { kind: "needs-init" };
  }

  const installedIds = manifest.getInstalledToolIds();
  if (installedIds.length === 0) {
    return { kind: "needs-install" };
  }

  try {
    const latestVersion = await resolver.fetchLatestVersion(manifest.repo);
    const installedVersions = installedIds
      .map((id) => manifest.getToolVersion(id))
      .filter((v): v is string => v !== undefined);
    const currentVersion = installedVersions[0] ?? "unknown";
    const needsUpdate =
      isSemver(latestVersion) &&
      installedVersions.some((v) => !isSemver(v) || compareSemver(v, latestVersion) < 0);
    if (needsUpdate) {
      return { kind: "needs-update", currentVersion, latestVersion };
    }
  } catch {
    // Network failure → treat as up-to-date
  }

  return { kind: "up-to-date" };
}
