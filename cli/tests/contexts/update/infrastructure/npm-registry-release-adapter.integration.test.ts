import { describe, expect, it } from "vitest";
import { NpmRegistryReleaseAdapter } from "../../../../src/contexts/update/infrastructure/npm-registry-release-adapter.js";
import { FrameworkResolutionError } from "../../../../src/kernel/errors.js";
import type { HttpGet, HttpGetOptions } from "../../../../src/shared/ports/http-get.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";

const NPM_URL = "https://registry.npmjs.org/-/package/@ai-driven-dev/cli/dist-tags";
// release-please tags this package `cli-v<semver>`, never a bare `v<semver>`.
const TAG_URL = "https://api.github.com/repos/ai-driven-dev/framework/releases/tags/cli-v1.2.3";

function http(answers: Record<string, unknown | Error>) {
  const calls: { url: string; options?: HttpGetOptions }[] = [];
  const client: HttpGet = {
    get: async (url, options) => {
      calls.push({ url, options });
      const answer = answers[url];
      if (answer instanceof Error) throw answer;
      if (!(url in answers)) throw new Error("404");
      return { body: answer, statusCode: 200, contentType: "application/json" };
    },
  };
  return { client, calls };
}

describe("NpmRegistryReleaseAdapter", () => {
  it("asks npm for plain JSON, then GitHub for the tag with the token it was given", async () => {
    const { client, calls } = http({
      [NPM_URL]: { latest: "1.2.3" },
      [TAG_URL]: { body: "notes" },
    });
    const adapter = new NpmRegistryReleaseAdapter(client, {
      tokenProvider: { resolve: async () => "tok" },
    });

    await adapter.fetchLatestRelease();

    expect(calls).toStrictEqual([
      { url: NPM_URL, options: { accept: "application/json" } },
      { url: TAG_URL, options: { token: "tok" } },
    ]);
  });

  it("asks the bases it was given instead of the public ones", async () => {
    const { client, calls } = http({});
    await new NpmRegistryReleaseAdapter(client, { npmRegistryBase: "http://npm.test" })
      .fetchLatestRelease()
      .catch(() => undefined);

    expect(calls[0]?.url).toBe("http://npm.test/-/package/@ai-driven-dev/cli/dist-tags");
  });

  it("refuses a registry answer that is not an object", async () => {
    const { client } = http({ [NPM_URL]: null });

    await expect(new NpmRegistryReleaseAdapter(client).fetchLatestRelease()).rejects.toThrow(
      new FrameworkResolutionError(`Unexpected npm registry response from ${NPM_URL}`)
    );
  });

  it("wraps a transport failure with the URL it was reading", async () => {
    const { client } = http({ [NPM_URL]: new Error("socket hang up") });

    await expect(new NpmRegistryReleaseAdapter(client).fetchLatestRelease()).rejects.toThrow(
      new FrameworkResolutionError(
        `Could not resolve the latest CLI version from ${NPM_URL}: socket hang up`
      )
    );
  });

  it("says why the changelog is missing, on the debug channel", async () => {
    const logger = new CapturingLogger();
    const { client } = http({ [NPM_URL]: { latest: "1.2.3" }, [TAG_URL]: new Error("offline") });

    await new NpmRegistryReleaseAdapter(client, { logger }).fetchLatestRelease();

    expect(logger.debugMessages).toStrictEqual([`Changelog unavailable from ${TAG_URL}: offline`]);
  });
});
