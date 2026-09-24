import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../../../src/kernel/errors.js";
import { GhTokenAdapter } from "../../../src/runtime/auth/gh-token-adapter.js";
import type {
  HttpGet,
  HttpGetOptions,
  HttpResponse,
} from "../../../src/runtime/http/http-client.js";

function http(body: unknown): HttpGet & { calls: { url: string; options?: HttpGetOptions }[] } {
  const calls: { url: string; options?: HttpGetOptions }[] = [];
  return {
    calls,
    get: async (url, options): Promise<HttpResponse> => {
      calls.push({ url, options });
      return { body, statusCode: 200, contentType: "application/json" };
    },
  };
}

describe("GhTokenAdapter", () => {
  it("asks GitHub who the token belongs to, with the token", async () => {
    const client = http({ login: "octocat" });

    const login = await new GhTokenAdapter(client).verifyToken("ghp_x");

    expect({ login, calls: client.calls }).toStrictEqual({
      login: "octocat",
      calls: [{ url: "https://api.github.com/user", options: { token: "ghp_x" } }],
    });
  });

  it("refuses an answer carrying no login", async () => {
    await expect(new GhTokenAdapter(http({ id: 1 })).verifyToken("ghp_x")).rejects.toThrow(
      new AuthenticationError("GitHub API")
    );
  });
});
