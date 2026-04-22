import type { Command } from "commander";
import type { ToolCategory } from "../../domain/models/tool-config.js";
import { InvalidCategoryError } from "../errors.js";
import { CLIOutput } from "../output.js";

export interface GlobalOptions {
  verbose: boolean;
  repo?: string;
  output: CLIOutput;
  projectRoot: string;
}

export function parseGlobalOptions(program: Command): GlobalOptions {
  const opts = program.opts<{ verbose?: boolean; repo?: string }>();
  const verbose = opts.verbose ?? false;
  return {
    verbose,
    repo: opts.repo,
    output: new CLIOutput(verbose),
    projectRoot: process.cwd(),
  };
}

export function parseCategoryArg(
  arg: string | undefined,
  output: CLIOutput
): ToolCategory | undefined {
  if (arg === undefined) return undefined;
  if (arg === "ai" || arg === "ide") return arg;
  output.error(new InvalidCategoryError(arg).message);
  process.exit(1);
}
