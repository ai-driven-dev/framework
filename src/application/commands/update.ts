import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { NoManifestError } from "../errors.js";
import { CLIOutput } from "../output.js";
import { ConflictResolutionUseCase } from "../use-cases/conflict-resolution-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";
import { UpdateUseCase } from "../use-cases/update-use-case.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update installed files to the latest framework version")
    .option("-f, --force", "Overwrite conflicting files without prompting", false)
    .option("--dry-run", "Preview changes without writing files", false)
    .option("--tool <tool>", "Limit update to a specific tool")
    .option("--docs", "Limit update to docs only")
    .option("--framework <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
    .action(
      async (cmdOptions: {
        force: boolean;
        dryRun: boolean;
        tool?: string;
        docs?: boolean;
        framework?: string;
        release?: string;
      }) => {
        const globalOptions = program.opts<{
          verbose: boolean;
          repo?: string;
          token?: string;
        }>();

        const verbose = globalOptions.verbose ?? false;
        const output = new CLIOutput(verbose);
        const projectRoot = process.cwd();

        if (cmdOptions.tool !== undefined && cmdOptions.docs) {
          output.error("--tool and --docs are mutually exclusive");
          process.exit(1);
        }

        try {
          if (cmdOptions.tool !== undefined) {
            assertValidToolIds([cmdOptions.tool]);
          }

          const deps = await createDeps(
            projectRoot,
            {
              verbose,
              repo: globalOptions.repo,
              token: globalOptions.token,
            },
            output
          );

          const manifest = await deps.manifestRepo.load();
          if (manifest === null) {
            throw new NoManifestError(globalOptions.repo);
          }

          const { path: frameworkPath, version } = await resolveFramework(
            deps.resolver,
            deps.logger,
            { framework: cmdOptions.framework, release: cmdOptions.release }
          );

          const isInteractive =
            !cmdOptions.force &&
            !cmdOptions.dryRun &&
            cmdOptions.tool === undefined &&
            !cmdOptions.docs &&
            process.stdout.isTTY;

          let resolvedToolIds: ToolId[] | undefined = cmdOptions.tool
            ? [cmdOptions.tool as ToolId]
            : undefined;
          let resolvedDocsOnly = cmdOptions.docs ?? false;
          let resolvedForce = cmdOptions.force;

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

          if (isInteractive) {
            const dryRunResult = await updateUseCase.execute({
              frameworkPath,
              version,
              docsDir: manifest.docsDir,
              projectRoot,
              dryRun: true,
              force: false,
              repo: globalOptions.repo,
            });

            const changedTools = dryRunResult.tools.filter((t) =>
              t.diff.some((d) => d.kind !== "unchanged")
            );
            const docsChanged =
              dryRunResult.docs?.diff.some((d) => d.kind !== "unchanged") ?? false;

            if (changedTools.length === 0 && !docsChanged) {
              output.success(`Already up to date (v${version})`);
              return;
            }

            const scopeChoices = [
              { name: "All", value: "all" },
              ...changedTools.map((t) => ({ name: `${t.toolId} only`, value: `tool:${t.toolId}` })),
              ...(docsChanged ? [{ name: "docs only", value: "docs" }] : []),
            ];

            const scopeSelection = await deps.prompter.select("What to update?", scopeChoices);
            const confirmed = await deps.prompter.confirm("Apply update?");

            if (!confirmed) {
              output.info("Update cancelled.");
              return;
            }

            if (scopeSelection === "docs") {
              resolvedDocsOnly = true;
            } else if (scopeSelection.startsWith("tool:")) {
              resolvedToolIds = [scopeSelection.slice(5) as ToolId];
            }
            resolvedForce = true;
          }

          const result = await updateUseCase.execute({
            frameworkPath,
            version,
            docsDir: manifest.docsDir,
            projectRoot,
            toolIds: resolvedToolIds,
            docsOnly: resolvedDocsOnly,
            force: resolvedForce,
            dryRun: cmdOptions.dryRun,
            repo: globalOptions.repo,
          });

          if (result.alreadyUpToDate) {
            output.success(`Already up to date (v${version})`);
            return;
          }

          if (result.dryRun) {
            output.info("Dry run — no files written.");
            for (const tool of result.tools) {
              const changed = tool.diff.filter((d) => d.kind !== "unchanged");
              if (changed.length === 0) continue;
              output.info(`\n${tool.toolId} (v${version}):`);
              for (const diff of changed) {
                const conflict = diff.conflict ? " [conflict]" : "";
                output.info(`  [${diff.kind}]${conflict} ${diff.relativePath}`);
              }
            }
            if (result.docs) {
              const changed = result.docs.diff.filter((d) => d.kind !== "unchanged");
              if (changed.length > 0) {
                output.info(`\ndocs (v${version}):`);
                for (const diff of changed) {
                  const conflict = diff.conflict ? " [conflict]" : "";
                  output.info(`  [${diff.kind}]${conflict} ${diff.relativePath}`);
                }
              }
            }
            return;
          }

          for (const tool of result.tools) {
            if (tool.alreadyUpToDate) continue;
            output.info(`\n${tool.toolId} (v${version}):`);
            for (const f of tool.written) output.info(`  + ${f}`);
            for (const f of tool.deleted) output.info(`  - ${f}`);
            for (const f of tool.kept) output.info(`  ~ kept: ${f}`);
            for (const f of tool.backedUp) output.info(`  ~ backup: ${f}`);
          }
          if (result.docs && !result.docs.alreadyUpToDate) {
            output.info(`\ndocs (v${version}):`);
            for (const f of result.docs.written) output.info(`  + ${f}`);
            for (const f of result.docs.deleted) output.info(`  - ${f}`);
            for (const f of result.docs.kept) output.info(`  ~ kept: ${f}`);
            for (const f of result.docs.backedUp) output.info(`  ~ backup: ${f}`);
          }

          output.success(
            `\nUpdated ${result.totalWritten} files, deleted ${result.totalDeleted} files across ${result.toolCount} tool(s)`
          );
        } catch (error) {
          output.exit(error);
        }
      }
    );
}
