import type { Command } from "commander";
import { Manifest } from "../../domain/models/manifest.js";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { AdoptRequiresVersionError } from "../errors.js";
import { CLIOutput } from "../output.js";
import { AdoptUseCase } from "../use-cases/adopt-use-case.js";
import { ConflictResolutionUseCase } from "../use-cases/conflict-resolution-use-case.js";
import { InitUseCase } from "../use-cases/init-use-case.js";
import { InstallUseCase } from "../use-cases/install-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";
import { SetupUseCase } from "../use-cases/setup-use-case.js";
import { UpdateUseCase } from "../use-cases/update-use-case.js";

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Interactively set up or update the project to a correct state")
    .option("--framework <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
    .action(async (cmdOptions: { framework?: string; release?: string }) => {
      if (!process.stdout.isTTY) {
        const output = new CLIOutput(false);
        output.error("aidd setup requires an interactive TTY.");
        process.exit(1);
      }

      const globalOptions = program.opts<{
        verbose: boolean;
        repo?: string;
        token?: string;
      }>();

      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      try {
        const deps = await createDeps(
          projectRoot,
          { verbose, repo: globalOptions.repo, token: globalOptions.token },
          output
        );

        const state = await new SetupUseCase(deps.manifestRepo, deps.fs, deps.resolver).execute({
          projectRoot,
        });

        switch (state.kind) {
          case "needs-init": {
            const docsDirInput = await deps.prompter.input(
              "Documentation directory name:",
              Manifest.DEFAULT_DOCS_DIR
            );
            const docsDir = docsDirInput || Manifest.DEFAULT_DOCS_DIR;
            Manifest.validateDocsDir(docsDir);

            const repoInput = await deps.prompter.input(
              "Framework repository (owner/repo, leave blank to skip):",
              ""
            );
            const interactiveRepo = repoInput !== "" ? repoInput : globalOptions.repo;

            const { path: frameworkPath, version } = await resolveFramework(
              deps.resolver,
              deps.logger,
              { framework: cmdOptions.framework, release: cmdOptions.release }
            );

            const initResult = await new InitUseCase(
              deps.fs,
              deps.manifestRepo,
              deps.loader,
              deps.hasher,
              deps.logger
            ).execute({
              frameworkPath,
              version,
              docsDir,
              explicitDocsDir: docsDirInput,
              projectRoot,
              force: false,
              repo: interactiveRepo,
            });

            output.success(
              `Initialized docs in ${initResult.docsDir}/ (${initResult.fileCount} files)`
            );

            const installedIds = initResult.manifest.getInstalledToolIds();
            const choices = VALID_TOOL_IDS.map((id) =>
              installedIds.includes(id)
                ? { name: id, value: id, checked: true, disabled: "(already installed)" }
                : { name: id, value: id, checked: false }
            );
            const selected = await deps.prompter.checkbox(
              "Which tools do you want to install?",
              choices
            );
            if (selected.length === 0) throw new Error("No tools selected.");
            const installResults = await new InstallUseCase(
              deps.fs,
              deps.manifestRepo,
              deps.loader,
              deps.hasher,
              deps.logger,
              deps.git,
              deps.platform
            ).execute({
              toolIds: selected as ToolId[],
              frameworkPath,
              version,
              docsDir: initResult.manifest.docsDir,
              projectRoot,
              repo: globalOptions.repo,
            });
            for (const r of installResults.filter((r) => r.skipped))
              output.warn(`${r.toolId} is already installed.`);
            const installed = installResults.filter((r) => !r.skipped);
            for (const r of installed) for (const w of r.warnings) output.warn(w);
            if (installed.length === 1) {
              output.success(`Installed ${installed[0].toolId} (${installed[0].fileCount} files)`);
            } else if (installed.length > 1) {
              const totalFiles = installed.reduce((s, r) => s + r.fileCount, 0);
              output.success(
                `Installed ${installed.map((r) => r.toolId).join(", ")} (${totalFiles} files)`
              );
            }
            break;
          }

          case "needs-adopt": {
            const choices = VALID_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }));
            const selected = await deps.prompter.checkbox(
              "Which tools do you want to adopt?",
              choices
            );
            if (selected.length === 0) throw new Error("No tools selected.");

            const fromInput = await deps.prompter.input("Framework version tag or local path:", "");
            if (!fromInput) throw new AdoptRequiresVersionError(globalOptions.repo);

            const { path: frameworkPath, version } = await resolveFramework(
              deps.resolver,
              deps.logger,
              { from: fromInput }
            );

            const adoptResult = await new AdoptUseCase(
              deps.fs,
              deps.manifestRepo,
              deps.loader,
              deps.hasher,
              deps.logger,
              deps.platform
            ).execute({
              toolIds: selected as ToolId[],
              frameworkPath,
              docsDir: Manifest.DEFAULT_DOCS_DIR,
              projectRoot,
              version,
            });

            output.success(
              `Adopted ${adoptResult.tools.length} tool(s) at version ${version}: ${adoptResult.totalRegistered} files registered, ${adoptResult.docsRegistered} docs registered`
            );
            break;
          }

          case "needs-install": {
            const { path: frameworkPath, version } = await resolveFramework(
              deps.resolver,
              deps.logger,
              { framework: cmdOptions.framework, release: cmdOptions.release }
            );
            const installedIds = state.manifest.getInstalledToolIds();
            const choices = VALID_TOOL_IDS.map((id) =>
              installedIds.includes(id)
                ? { name: id, value: id, checked: true, disabled: "(already installed)" }
                : { name: id, value: id, checked: false }
            );
            const selected = await deps.prompter.checkbox(
              "Which tools do you want to install?",
              choices
            );
            if (selected.length === 0) throw new Error("No tools selected.");
            const installResults = await new InstallUseCase(
              deps.fs,
              deps.manifestRepo,
              deps.loader,
              deps.hasher,
              deps.logger,
              deps.git,
              deps.platform
            ).execute({
              toolIds: selected as ToolId[],
              frameworkPath,
              version,
              docsDir: state.manifest.docsDir,
              projectRoot,
              repo: globalOptions.repo,
            });
            for (const r of installResults.filter((r) => r.skipped))
              output.warn(`${r.toolId} is already installed.`);
            const installed = installResults.filter((r) => !r.skipped);
            for (const r of installed) for (const w of r.warnings) output.warn(w);
            if (installed.length === 1) {
              output.success(`Installed ${installed[0].toolId} (${installed[0].fileCount} files)`);
            } else if (installed.length > 1) {
              const totalFiles = installed.reduce((s, r) => s + r.fileCount, 0);
              output.success(
                `Installed ${installed.map((r) => r.toolId).join(", ")} (${totalFiles} files)`
              );
            }
            break;
          }

          case "needs-update": {
            const { path: frameworkPath, version } = await resolveFramework(
              deps.resolver,
              deps.logger,
              { framework: cmdOptions.framework, release: cmdOptions.release }
            );

            const updateUseCase = new UpdateUseCase(
              deps.fs,
              deps.manifestRepo,
              deps.loader,
              deps.hasher,
              deps.logger,
              deps.git,
              deps.platform,
              new ConflictResolutionUseCase(deps.prompter)
            );

            const dryRunResult = await updateUseCase.execute({
              frameworkPath,
              version,
              docsDir: state.manifest.docsDir,
              projectRoot,
              dryRun: true,
              force: false,
            });

            const { added, changed, removed } = dryRunResult.diffSummary;
            output.info(`${added} added, ${changed} changed, ${removed} removed`);

            const confirmed = await deps.prompter.confirm("Apply update?");
            if (!confirmed) {
              output.info("Update skipped.");
              return;
            }

            const updateResult = await updateUseCase.execute({
              frameworkPath,
              version,
              docsDir: state.manifest.docsDir,
              projectRoot,
              force: false,
              dryRun: false,
            });

            output.success(
              `Updated ${updateResult.totalWritten} files, deleted ${updateResult.totalDeleted} files across ${updateResult.toolCount} tool(s)`
            );

            const updatedManifest = await deps.manifestRepo.load();
            const updatedInstalledIds = updatedManifest?.getInstalledToolIds() ?? [];
            const missingTools = VALID_TOOL_IDS.filter((id) => !updatedInstalledIds.includes(id));
            if (missingTools.length > 0) {
              const wantsMore = await deps.prompter.confirm("Install additional tools?");
              if (wantsMore) {
                const installManifest = updatedManifest ?? undefined;
                const installChoices = VALID_TOOL_IDS.map((id) =>
                  updatedInstalledIds.includes(id)
                    ? { name: id, value: id, checked: true, disabled: "(already installed)" }
                    : { name: id, value: id, checked: false }
                );
                const installSelected = await deps.prompter.checkbox(
                  "Which tools do you want to install?",
                  installChoices
                );
                if (installSelected.length === 0) throw new Error("No tools selected.");
                const installResults = await new InstallUseCase(
                  deps.fs,
                  deps.manifestRepo,
                  deps.loader,
                  deps.hasher,
                  deps.logger,
                  deps.git,
                  deps.platform
                ).execute({
                  toolIds: installSelected as ToolId[],
                  frameworkPath,
                  version,
                  docsDir: installManifest?.docsDir ?? Manifest.DEFAULT_DOCS_DIR,
                  projectRoot,
                  repo: globalOptions.repo,
                });
                for (const r of installResults.filter((r) => r.skipped))
                  output.warn(`${r.toolId} is already installed.`);
                const installed = installResults.filter((r) => !r.skipped);
                for (const r of installed) for (const w of r.warnings) output.warn(w);
                if (installed.length === 1) {
                  output.success(
                    `Installed ${installed[0].toolId} (${installed[0].fileCount} files)`
                  );
                } else if (installed.length > 1) {
                  const totalFiles = installed.reduce((s, r) => s + r.fileCount, 0);
                  output.success(
                    `Installed ${installed.map((r) => r.toolId).join(", ")} (${totalFiles} files)`
                  );
                }
              }
            }
            break;
          }

          case "up-to-date": {
            const manifest = await deps.manifestRepo.load();
            const installedIds = manifest?.getInstalledToolIds() ?? [];
            const missingTools = VALID_TOOL_IDS.filter((id) => !installedIds.includes(id));
            if (missingTools.length > 0) {
              output.info("All installed tools are up to date.");
              const wantsMore = await deps.prompter.confirm("Install additional tools?");
              if (wantsMore) {
                const { path: frameworkPath, version } = await resolveFramework(
                  deps.resolver,
                  deps.logger,
                  { framework: cmdOptions.framework, release: cmdOptions.release }
                );
                const choices = VALID_TOOL_IDS.map((id) =>
                  installedIds.includes(id)
                    ? { name: id, value: id, checked: true, disabled: "(already installed)" }
                    : { name: id, value: id, checked: false }
                );
                const selected = await deps.prompter.checkbox(
                  "Which tools do you want to install?",
                  choices
                );
                if (selected.length === 0) throw new Error("No tools selected.");
                const installResults = await new InstallUseCase(
                  deps.fs,
                  deps.manifestRepo,
                  deps.loader,
                  deps.hasher,
                  deps.logger,
                  deps.git,
                  deps.platform
                ).execute({
                  toolIds: selected as ToolId[],
                  frameworkPath,
                  version,
                  docsDir: manifest?.docsDir ?? Manifest.DEFAULT_DOCS_DIR,
                  projectRoot,
                  repo: globalOptions.repo,
                });
                for (const r of installResults.filter((r) => r.skipped))
                  output.warn(`${r.toolId} is already installed.`);
                const installed = installResults.filter((r) => !r.skipped);
                for (const r of installed) for (const w of r.warnings) output.warn(w);
                if (installed.length === 1) {
                  output.success(
                    `Installed ${installed[0].toolId} (${installed[0].fileCount} files)`
                  );
                } else if (installed.length > 1) {
                  const totalFiles = installed.reduce((s, r) => s + r.fileCount, 0);
                  output.success(
                    `Installed ${installed.map((r) => r.toolId).join(", ")} (${totalFiles} files)`
                  );
                }
              }
            } else {
              output.info("Project is up to date.");
            }
            break;
          }
        }
      } catch (error) {
        output.exit(error);
      }
    });
}
