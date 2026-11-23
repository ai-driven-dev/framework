import type { ToolRecord } from "../../contract/records/scope-records.js";

/** A claim on a native ref, with the project roots still holding it. */
export interface NativeRefClaim {
  readonly ref: string;
  readonly dependents: readonly string[];
}

/** What the manifest carries and machine claims read: the claims a tool's record keeps on its
 * native refs, and the project roots holding plugins or refs. */
export interface MachineClaimsReading {
  claimsOf(registrations: ToolRecord | undefined): readonly NativeRefClaim[];
  holdersOf(
    plugins: readonly { readonly machineClaim?: unknown }[],
    refClaims: readonly { readonly dependents: readonly string[] }[]
  ): readonly string[];
}
