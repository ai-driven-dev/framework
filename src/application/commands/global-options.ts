import type { Command } from "commander";
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
