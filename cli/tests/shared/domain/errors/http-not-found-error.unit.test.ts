import { describe, expect, it } from "vitest";
import { HttpNotFoundError } from "../../../../src/shared/domain/errors/http-not-found-error.js";

describe("HttpNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new HttpNotFoundError("https://x");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "HttpNotFoundError",
      message: "Resource not found (HTTP 404): https://x",
    });
  });

  it("carries its stable code", () => {
    expect(new HttpNotFoundError("https://x").code).toBe("http-not-found");
  });

  it("carries the URL a 404 came from", () => {
    expect(new HttpNotFoundError("https://x/y").url).toBe("https://x/y");
  });
});
