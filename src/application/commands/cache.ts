import { join } from "node:path";
import { Command } from "commander";
import { AIDD_DIR } from "../../domain/models/paths.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { FrameworkCache } from "../../infrastructure/cache/framework-cache.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions } from "./global-options.js";

function buildCacheCommand(program: Command): Command {
  const cacheCmd = new Command("cache").description("Manage the local framework version cache");

  cacheCmd
    .command("list")
    .description("List all cached framework versions")
    .action(async () => {
      const { output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      try {
        const cache = new FrameworkCache(join(projectRoot, AIDD_DIR, "cache"));
        const entries = await cache.list();

        if (entries.length === 0) {
          output.print("No cached framework versions found.");
          return;
        }

        for (const entry of entries) {
          output.print(`${entry.version}  ${formatBytes(entry.size)}  ${entry.path}`);
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  cacheCmd
    .command("clear [version]")
    .description("Clear a specific cached version or all cached versions")
    .option("-a, --all", "Clear all cached versions", false)
    .action(async (version: string | undefined, cmdOptions: { all: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      if (cmdOptions.all && version !== undefined) {
        output.error("Cannot specify both a version and --all.");
        process.exit(1);
      }

      try {
        const cache = new FrameworkCache(join(projectRoot, AIDD_DIR, "cache"));

        if (version !== undefined) {
          const normalizedVersion = version.replace(/^v/, "");
          await cache.clear(normalizedVersion);
          output.success(`Cleared cache for version ${normalizedVersion}`);
        } else if (cmdOptions.all) {
          await cache.clear();
          output.success("Cleared all cached framework versions");
        } else {
          if (!process.stdout.isTTY) {
            output.error("Specify a version or --all in non-interactive mode.");
            process.exit(1);
          }

          const deps = await createDeps(projectRoot, { verbose }, output);

          const entries = await cache.list();
          if (entries.length === 0) {
            output.info("No cached versions.");
            return;
          }

          const selected = await deps.prompter.checkbox(
            "Select versions to clear:",
            entries.map((e) => ({ name: e.version, value: e.version }))
          );

          if (selected.length === 0) {
            return;
          }

          const confirmed = await deps.prompter.confirm("Delete selected versions?");
          if (!confirmed) {
            return;
          }

          for (const v of selected) {
            await cache.clear(v);
          }
          const count = selected.length;
          output.success(`Cleared ${count} cached ${count === 1 ? "version" : "versions"}`);
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  return cacheCmd;
}

export function registerCacheCommand(program: Command): void {
  program.addCommand(buildCacheCommand(program));
}
