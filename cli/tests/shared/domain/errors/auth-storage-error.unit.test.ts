import { describe, expect, it } from "vitest";
import { AuthStorageError } from "../../../../src/shared/domain/errors/auth-storage-error.js";

describe("AuthStorageError", () => {
  it("carries the provided message", () => {
    const error = new AuthStorageError("Failed to write auth file");
    expect(error.name).toBe("AuthStorageError");
    expect(error.message).toBe("Failed to write auth file");
  });

  it("says exactly what went wrong", () => {
    const error = new AuthStorageError("no write");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AuthStorageError",
      message: "no write",
    });
  });

  it("carries its stable code", () => {
    expect(new AuthStorageError("no write").code).toBe("auth-storage");
  });
});
