import type { ToolRecord } from "../../contract/records/scope-records.js";

/** A claim on a native ref, with the project roots still holding it. */
export interface NativeRefClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** A claim on a machine plugin, with the project roots still holding it. */
export interface PluginClaim {
  readonly plugin: string;
  readonly dependents: readonly string[];
}

/** What machine claims read from a tool's record: its claims on native refs and on machine
 * plugins, and the project roots holding either. */
export interface MachineClaimsReading {
  claimsOf(registrations: ToolRecord | undefined): readonly NativeRefClaim[];
  pluginClaimsOf(
    registrations: ToolRecord | undefined,
    names: readonly string[]
  ): readonly PluginClaim[];
  holdersOf(claims: readonly { readonly dependents: readonly string[] }[]): readonly string[];
}
