import { AiddError } from "./aidd-error.js";

export class JsonSchemaValidationError extends AiddError {
  readonly code = "json-schema-validation";
  constructor(errors: string[]) {
    super(`Manifest validation failed: ${errors.join("; ")}`);
    this.name = "JsonSchemaValidationError";
  }
}
