import { describe, expect, it } from "vitest";
import { GitHubAdapter } from "../../../src/shared/infrastructure/github-adapter.js";
import type { HttpGet, HttpGetOptions } from "../../../src/shared/ports/http-get.js";

function http(body: unknown): HttpGet & { calls: { url: string; options?: HttpGetOptions }[] } {
  const calls: { url: string; options?: HttpGetOptions }[] = [];
  return {
    calls,
    get: async (url, options) => {
      calls.push({ url, options });
      return { body, statusCode: 200, contentType: "application/json" };
    },
  };
}

describe("GitHubAdapter, the shape of an answer", () => {
  it("lists no root release when the body is not a list", async () => {
    const adapter = new GitHubAdapter(http({ message: "rate limited" }));

    expect(await adapter.listReleaseTags("o/r")).toStrictEqual([]);
  });

  it("keeps only tags that are text", async () => {
    const adapter = new GitHubAdapter(http([{ tag_name: 7 }, { tag_name: "v1.0.0" }]));

    expect(await adapter.listReleaseTags("o/r")).toStrictEqual(["v1.0.0"]);
  });

  it("lists releases with the token it was given", async () => {
    const client = http([]);
    const adapter = new GitHubAdapter(client, { tokenProvider: { resolve: async () => "tok" } });

    await adapter.listReleaseTags("o/r");

    expect(client.calls).toStrictEqual([
      { url: "https://api.github.com/repos/o/r/releases?per_page=100", options: { token: "tok" } },
    ]);
  });
});
