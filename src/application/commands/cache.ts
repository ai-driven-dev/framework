import { join } from "node:path";
import { Command } from "commander";
import { FrameworkCache } from "../../infrastructure/cache/framework-cache.js";
import { CLIOutput } from "../output.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildCacheCommand(program: Command): Command {
  const cacheCmd = new Command("cache").description("Manage the local framework version cache");

  cacheCmd
    .command("list")
    .description("List all cached framework versions")
    .action(async () => {
      const globalOptions = program.opts<{ verbose: boolean }>();
      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      try {
        const cache = new FrameworkCache(join(projectRoot, ".aidd", "cache"));
        const entries = await cache.list();

        if (entries.length === 0) {
          output.print("No cached framework versions found.");
          return;
        }

        for (const entry of entries) {
          output.print(`${entry.version}  ${formatBytes(entry.size)}  ${entry.path}`);
        }
      } catch (error) {
        output.exit(error);
      }
    });

  cacheCmd
    .command("clear [version]")
    .description("Clear a specific cached version or all cached versions")
    .option("-a, --all", "Clear all cached versions", false)
    .action(async (version: string | undefined, cmdOptions: { all: boolean }) => {
      const globalOptions = program.opts<{ verbose: boolean }>();
      const verbose = globalOptions.verbose ?? false;
      const output = new CLIOutput(verbose);
      const projectRoot = process.cwd();

      if (cmdOptions.all && version !== undefined) {
        output.error("Cannot specify both a version and --all.");
        process.exit(1);
      }

      try {
        const cache = new FrameworkCache(join(projectRoot, ".aidd", "cache"));

        if (version !== undefined) {
          await cache.clear(version);
          output.success(`Cleared cache for version ${version}`);
        } else {
          await cache.clear();
          output.success("Cleared all cached framework versions");
        }
      } catch (error) {
        output.exit(error);
      }
    });

  return cacheCmd;
}

export function registerCacheCommand(program: Command): void {
  program.addCommand(buildCacheCommand(program));
}
