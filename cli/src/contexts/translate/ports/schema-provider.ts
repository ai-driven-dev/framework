import type { SchemaName } from "../../../shared/domain/config-asset.js";

/** The JSON schemas a build validates its manifests and catalogs against. */
export interface SchemaProvider {
  loadSchema(name: SchemaName): object;
}
