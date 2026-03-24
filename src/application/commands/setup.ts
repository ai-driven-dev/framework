import type { Command } from "commander";
import {
  assertValidToolIds,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import type { CLIOutput } from "../output.js";
import type { InstallToolResult } from "../use-cases/install-use-case.js";
import { SetupUseCase } from "../use-cases/setup-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

function displayInstall(output: CLIOutput, results: InstallToolResult[], verbose: boolean): void {
  const skipped = results.filter((r) => r.skipped);
  const installed = results.filter((r) => !r.skipped);
  for (const r of skipped) output.warn(`${r.toolId} is already installed.`);
  for (const r of installed) for (const w of r.warnings) output.warn(w);
  if (verbose) {
    for (const r of installed) {
      output.debug(`Tool: ${r.toolId}`);
      for (const f of r.files) output.debug(`  + ${f.relativePath}`);
    }
  }
  if (installed.length === 1) {
    output.success(`Installed ${installed[0].toolId} (${installed[0].fileCount} files)`);
  } else if (installed.length > 1) {
    const total = installed.reduce((s, r) => s + r.fileCount, 0);
    output.success(`Installed ${installed.map((r) => r.toolId).join(", ")} (${total} files)`);
  }
}

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Set up or update the project to a correct state")
    .option("--path <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
    .option("--docs-dir <dir>", "Documentation directory name (default: aidd_docs)")
    .option("--tools <ids>", "Comma-separated tool IDs to install (e.g., claude,cursor)")
    .option("--all-tools", "Install all available tools")
    .option(
      "--from <version>",
      "Framework version already installed, required for adopt (e.g., v3.2.0)"
    )
    .action(
      async (cmdOptions: {
        path?: string;
        release?: string;
        docsDir?: string;
        tools?: string;
        allTools?: boolean;
        from?: string;
      }) => {
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);

        const rawToolIds = cmdOptions.allTools
          ? [...VALID_TOOL_IDS]
          : cmdOptions.tools
            ? (cmdOptions.tools.split(",").map((s) => s.trim()) as ToolId[])
            : undefined;
        if (rawToolIds && rawToolIds.length > 0) {
          try {
            assertValidToolIds(rawToolIds);
          } catch (e) {
            output.error(e instanceof Error ? e.message : String(e));
            process.exit(1);
          }
        }

        try {
          const deps = await createDeps(projectRoot, { verbose, repo }, output);

          const result = await new SetupUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.loader,
            deps.hasher,
            deps.logger,
            deps.git,
            deps.platform,
            deps.prompter,
            deps.resolver,
            deps.authReader
          ).execute({
            projectRoot,
            path: cmdOptions.path,
            release: cmdOptions.release,
            repo,
            interactive: process.stdout.isTTY,
            docsDir: cmdOptions.docsDir,
            toolIds: rawToolIds,
            from: cmdOptions.from,
          });

          switch (result.kind) {
            case "initialized": {
              output.success(`Initialized docs in ${result.docsDir}/ (${result.fileCount} files)`);
              displayInstall(output, result.install.results, verbose);
              break;
            }

            case "adopted": {
              output.success(
                `Adopted ${result.toolCount} tool(s) at version ${result.version}: ${result.totalRegistered} files registered, ${result.docsRegistered} docs registered`
              );
              break;
            }

            case "installed": {
              displayInstall(output, result.install.results, verbose);
              break;
            }

            case "update-cancelled": {
              output.info("Update cancelled.");
              break;
            }

            case "updated": {
              output.success(
                `Updated ${result.totalWritten} files, deleted ${result.totalDeleted} files across ${result.toolCount} tool(s)`
              );
              if (result.additionalInstall) {
                displayInstall(output, result.additionalInstall.results, verbose);
              }
              break;
            }

            case "up-to-date": {
              if (result.hasAdditionalTools) {
                output.info("All installed tools are up to date.");
              } else {
                output.info("Project is up to date.");
              }
              if (result.additionalInstall) {
                displayInstall(output, result.additionalInstall.results, verbose);
              }
              break;
            }
          }
        } catch (error) {
          output.exit(error);
        }
      }
    );
}
