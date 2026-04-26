import type { Command } from "commander";
import { assertValidToolIds, type ToolId } from "../../domain/tools/registry.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { ResolveFrameworkUseCase } from "../use-cases/resolve-framework-use-case.js";
import { UpdateUseCase } from "../use-cases/update/update-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

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
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);

        if (cmdOptions.tool !== undefined && cmdOptions.docs) {
          output.error("--tool and --docs are mutually exclusive");
          process.exit(1);
        }

        try {
          if (cmdOptions.tool !== undefined) {
            assertValidToolIds([cmdOptions.tool]);
          }

          const deps = await createDeps(projectRoot, { verbose, repo }, output);

          const { path: frameworkPath, version } = await new ResolveFrameworkUseCase(
            deps.resolver,
            deps.logger,
            deps.authReader
          ).execute({ path: cmdOptions.path, release: cmdOptions.release });

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
            repo: repo,
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
            const DRY_RUN_SYMBOL: Record<string, string> = {
              added: "+",
              removed: "-",
              changed: "~",
            };
            output.print("The following changes would be applied:");
            let totalChanges = 0;
            for (const tool of result.tools) {
              const changed = tool.diff.filter((d) => d.kind !== "unchanged");
              if (changed.length === 0) continue;
              output.print("");
              output.print(`${tool.toolId} (v${version}):`);
              for (const diff of changed) {
                const symbol = DRY_RUN_SYMBOL[diff.kind] ?? "~";
                const conflict = diff.conflict ? " [conflict]" : "";
                output.print(`  ${symbol} ${diff.relativePath}${conflict}`);
                totalChanges++;
              }
            }
            if (result.docs) {
              const changed = result.docs.diff.filter((d) => d.kind !== "unchanged");
              if (changed.length > 0) {
                output.print("");
                output.print(`docs (v${version}):`);
                for (const diff of changed) {
                  const symbol = DRY_RUN_SYMBOL[diff.kind] ?? "~";
                  const conflict = diff.conflict ? " [conflict]" : "";
                  output.print(`  ${symbol} ${diff.relativePath}${conflict}`);
                  totalChanges++;
                }
              }
            }
            const toolCount = result.toolCount;
            output.print("");
            output.print(
              `Would apply ${totalChanges} ${totalChanges === 1 ? "change" : "changes"} across ${toolCount} ${toolCount === 1 ? "tool" : "tools"}. Run without --dry-run to apply.`
            );
            return;
          }

          for (const tool of result.tools) {
            if (tool.alreadyUpToDate) continue;
            output.print("");
            output.print(`${tool.toolId} (v${version}):`);
            for (const f of tool.written) output.print(`  + ${f}`);
            for (const f of tool.deleted) output.print(`  - ${f}`);
            for (const f of tool.kept) output.print(`  ~ kept: ${f}`);
            for (const f of tool.backedUp) output.print(`  ~ backup: ${f}`);
          }
          if (result.docs && !result.docs.alreadyUpToDate) {
            output.print("");
            output.print(`docs (v${version}):`);
            for (const f of result.docs.written) output.print(`  + ${f}`);
            for (const f of result.docs.deleted) output.print(`  - ${f}`);
            for (const f of result.docs.kept) output.print(`  ~ kept: ${f}`);
            for (const f of result.docs.backedUp) output.print(`  ~ backup: ${f}`);
          }

          const toolCount = result.toolCount;
          output.print("");
          output.success(
            `Updated ${result.totalWritten} ${result.totalWritten === 1 ? "file" : "files"}, deleted ${result.totalDeleted} ${result.totalDeleted === 1 ? "file" : "files"} across ${toolCount} ${toolCount === 1 ? "tool" : "tools"}`
          );
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );
}
