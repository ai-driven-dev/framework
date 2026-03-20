import { join } from "node:path";
import type { Command } from "commander";
import type { Manifest } from "../../domain/models/manifest.js";
import { type ToolId, VALID_TOOL_IDS } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { AdoptRequiresVersionError } from "../errors.js";
import { CLIOutput } from "../output.js";
import { AdoptUseCase } from "../use-cases/adopt-use-case.js";
import { ConflictResolutionUseCase } from "../use-cases/conflict-resolution-use-case.js";
import { InitUseCase } from "../use-cases/init-use-case.js";
import { type InstallToolResult, InstallUseCase } from "../use-cases/install-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";
import { SetupUseCase } from "../use-cases/setup-use-case.js";
import { UpdateUseCase } from "../use-cases/update-use-case.js";

const VALID_DOCS_DIR = /^[a-zA-Z0-9_-]+$/;
const DEFAULT_DOCS_DIR = "aidd_docs";

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
          {
            verbose,
            repo: globalOptions.repo,
            token: globalOptions.token,
          },
          output
        );

        const setupUseCase = new SetupUseCase(deps.manifestRepo, deps.fs, deps.resolver);
        const state = await setupUseCase.execute({ projectRoot });

        switch (state.kind) {
          case "needs-init": {
            const docsDirInput = await deps.prompter.input(
              "Documentation directory name:",
              DEFAULT_DOCS_DIR
            );
            const docsDir = docsDirInput || DEFAULT_DOCS_DIR;

            if (!VALID_DOCS_DIR.test(docsDir) || docsDir.includes("..")) {
              throw new Error(
                `Invalid directory name: "${docsDir}". Use alphanumeric characters, hyphens, and underscores only.`
              );
            }

            const repoInput = await deps.prompter.input(
              "Framework repository (owner/repo, leave blank to skip):",
              ""
            );
            const interactiveRepo = repoInput !== "" ? repoInput : globalOptions.repo;

            if (await deps.fs.fileExists(join(projectRoot, docsDir))) {
              throw new Error(`Directory "${docsDir}" already exists. Choose a different name.`);
            }

            const initUseCase = new InitUseCase(
              deps.fs,
              deps.manifestRepo,
              deps.loader,
              deps.hasher,
              deps.logger
            );

            const { path: frameworkPath, version } = await resolveFramework(
              deps.resolver,
              deps.logger,
              { framework: cmdOptions.framework, release: cmdOptions.release }
            );

            const initResult = await initUseCase.execute({
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

            // Fall through to install flow
            await displayInstallResult(
              output,
              await selectAndInstall(deps, frameworkPath, version, projectRoot, globalOptions.repo)
            );
            break;
          }

          case "needs-adopt": {
            const choices = VALID_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }));
            const selected = await deps.prompter.checkbox(
              "Which tools do you want to adopt?",
              choices
            );

            if (selected.length === 0) {
              throw new Error("No tools selected.");
            }

            const toolIds = selected as ToolId[];

            const fromInput = await deps.prompter.input("Framework version tag or local path:", "");

            if (!fromInput) {
              throw new AdoptRequiresVersionError(globalOptions.repo);
            }

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
              toolIds,
              frameworkPath,
              docsDir: DEFAULT_DOCS_DIR,
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
            await displayInstallResult(
              output,
              await selectAndInstall(
                deps,
                frameworkPath,
                version,
                projectRoot,
                globalOptions.repo,
                state.manifest
              )
            );
            break;
          }

          case "needs-update": {
            const { path: frameworkPath, version } = await resolveFramework(
              deps.resolver,
              deps.logger,
              { framework: cmdOptions.framework, release: cmdOptions.release }
            );

            const conflictResolution = new ConflictResolutionUseCase(deps.prompter);
            const updateUseCase = new UpdateUseCase(
              deps.fs,
              deps.manifestRepo,
              deps.loader,
              deps.hasher,
              deps.logger,
              deps.git,
              deps.platform,
              conflictResolution
            );

            const dryRunResult = await updateUseCase.execute({
              frameworkPath,
              version,
              docsDir: state.manifest.docsDir,
              projectRoot,
              dryRun: true,
              force: false,
            });

            const countByKind = (kind: string) =>
              dryRunResult.tools.reduce(
                (sum, t) => sum + t.diff.filter((d) => d.kind === kind).length,
                0
              ) + (dryRunResult.docs?.diff.filter((d) => d.kind === kind).length ?? 0);

            output.info(
              `${countByKind("added")} added, ${countByKind("changed")} changed, ${countByKind("removed")} removed`
            );

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

            const totalWritten =
              updateResult.tools.reduce((sum, t) => sum + t.written.length, 0) +
              (updateResult.docs?.written.length ?? 0);
            const totalDeleted =
              updateResult.tools.reduce((sum, t) => sum + t.deleted.length, 0) +
              (updateResult.docs?.deleted.length ?? 0);
            const toolCount = updateResult.tools.filter((t) => !t.alreadyUpToDate).length;

            output.success(
              `Updated ${totalWritten} files, deleted ${totalDeleted} files across ${toolCount} tool(s)`
            );

            // Offer to install tools that were not yet installed
            const updatedManifest = await deps.manifestRepo.load();
            const installedIds = updatedManifest?.getInstalledToolIds() ?? [];
            const missingTools = VALID_TOOL_IDS.filter((id) => !installedIds.includes(id));
            if (missingTools.length > 0) {
              const wantsMore = await deps.prompter.confirm("Install additional tools?");
              if (wantsMore) {
                await displayInstallResult(
                  output,
                  await selectAndInstall(
                    deps,
                    frameworkPath,
                    version,
                    projectRoot,
                    globalOptions.repo,
                    updatedManifest ?? undefined
                  )
                );
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
                await displayInstallResult(
                  output,
                  await selectAndInstall(
                    deps,
                    frameworkPath,
                    version,
                    projectRoot,
                    globalOptions.repo,
                    manifest ?? undefined
                  )
                );
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

async function selectAndInstall(
  deps: Awaited<ReturnType<typeof createDeps>>,
  frameworkPath: string,
  version: string,
  projectRoot: string,
  repo: string | undefined,
  manifest?: Manifest
): Promise<{ installed: InstallToolResult[]; skipped: InstallToolResult[] }> {
  const installedIds = manifest?.getInstalledToolIds() ?? [];
  const choices = VALID_TOOL_IDS.map((id) =>
    installedIds.includes(id)
      ? { name: id, value: id, checked: true, disabled: "(already installed)" }
      : { name: id, value: id, checked: false }
  );

  const selected = await deps.prompter.checkbox("Which tools do you want to install?", choices);
  if (selected.length === 0) throw new Error("No tools selected.");

  const toolIds = selected as ToolId[];
  const docsDir = manifest?.docsDir ?? "aidd_docs";

  const installUseCase = new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.loader,
    deps.hasher,
    deps.logger,
    deps.git,
    deps.platform
  );

  const results = await installUseCase.execute({
    toolIds,
    frameworkPath,
    version,
    docsDir,
    projectRoot,
    repo,
  });

  return {
    installed: results.filter((r) => !r.skipped),
    skipped: results.filter((r) => r.skipped),
  };
}

function displayInstallResult(
  output: CLIOutput,
  result: {
    installed: Array<{ toolId: string; fileCount: number; warnings: string[] }>;
    skipped: Array<{ toolId: string }>;
  }
): void {
  for (const r of result.skipped) {
    output.warn(`${r.toolId} is already installed.`);
  }
  for (const r of result.installed) {
    for (const warning of r.warnings) {
      output.warn(warning);
    }
  }

  if (result.installed.length === 0) return;

  const totalFiles = result.installed.reduce((sum, r) => sum + r.fileCount, 0);

  if (result.installed.length === 1) {
    output.success(
      `Installed ${result.installed[0].toolId} (${result.installed[0].fileCount} files)`
    );
  } else {
    const toolList = result.installed.map((r) => r.toolId).join(", ");
    output.success(`Installed ${toolList} (${totalFiles} files)`);
  }
}
