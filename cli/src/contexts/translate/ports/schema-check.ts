import type { SchemaName } from "../../../shared/domain/reading/config-asset.js";

/** Checks data against a named JSON schema, throwing `JsonSchemaValidationError` on failure. */
export interface SchemaCheck {
  validate(name: SchemaName, data: unknown): void;
}
