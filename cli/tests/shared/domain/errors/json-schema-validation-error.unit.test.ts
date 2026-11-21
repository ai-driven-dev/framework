import { describe, expect, it } from "vitest";
import { JsonSchemaValidationError } from "../../../../src/shared/domain/errors/json-schema-validation-error.js";

describe("JsonSchemaValidationError", () => {
  it("says exactly what went wrong", () => {
    const error = new JsonSchemaValidationError(["a", "b"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "JsonSchemaValidationError",
      message: "Manifest validation failed: a; b",
    });
  });

  it("carries its stable code", () => {
    expect(new JsonSchemaValidationError(["a", "b"]).code).toBe("json-schema-validation");
  });
});
