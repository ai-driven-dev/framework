import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";

/** Source currently selected by the host for a named native plugin marketplace. */
export type NativeMarketplaceSource =
  | { readonly kind: "registry"; readonly source: string }
  | {
      readonly kind: "effective-list";
      readonly root: string;
      readonly sourceType: string;
      readonly source: string;
    };

export function sameNativeMarketplaceSource(
  recorded: NativeMarketplaceSource,
  current: NativeMarketplaceSource
): boolean {
  return JSON.stringify(identityOf(recorded)) === JSON.stringify(identityOf(current));
}

/** What makes two sources one: a registry source is its source alone, an effective list adds
 * where it is rooted and what kind it is. */
function identityOf(source: NativeMarketplaceSource): readonly string[] {
  return source.kind === "registry"
    ? [source.kind, source.source]
    : [source.kind, source.source, source.root, source.sourceType];
}

/** One marketplace registration a tool's own CLI was asked to make: aidd's own local name for it
 * (`alias`, what this project's registry is keyed by) beside what the host actually registered it
 * under (`hostName`, the catalog's own declared name, which every host-facing call must use
 * instead). The two differ whenever a project chooses a local alias its catalog does not declare
 * itself under, a supported capability. */
export type NativeMarketplaceRegistration = {
  readonly alias: string;
  readonly hostName: string;
  /** Missing on legacy records: never infer current host ownership from the name alone. */
  readonly provenance?: NativeMarketplaceSource;
};

/** One registration as the host reads it, `undefined` when the entry is not one. */
export function readMarketplaceRegistration(
  entry: unknown
): NativeMarketplaceRegistration | undefined {
  const data = asPlainObject(entry);
  if (data === null || typeof data.alias !== "string" || typeof data.hostName !== "string") {
    return undefined;
  }
  return {
    alias: data.alias,
    hostName: data.hostName,
    ...(validProvenance(data.provenance) ? { provenance: { ...data.provenance } } : {}),
  };
}

function validProvenance(value: unknown): value is NativeMarketplaceSource {
  const data = asPlainObject(value);
  if (data === null) return false;
  if (typeof data.source !== "string" || data.source === "") return false;
  if (data.kind === "registry") return true;
  return (
    data.kind === "effective-list" &&
    typeof data.root === "string" &&
    data.root !== "" &&
    typeof data.sourceType === "string" &&
    data.sourceType !== ""
  );
}
