import type { Command } from "commander";
import type { Scope } from "../../../shared/domain/scope.js";
import type { Output } from "../../terminal/output.model.js";

export interface GlobalOptions {
  verbose: boolean;
  output: Output;
  projectRoot: string;
}

/** What the container of a run is built with, read from the flags. */
export interface RunOptions {
  verbose: boolean;
  token?: string;
}

/** Builds the container of one run. A command names the contexts it reads in `C`, and the real
 * container, which carries every context, fits any of them. */
export type ContainerFactory<C> = (
  projectRoot: string,
  options: RunOptions,
  output: Output | undefined
) => Promise<C>;

/** Builds the output a command writes to, `verbose` already read from the arguments. */
export type OutputFactory = (verbose: boolean) => Output;

const outputFactories = new WeakMap<Command, OutputFactory>();

/** Hands the program the factory its commands build their output with: the composition decides
 * which output backs them, a command never does. */
export function bindOutput(program: Command, createOutput: OutputFactory): void {
  outputFactories.set(program, createOutput);
}

export function outputOf(program: Command): Output {
  const createOutput = outputFactories.get(program);
  if (createOutput === undefined) throw new Error("the program has no output: call bindOutput");
  return createOutput(program.opts<{ verbose?: boolean }>().verbose ?? false);
}

export function parseGlobalOptions(program: Command): GlobalOptions {
  const verbose = program.opts<{ verbose?: boolean }>().verbose ?? false;
  return {
    verbose,
    output: outputOf(program),
    projectRoot: process.cwd(),
  };
}

/** Returns the flag as given, `undefined` included: each caller applies its own default
 * rather than this validation guessing one for all of them. */
/** `--global` is the spelling a person types; `--scope user` stays for scripts. */
export const GLOBAL_FLAG_HELP = "act on the machine-wide install `setup --global` wrote";

/** What `--token` says in every command that fetches from a source. */
export const TOKEN_FLAG_HELP = "Auth token (host detected from source URL at fetch time)";

export function resolveScopeFlags(
  options: { scope?: string; global?: boolean },
  output: Output
): Scope | undefined {
  return options.global === true ? "user" : parseScopeFlag(options.scope, output);
}

export function parseScopeFlag(raw: string | undefined, output: Output): Scope | undefined {
  if (raw === undefined || raw === "project" || raw === "user") return raw;
  output.error(`Invalid --scope "${raw}" — expected "project" or "user".`);
  output.exit(1);
}
