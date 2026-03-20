import { Manifest } from "../../domain/models/manifest.js";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
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
import { AdoptUseCase } from "./adopt-use-case.js";
import { InitUseCase } from "./init-use-case.js";
import type { InstallToolResult } from "./install-use-case.js";
import { InstallUseCase } from "./install-use-case.js";
import { resolveFramework } from "./resolve-framework-use-case.js";
import { SetupUseCase } from "./setup-use-case.js";
import { UpdateUseCase } from "./update-use-case.js";

interface SetupFlowOptions {
  projectRoot: string;
  framework?: string;
  release?: string;
  repo?: string;
}

interface InstallSummary {
  results: InstallToolResult[];
}

export type SetupFlowResult =
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

export class SetupFlowUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly manifestRepo: ManifestRepository,
    private readonly loader: FrameworkLoader,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly git: Git,
    private readonly platform: Platform,
    private readonly prompter: Prompter,
    private readonly resolver: FrameworkResolver
  ) {}

  async execute(options: SetupFlowOptions): Promise<SetupFlowResult> {
    const { projectRoot, framework, release, repo } = options;

    const state = await new SetupUseCase(this.manifestRepo, this.fs, this.resolver).execute({
      projectRoot,
    });

    switch (state.kind) {
      case "needs-init": {
        const docsDirInput = await this.prompter.input(
          "Documentation directory name:",
          Manifest.DEFAULT_DOCS_DIR
        );
        const docsDir = docsDirInput || Manifest.DEFAULT_DOCS_DIR;
        Manifest.validateDocsDir(docsDir);

        const repoInput = await this.prompter.input(
          "Framework repository (owner/repo, leave blank to skip):",
          ""
        );
        const interactiveRepo = repoInput !== "" ? repoInput : repo;

        const { path: frameworkPath, version } = await resolveFramework(
          this.resolver,
          this.logger,
          { framework, release }
        );

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

        const installResults = await new InstallUseCase(
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

        return {
          kind: "initialized",
          docsDir: initResult.docsDir,
          fileCount: initResult.fileCount,
          install: { results: installResults },
        };
      }

      case "needs-adopt": {
        const choices = VALID_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }));
        const selected = await this.prompter.checkbox("Which tools do you want to adopt?", choices);
        if (selected.length === 0) throw new Error("No tools selected.");

        const fromInput = await this.prompter.input("Framework version tag or local path:", "");
        if (!fromInput) throw new AdoptRequiresVersionError(repo);

        const { path: frameworkPath, version } = await resolveFramework(
          this.resolver,
          this.logger,
          { from: fromInput }
        );

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

      case "needs-install": {
        const { path: frameworkPath, version } = await resolveFramework(
          this.resolver,
          this.logger,
          { framework, release }
        );

        const installResults = await new InstallUseCase(
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

        return { kind: "installed", install: { results: installResults } };
      }

      case "needs-update": {
        const { path: frameworkPath, version } = await resolveFramework(
          this.resolver,
          this.logger,
          { framework, release }
        );

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

        let additionalInstall: InstallSummary | undefined;
        if (missingTools.length > 0) {
          const wantsMore = await this.prompter.confirm("Install additional tools?");
          if (wantsMore) {
            const installResults = await new InstallUseCase(
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
            additionalInstall = { results: installResults };
          }
        }

        return {
          kind: "updated",
          version,
          totalWritten: updateResult.totalWritten,
          totalDeleted: updateResult.totalDeleted,
          toolCount: updateResult.toolCount,
          additionalInstall,
        };
      }

      case "up-to-date": {
        const manifest = await this.manifestRepo.load();
        const installedIds = manifest?.getInstalledToolIds() ?? [];
        const missingTools = VALID_TOOL_IDS.filter((id) => !installedIds.includes(id));

        if (missingTools.length > 0) {
          const wantsMore = await this.prompter.confirm("Install additional tools?");
          if (wantsMore) {
            const { path: frameworkPath, version } = await resolveFramework(
              this.resolver,
              this.logger,
              { framework, release }
            );
            const installResults = await new InstallUseCase(
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
            return {
              kind: "up-to-date",
              hasAdditionalTools: true,
              additionalInstall: { results: installResults },
            };
          }
          return { kind: "up-to-date", hasAdditionalTools: true };
        }

        return { kind: "up-to-date", hasAdditionalTools: false };
      }
    }
  }
}
