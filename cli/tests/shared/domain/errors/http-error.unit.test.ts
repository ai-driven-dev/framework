import { describe, expect, it } from "vitest";
import { HttpError } from "../../../../src/shared/domain/errors/http-error.js";

describe("HttpError", () => {
  it("says exactly what went wrong", () => {
    const error = new HttpError(500, "https://x");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "HttpError",
      message: "Unexpected HTTP 500 from https://x",
    });
  });

  it("carries its stable code", () => {
    expect(new HttpError(500, "https://x").code).toBe("http");
  });

  it("carries the status code and the URL an HTTP failure came from", () => {
    const error = new HttpError(503, "https://x/y");
    expect({ statusCode: error.statusCode, url: error.url }).toStrictEqual({
      statusCode: 503,
      url: "https://x/y",
    });
  });
});
