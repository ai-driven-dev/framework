import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";
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
    .option("--path <path>", "Path to a local framework directory or tarball")
    .option("--release <tag>", "Specific framework release tag to install (e.g., v3.2.0)")
    .action(
      async (cmdOptions: {
        force: boolean;
        dryRun: boolean;
        tool?: string;
        docs?: boolean;
        path?: string;
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

          const { path: frameworkPath, version } = await resolveFramework(
            deps.resolver,
            deps.logger,
            { path: cmdOptions.path, release: cmdOptions.release }
          );

          const updateUseCase = new UpdateUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.loader,
            deps.hasher,
            deps.logger,
            deps.git,
            deps.platform,
            deps.prompter
          );

          const result = await updateUseCase.execute({
            frameworkPath,
            version,
            projectRoot,
            toolIds: cmdOptions.tool ? [cmdOptions.tool as ToolId] : undefined,
            docsOnly: cmdOptions.docs ?? false,
            force: cmdOptions.force,
            dryRun: cmdOptions.dryRun,
            repo: globalOptions.repo,
            interactive: process.stdout.isTTY,
          });

          if (result.cancelled) {
            output.info("Update cancelled.");
            return;
          }

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
