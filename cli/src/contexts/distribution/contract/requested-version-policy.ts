import { VersionMismatchError } from "../../../shared/domain/shared.error.js";

export type RequestedVersionPolicy = "strict" | "prefer-catalog";

/** The version an install must hold to, and whether the catalog's own version overrode the one asked. */
export interface CatalogVersionRequirement {
  readonly requiredVersion: string | undefined;
  readonly overridden: boolean;
}

/** Holds a requested version against the catalog entry's: `strict` refuses a difference,
 * `prefer-catalog` drops the request and keeps the catalog's version. */
export function catalogVersionRequirement(
  entry: { readonly name: string; readonly version?: string },
  requested: string | undefined,
  policy: RequestedVersionPolicy
): CatalogVersionRequirement {
  const differs = Boolean(requested && entry.version && entry.version !== requested);
  if (policy === "prefer-catalog") return { requiredVersion: undefined, overridden: differs };
  if (differs && requested && entry.version)
    throw new VersionMismatchError(entry.name, requested, entry.version);
  return { requiredVersion: requested, overridden: false };
}
