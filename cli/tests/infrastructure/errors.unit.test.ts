import { describe, expect, it } from "vitest";
import {
  AuthStorageError,
  HttpRedirectError,
  JsonParseError,
} from "../../src/infrastructure/errors.js";

describe("HttpRedirectError", () => {
  it("includes the URL in the message and sets error name", () => {
    const error = new HttpRedirectError("https://example.com/redirect");
    expect(error.name).toBe("HttpRedirectError");
    expect(error.message).toContain("https://example.com/redirect");
    expect(error.url).toBe("https://example.com/redirect");
  });
});

describe("JsonParseError", () => {
  it("includes the path and cause in the message", () => {
    const error = new JsonParseError("/some/file.json", "Unexpected token");
    expect(error.name).toBe("JsonParseError");
    expect(error.message).toContain("/some/file.json");
    expect(error.message).toContain("Unexpected token");
  });
});

describe("AuthStorageError", () => {
  it("carries the provided message", () => {
    const error = new AuthStorageError("Failed to write auth file");
    expect(error.name).toBe("AuthStorageError");
    expect(error.message).toBe("Failed to write auth file");
  });
});
