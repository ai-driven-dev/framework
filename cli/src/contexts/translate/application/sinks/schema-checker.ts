import type { SchemaName } from "../../../../shared/domain/reading/config-asset.js";
import type { JsonSchemaValidator } from "../../ports/json-schema-validator.js";
import type { SchemaCheck } from "../../ports/schema-check.js";
import type { SchemaProvider } from "../../ports/schema-provider.js";

/** Checks data against the bundled schema of that name. */
export class SchemaChecker implements SchemaCheck {
  constructor(
    private readonly validator: JsonSchemaValidator,
    private readonly schemas: SchemaProvider
  ) {}

  validate(name: SchemaName, data: unknown): void {
    this.validator.validate(this.schemas.loadSchema(name), data);
  }
}
