import type { ToolBuildContract } from "../../../../shared/domain/materialization/build-contract.js";
import type { TomlCodec } from "../formats/toml.js";
import { CapabilityConfigError } from "../tools.error.js";

/** The file codecs a profile's declarations name by format, wired by the composition. */
export interface ToolFormats {
  readonly toml?: TomlCodec;
}

/** The TOML codec a declaration naming the TOML format needs; refused when none was wired. */
export function tomlOf(formats: ToolFormats): TomlCodec {
  if (formats.toml === undefined) {
    throw new CapabilityConfigError("a declaration names the TOML format, and no codec was given");
  }
  return formats.toml;
}

/** A build contract a profile declares: the arguments it hands the builder it names, built on
 * first ask with the codecs the composition wired. */
export interface ContractSpec {
  readonly args: readonly unknown[];
  readonly build: (formats: ToolFormats) => ToolBuildContract;
}

/** The contract `build` makes from `args`. */
export function contract<A extends unknown[]>(
  build: (...args: A) => ToolBuildContract,
  ...args: A
): ContractSpec {
  return { args, build: () => build(...args) };
}

/** The contract `build` makes from `args` and the TOML codec the composition wires. */
export function tomlContract<A extends unknown[]>(
  build: (toml: TomlCodec, ...args: A) => ToolBuildContract,
  ...args: A
): ContractSpec {
  return { args, build: (formats) => build(tomlOf(formats), ...args) };
}

/** A contract declared through its builder, or one already built elsewhere and handed over on
 * first ask. A profile file declares the builder: `profiles-hold-data.arch.test.ts` refuses a
 * function written there. */
export type DeclaredContract = ContractSpec | (() => ToolBuildContract);

/** The declared contract, built on first ask. */
export function contractOf(
  declared: DeclaredContract,
  formats: ToolFormats
): () => ToolBuildContract {
  return typeof declared === "function" ? declared : () => declared.build(formats);
}
