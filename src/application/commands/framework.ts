import { resolve } from "node:path";
import type { Command } from "commander";
import type { FrameworkBuildTarget } from "../../domain/models/framework-build.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerFrameworkCommand(program: Command): void {
  const framework = program
    .command("framework")
    .description("Framework build and management tools");

  framework
    .command("build")
    .description("Build a Claude-format framework into a Copilot-native plugin marketplace tree")
    .requiredOption("--source <path>", "Path to the source framework directory")
    .requiredOption("--target <target>", "Build target (copilot)")
    .requiredOption("--out <dir>", "Output directory for the built marketplace")
    .action(async (cmdOptions: { source: string; target: string; out: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      if (cmdOptions.target !== "copilot") {
        output.error(`Unsupported target '${cmdOptions.target}'. MVP1 supports 'copilot' only.`);
        process.exit(1);
      }

      const sourceDir = resolve(projectRoot, cmdOptions.source);
      const outDir = resolve(projectRoot, cmdOptions.out);
      const target = cmdOptions.target as FrameworkBuildTarget;

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const result = await deps.frameworkBuildUseCase.execute({ sourceDir, outDir, target });
        output.success(
          `Built ${result.plugins.length} plugins, ${result.totalFiles} files written to ${result.outDir}`
        );
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
