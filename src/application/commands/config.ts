import { confirm } from "@inquirer/prompts";
import { Command } from "commander";
import { validateRepoFormat } from "../../infrastructure/adapters/framework-resolver-adapter.js";
import { createDeps } from "../../infrastructure/deps.js";
import { CLIOutput } from "../output.js";

const DEFAULT_REPO = "ai-driven-dev/aidd-framework";

type ReadableKey = "docsDir" | "repo" | "tools";
type WritableKey = "docsDir" | "repo";

const READABLE_KEYS: ReadableKey[] = ["docsDir", "repo", "tools"];
const WRITABLE_KEYS: WritableKey[] = ["docsDir", "repo"];

export function registerConfigCommand(program: Command): void {
  const configCmd = new Command("config").description("Read or update manifest configuration");

  configCmd
    .command("list")
    .description("Show all configuration values from the manifest")
    .action(async () => {
      const globalOptions = program.opts<{ verbose: boolean }>();
      const output = new CLIOutput(globalOptions.verbose ?? false);
      const projectRoot = process.cwd();
      try {
        const deps = await createDeps(
          projectRoot,
          { verbose: globalOptions.verbose ?? false },
          output
        );
        const manifest = await deps.manifestRepo.load();
        if (manifest === null)
          throw new Error("No AIDD installation found. Run `aidd init` first.");
        output.print(`docsDir = ${manifest.docsDir}`);
        output.print(`repo    = ${manifest.repo ?? DEFAULT_REPO}`);
        output.print(`tools   = ${manifest.getInstalledToolIds().join(", ") || "(none)"}`);
      } catch (error) {
        output.exit(error);
      }
    });

  configCmd
    .command("get <key>")
    .description(`Get a configuration value (readable: ${READABLE_KEYS.join(", ")})`)
    .action(async (key: string) => {
      const globalOptions = program.opts<{ verbose: boolean }>();
      const output = new CLIOutput(globalOptions.verbose ?? false);
      const projectRoot = process.cwd();
      try {
        if (!READABLE_KEYS.includes(key as ReadableKey)) {
          output.error(`Unknown key '${key}'. Valid keys: ${READABLE_KEYS.join(", ")}.`);
          process.exit(1);
        }
        const deps = await createDeps(
          projectRoot,
          { verbose: globalOptions.verbose ?? false },
          output
        );
        const manifest = await deps.manifestRepo.load();
        if (manifest === null)
          throw new Error("No AIDD installation found. Run `aidd init` first.");
        if (key === "docsDir") output.print(manifest.docsDir);
        else if (key === "repo") output.print(manifest.repo ?? DEFAULT_REPO);
        else output.print(manifest.getInstalledToolIds().join(", "));
      } catch (error) {
        output.exit(error);
      }
    });

  configCmd
    .command("set <key> <value>")
    .description(
      `Update a configuration value in the manifest (writable: ${WRITABLE_KEYS.join(", ")})`
    )
    .option("-f, --force", "Skip confirmation prompt", false)
    .action(async (key: string, value: string, cmdOptions: { force: boolean }) => {
      const globalOptions = program.opts<{ verbose: boolean }>();
      const output = new CLIOutput(globalOptions.verbose ?? false);
      const projectRoot = process.cwd();
      try {
        if (!WRITABLE_KEYS.includes(key as WritableKey)) {
          if (READABLE_KEYS.includes(key as ReadableKey)) {
            output.error(`'${key}' is read-only. Use the appropriate aidd command to change it.`);
          } else {
            output.error(`Unknown key '${key}'. Writable keys: ${WRITABLE_KEYS.join(", ")}.`);
          }
          process.exit(1);
        }

        const deps = await createDeps(
          projectRoot,
          { verbose: globalOptions.verbose ?? false },
          output
        );
        const manifest = await deps.manifestRepo.load();
        if (manifest === null)
          throw new Error("No AIDD installation found. Run `aidd init` first.");

        if (key === "repo") {
          validateRepoFormat(value);
          const current = manifest.repo ?? DEFAULT_REPO;
          if (value === current) {
            output.print(`repo is already '${value}'.`);
            return;
          }
          if (!cmdOptions.force) {
            if (!process.stdout.isTTY) {
              output.error("Confirmation required. Use --force to skip in non-interactive mode.");
              process.exit(1);
            }
            const confirmed = await confirm({
              message: `Change repo from '${current}' to '${value}'?`,
            });
            if (!confirmed) {
              output.print("Aborted.");
              return;
            }
          }
          await deps.manifestRepo.save(manifest.withRepo(value));
          output.success(`repo updated to '${value}'.`);
          return;
        }

        // key === "docsDir"
        if (value === manifest.docsDir) {
          output.print(`docsDir is already '${value}'.`);
          return;
        }

        const { join } = await import("node:path");
        const newDirExists = await deps.fs.fileExists(join(projectRoot, value));

        if (newDirExists) {
          output.print(`Directory '${value}' found on disk. Updating manifest.`);
        } else {
          output.warn(`Directory '${value}' does not exist on disk.`);
          output.warn(
            `Move your docs manually from '${manifest.docsDir}' to '${value}' before running other commands.`
          );
        }

        if (!cmdOptions.force) {
          if (!process.stdout.isTTY) {
            output.error("Confirmation required. Use --force to skip in non-interactive mode.");
            process.exit(1);
          }
          const confirmed = await confirm({
            message: `Change docsDir from '${manifest.docsDir}' to '${value}'?`,
          });
          if (!confirmed) {
            output.print("Aborted.");
            return;
          }
        }

        await deps.manifestRepo.save(manifest.withDocsDir(value));
        output.success(`docsDir updated to '${value}'.`);
      } catch (error) {
        output.exit(error);
      }
    });

  program.addCommand(configCmd);
}
