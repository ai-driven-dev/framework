import { describe, expect, it } from "vitest";
import { HttpRedirectError } from "../../../../src/shared/domain/errors/http-redirect-error.js";

describe("HttpRedirectError", () => {
  it("includes the URL in the message and sets error name", () => {
    const error = new HttpRedirectError("https://example.com/redirect");
    expect(error.name).toBe("HttpRedirectError");
    expect(error.message).toContain("https://example.com/redirect");
    expect(error.url).toBe("https://example.com/redirect");
  });

  it("says exactly what went wrong", () => {
    const error = new HttpRedirectError("https://x");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "HttpRedirectError",
      message: "HTTP redirect without location header from https://x",
    });
  });

  it("carries its stable code", () => {
    expect(new HttpRedirectError("https://x").code).toBe("http-redirect");
  });
});
