import { describe, expect, it } from "vitest";
import { NpmRegistryReleaseAdapter } from "../../../../src/contexts/update/infrastructure/npm-registry-release-adapter.js";
import type { HttpGet, HttpGetOptions } from "../../../../src/shared/ports/http-get.js";
import type { ReleaseLister } from "../../../../src/shared/ports/release-lister.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { saying } from "../../../shared/testing/saying.builder.js";

const NPM_URL = "https://registry.npmjs.org/-/package/@ai-driven-dev/cli/dist-tags";

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

function releasesAnswering(answer: string | null | Error) {
  const asked: { repo: string; tag: string }[] = [];
  const releases: Pick<ReleaseLister, "readReleaseBody"> = {
    readReleaseBody: async (repo, tag) => {
      asked.push({ repo, tag });
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return { releases, asked };
}

describe("reading releases from the npm registry", () => {
  it("asks npm for plain JSON, then the releases for the notes of the cli tag", async () => {
    const { client, calls } = http({ [NPM_URL]: { latest: "1.2.3" } });
    const { releases, asked } = releasesAnswering("notes");

    const release = await new NpmRegistryReleaseAdapter(client, releases).fetchLatestRelease();

    expect(release).toStrictEqual({ version: "1.2.3", changelog: "notes" });
    expect(calls).toStrictEqual([{ url: NPM_URL, options: { accept: "application/json" } }]);
    // release-please tags this package `cli-v<semver>`, never a bare `v<semver>`.
    expect(asked).toStrictEqual([{ repo: "ai-driven-dev/framework", tag: "cli-v1.2.3" }]);
  });

  it("asks the bases it was given instead of the public ones", async () => {
    const { client, calls } = http({});
    await new NpmRegistryReleaseAdapter(client, releasesAnswering(null).releases, {
      npmRegistryBase: "http://npm.test",
    })
      .fetchLatestRelease()
      .catch(() => undefined);

    expect(calls[0]?.url).toBe("http://npm.test/-/package/@ai-driven-dev/cli/dist-tags");
  });

  it("refuses a registry answer that is not an object", async () => {
    const { client } = http({ [NPM_URL]: null });

    await expect(
      new NpmRegistryReleaseAdapter(client, releasesAnswering(null).releases).fetchLatestRelease()
    ).rejects.toThrow(
      expect.objectContaining({ detail: `Unexpected npm registry response from ${NPM_URL}` })
    );
  });

  it("wraps a transport failure with the URL it was reading", async () => {
    const { client } = http({ [NPM_URL]: new Error("socket hang up") });

    await expect(
      new NpmRegistryReleaseAdapter(client, releasesAnswering(null).releases).fetchLatestRelease()
    ).rejects.toThrow(
      saying(`Could not resolve the latest CLI version from ${NPM_URL}: socket hang up`)
    );
  });

  it("has no changelog when the release has no notes", async () => {
    const { client } = http({ [NPM_URL]: { latest: "1.2.3" } });

    const release = await new NpmRegistryReleaseAdapter(
      client,
      releasesAnswering(null).releases
    ).fetchLatestRelease();

    expect(release.changelog).toBeNull();
  });

  it("says why the changelog is missing, on the debug channel", async () => {
    const logger = new CapturingLogger();
    const { client } = http({ [NPM_URL]: { latest: "1.2.3" } });

    const release = await new NpmRegistryReleaseAdapter(
      client,
      releasesAnswering(new Error("offline")).releases,
      { logger }
    ).fetchLatestRelease();

    expect(release.changelog).toBeNull();
    expect(logger.debugMessages).toStrictEqual(["Changelog unavailable: offline"]);
  });
});
