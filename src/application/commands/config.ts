import { Command } from "commander";
import { Manifest, validateRepoFormat } from "../../domain/models/manifest.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { NoManifestError } from "../errors.js";
import { parseGlobalOptions } from "./global-options.js";

type ReadableKey = "docsDir" | "repo" | "tools";
type WritableKey = "repo";

const READABLE_KEYS: ReadableKey[] = ["docsDir", "repo", "tools"];
const WRITABLE_KEYS: WritableKey[] = ["repo"];

export function registerConfigCommand(program: Command): void {
  const configCmd = new Command("config").description("Read or update manifest configuration");

  configCmd
    .command("list")
    .description("Show all configuration values from the manifest")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const manifest = await deps.manifestRepo.load();
        if (manifest === null) throw new NoManifestError();
        output.print(`docsDir = ${manifest.docsDir}`);
        output.print(`repo    = ${manifest.repo ?? Manifest.DEFAULT_REPO}`);
        output.print(`tools   = ${manifest.getInstalledToolIds().join(", ") || "(none)"}`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  configCmd
    .command("get [key]")
    .description(`Get a configuration value (readable: ${READABLE_KEYS.join(", ")})`)
    .action(async (key: string | undefined) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);

        let resolvedKey = key;
        if (resolvedKey === undefined) {
          if (!process.stdout.isTTY) {
            output.error("aidd config get requires a key argument in non-interactive mode.");
            process.exit(1);
          }
          resolvedKey = await deps.prompter.select(
            "Which config key?",
            READABLE_KEYS.map((k) => ({ name: k, value: k }))
          );
        }

        if (!READABLE_KEYS.includes(resolvedKey as ReadableKey)) {
          output.error(`Unknown key '${resolvedKey}'. Valid keys: ${READABLE_KEYS.join(", ")}.`);
          process.exit(1);
        }
        const manifest = await deps.manifestRepo.load();
        if (manifest === null) throw new NoManifestError();
        if (resolvedKey === "docsDir") output.print(manifest.docsDir);
        else if (resolvedKey === "repo") output.print(manifest.repo ?? Manifest.DEFAULT_REPO);
        else output.print(manifest.getInstalledToolIds().join(", "));
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  configCmd
    .command("set [key] [value]")
    .description(
      `Update a configuration value in the manifest (writable: ${WRITABLE_KEYS.join(", ")})`
    )
    .option("-f, --force", "Skip confirmation prompt", false)
    .action(
      async (
        key: string | undefined,
        value: string | undefined,
        cmdOptions: { force: boolean }
      ) => {
        const { verbose, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);
        try {
          const deps = await createDeps(projectRoot, { verbose }, output);

          let resolvedKey = key;
          let resolvedValue = value;

          if (resolvedKey === undefined || resolvedValue === undefined) {
            if (!process.stdout.isTTY) {
              output.error(
                "aidd config set requires key and value arguments in non-interactive mode."
              );
              process.exit(1);
            }
            if (resolvedKey === undefined) {
              resolvedKey = await deps.prompter.select(
                "Which config key to set?",
                WRITABLE_KEYS.map((k) => ({ name: k, value: k }))
              );
            }
            const manifest = await deps.manifestRepo.load();
            if (manifest === null) throw new NoManifestError();
            const currentValue = manifest.repo ?? Manifest.DEFAULT_REPO;
            resolvedValue = await deps.prompter.input("New value:", currentValue);
          }

          if (!WRITABLE_KEYS.includes(resolvedKey as WritableKey)) {
            if (READABLE_KEYS.includes(resolvedKey as ReadableKey)) {
              output.error(
                `'${resolvedKey}' is read-only. Use the appropriate aidd command to change it.`
              );
            } else {
              output.error(
                `Unknown key '${resolvedKey}'. Writable keys: ${WRITABLE_KEYS.join(", ")}.`
              );
            }
            process.exit(1);
          }

          const manifest = await deps.manifestRepo.load();
          if (manifest === null) throw new NoManifestError();

          // Only writable key is "repo" (docsDir hardcoded per locked decision #10).
          validateRepoFormat(resolvedValue);
          const current = manifest.repo ?? Manifest.DEFAULT_REPO;
          if (resolvedValue === current) {
            output.print(`repo is already '${resolvedValue}'.`);
            return;
          }
          if (!cmdOptions.force) {
            if (!process.stdout.isTTY) {
              output.error("Confirmation required. Use --force to skip in non-interactive mode.");
              process.exit(1);
            }
            const confirmed = await deps.prompter.confirm(
              `Change repo from '${current}' to '${resolvedValue}'?`
            );
            if (!confirmed) {
              output.print("Aborted.");
              return;
            }
          }
          await deps.manifestRepo.save(manifest.withRepo(resolvedValue));
          output.success(`Set repo = ${resolvedValue}`);
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );

  program.addCommand(configCmd);
}
