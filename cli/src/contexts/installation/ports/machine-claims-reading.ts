import type {
  NativeRefClaim,
  NativeRegistrations,
} from "../domain/manifest/native-registrations.js";

/** What the manifest carries and machine claims read: the claims a tool's record keeps on its
 * native refs, and the project roots holding plugins or refs. */
export interface MachineClaimsReading {
  claimsOf(registrations: NativeRegistrations | undefined): readonly NativeRefClaim[];
  holdersOf(
    plugins: readonly { readonly machineClaim?: unknown }[],
    refClaims: readonly { readonly dependents: readonly string[] }[]
  ): readonly string[];
}
