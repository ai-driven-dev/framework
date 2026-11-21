import { describe, expect, it } from "vitest";
import { JsonParseError } from "../../../../src/shared/domain/errors/json-parse-error.js";

describe("JsonParseError", () => {
  it("includes the path and cause in the message", () => {
    const error = new JsonParseError("/some/file.json", "Unexpected token");
    expect(error.name).toBe("JsonParseError");
    expect(error.message).toContain("/some/file.json");
    expect(error.message).toContain("Unexpected token");
  });

  it("says exactly what went wrong", () => {
    const error = new JsonParseError("/f.json", "Unexpected token");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "JsonParseError",
      message: "Cannot parse existing JSON at /f.json: Unexpected token",
    });
  });

  it("carries its stable code", () => {
    expect(new JsonParseError("/f.json", "Unexpected token").code).toBe("json-parse");
  });
});
