import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../../../src/kernel/errors.js";
import { GhTokenAdapter } from "../../../src/runtime/auth/gh-token-adapter.js";
import type {
  HttpGet,
  HttpGetOptions,
  HttpResponse,
} from "../../../src/runtime/http/http-client.js";

function http(
  body: unknown,
  statusCode = 200
): HttpGet & { calls: { url: string; options?: HttpGetOptions }[] } {
  const calls: { url: string; options?: HttpGetOptions }[] = [];
  return {
    calls,
    get: async (url, options): Promise<HttpResponse> => {
      calls.push({ url, options });
      return { body, statusCode, contentType: "application/json" };
    },
  };
}

describe("GhTokenAdapter", () => {
  it("asks GitHub who the token belongs to, with the token", async () => {
    const client = http({ login: "octocat" });

    const login = await new GhTokenAdapter(client).verifyToken("ghp_x");

    expect(login).toBe("octocat");
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.url).toBe("https://api.github.com/user");
    expect(Object.keys(client.calls[0]?.options ?? {})).toEqual(["token"]);
    // Compare a boolean so a failed assertion cannot print the supplied credential.
    expect(client.calls[0]?.options?.token === "ghp_x").toBe(true);
  });

  it("refuses an answer carrying no login", async () => {
    await expect(new GhTokenAdapter(http({ id: 1 })).verifyToken("ghp_x")).rejects.toThrow(
      new AuthenticationError("GitHub API")
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["text", "octocat"],
    ["array", ["octocat"]],
    ["numeric login", { login: 42 }],
    ["null login", { login: null }],
    ["empty login", { login: "" }],
    ["blank login", { login: " " }],
  ])("refuses a malformed user response: %s", async (_label, body) => {
    const error: unknown = await new GhTokenAdapter(http(body))
      .verifyToken("ghp_x")
      .catch((error: unknown) => error);

    expect(error instanceof AuthenticationError).toBe(true);
  });

  it.each([199, 300, 401, 403, 404, 500])(
    "refuses HTTP %i even when the response carries a login",
    async (statusCode) => {
      await expect(
        new GhTokenAdapter(http({ login: "octocat" }, statusCode)).verifyToken("ghp_x")
      ).rejects.toThrow(new AuthenticationError("GitHub API"));
    }
  );

  it("reports a rejected request without exposing its token or underlying error", async () => {
    const token = "synthetic-private-credential";
    const client: HttpGet = {
      get: async () => {
        throw new Error(`Request failed for ${token}`);
      },
    };
    const error: unknown = await new GhTokenAdapter(client)
      .verifyToken(token)
      .catch((error: unknown) => error);

    expect(String(error).includes(token)).toBe(false);
    expect(error instanceof AuthenticationError).toBe(true);
    expect(String(error)).toBe(String(new AuthenticationError("GitHub API")));
    expect(error instanceof Error && error.cause === undefined).toBe(true);
  });
});
