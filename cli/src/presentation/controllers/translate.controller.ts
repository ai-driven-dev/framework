import { resolve } from "node:path";
import type { Command } from "commander";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { FrameworkBuildMode } from "../../contexts/tools/contract/tool-profile.js";
import type {
  BuildNativeTree,
  FrameworkBuildContext,
} from "../../contexts/translate/application/build-native-tree.use-case.js";
import {
  type FrameworkBuildTarget,
  supportedBuildTargets,
} from "../../contexts/translate/contract/build-targets.js";
import type { Output } from "../../orchestration/domain/output.js";
import { printTranslateResult } from "../presenters/translate.presenter.js";
import { type ContainerFactory, parseGlobalOptions } from "./menu/global-options.controller.js";

/** What this command reads of the container. */
export interface TranslateContainer {
  translate: {
    frameworkBuild: (ctx: FrameworkBuildContext) => Pick<BuildNativeTree, "execute"> | undefined;
  };
}

interface TranslateExecutionParams {
  containerOf: ContainerFactory<TranslateContainer>;
  projectRoot: string;
  verbose: boolean;
  output: Output;
  sourceDir: string;
  outDir: string;
  target: FrameworkBuildTarget;
  mode: FrameworkBuildMode;
  force: boolean;
}

/** No build exists for this target in this layout, which ends the run. */
function refuseCombination(output: Output, target: string, mode: string): never {
  output.error(`Unsupported target/mode combination: ${target} (${mode}).`);
  return output.exit(1);
}

/** The build+report core, once `--to`/`--as`/`--out` flags are validated and resolved. */
async function runTranslateCore({
  containerOf,
  projectRoot,
  verbose,
  output,
  sourceDir,
  outDir,
  target,
  mode,
  force,
}: TranslateExecutionParams): Promise<void> {
  const container = await containerOf(projectRoot, { verbose }, output);
  const useCase =
    container.translate.frameworkBuild({ target, mode, outDir, force }) ??
    refuseCombination(output, target, mode);
  const result = await useCase.execute({ sourceDir, outDir, target, mode });
  printTranslateResult(output, mode, {
    pluginCount: result.plugins.length,
    totalFiles: result.totalFiles,
    outDir: result.outDir,
  });
}

/** The build target the person named, or the supported ones when it is none of them. */
function buildTargetOf(raw: string, tools: ToolCatalog, output: Output): FrameworkBuildTarget {
  const targets = supportedBuildTargets(tools);
  const target = targets.find((candidate) => candidate === raw);
  if (target === undefined) {
    output.error(`Unsupported target '${raw}'. Supported targets: ${targets.join(", ")}.`);
    return output.exit(1);
  }
  return target;
}

/** The output layout the person named; absent means a marketplace. */
function buildModeOf(raw: string | undefined, output: Output): FrameworkBuildMode {
  if (raw !== undefined && raw !== "marketplace" && raw !== "flat") {
    output.error(`Invalid --as '${raw}'. Expected 'marketplace' or 'flat'.`);
    output.exit(1);
  }
  return raw === "flat" ? "flat" : "marketplace";
}

interface TranslateCmdOptions {
  to: string;
  out: string;
  as?: string;
  force?: boolean;
}

export function registerTranslateCommand(
  program: Command,
  tools: ToolCatalog,
  containerOf: ContainerFactory<TranslateContainer>
): void {
  program
    .command("translate")
    .description(
      "Convert an arbitrary source into a target-native plugin tree — records nothing (see `sync` for the manifest-driven, tracked version)"
    )
    .argument("<source>", "Path to the source framework directory")
    .requiredOption("--to <target>", `Conversion target (${tools.inHelpOrder("ai").join(", ")})`)
    .requiredOption("--out <dir>", "Output directory (marketplace dist or project root)")
    .option("--as <marketplace|flat>", "Output layout", "marketplace")
    .option("--force", "Overwrite existing files at canonical paths under --out")
    .action(async (source: string, cmdOptions: TranslateCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);

      await runTranslateCore({
        containerOf,
        projectRoot,
        verbose,
        output,
        sourceDir: resolve(projectRoot, source),
        outDir: resolve(projectRoot, cmdOptions.out),
        target: buildTargetOf(cmdOptions.to, tools, output),
        mode: buildModeOf(cmdOptions.as, output),
        force: cmdOptions.force ?? false,
      });
    });
}
