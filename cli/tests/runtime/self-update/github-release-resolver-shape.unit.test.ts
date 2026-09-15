import { describe, expect, it } from "vitest";
import type { HttpGet, HttpGetOptions } from "../../../src/runtime/http/http-client.js";
import { GitHubReleaseResolverAdapter } from "../../../src/runtime/self-update/github-release-resolver-adapter.js";

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

describe("GitHubReleaseResolverAdapter, the shape of an answer", () => {
  it("resolves no latest when the first release names no tag", async () => {
    const adapter = new GitHubReleaseResolverAdapter(http([{ tag_name: 7 }]));

    expect(await adapter.resolveLatest("o/r")).toBeNull();
  });

  it("lists no root release when the body is not a list", async () => {
    const adapter = new GitHubReleaseResolverAdapter(http({ message: "rate limited" }));

    expect(await adapter.listRootReleases("o/r")).toStrictEqual([]);
  });

  it("keeps only tags that are text", async () => {
    const adapter = new GitHubReleaseResolverAdapter(
      http([{ tag_name: 7 }, { tag_name: "v1.0.0" }])
    );

    expect(await adapter.listRootReleases("o/r")).toStrictEqual(["v1.0.0"]);
  });

  it("lists releases with the token it was given", async () => {
    const client = http([]);
    const adapter = new GitHubReleaseResolverAdapter(client, { resolve: async () => "tok" });

    await adapter.listRootReleases("o/r");

    expect(client.calls).toStrictEqual([
      { url: "https://api.github.com/repos/o/r/releases?per_page=100", options: { token: "tok" } },
    ]);
  });

  it("resolves the latest with the token it was given", async () => {
    const client = http([]);
    const adapter = new GitHubReleaseResolverAdapter(client, { resolve: async () => "tok" });

    await adapter.resolveLatest("o/r");

    expect(client.calls).toStrictEqual([
      { url: "https://api.github.com/repos/o/r/releases?per_page=1", options: { token: "tok" } },
    ]);
  });
});
