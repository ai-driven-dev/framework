import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  CatalogFetchAuthError,
  CatalogFetchError,
  HttpNotFoundError,
} from "../../../src/shared/domain/shared.error.js";
import { GitHubAdapter } from "../../../src/shared/infrastructure/github-adapter.js";
import { HttpClient } from "../../../src/shared/infrastructure/http-client.js";
import type { HttpGet } from "../../../src/shared/ports/http-get.js";
import { PRIVATE_TOKEN, startLocalReleases } from "../testing/local-releases-server.builder.js";
import {
  NOTES,
  NOTES_TAG,
  PRIVATE_REPO,
  RELEASE_TAGS,
} from "../testing/run-release-lister.contract.js";

const REPO = "owner/repo";

function makeHttp(body: unknown, statusCode = 200) {
  const get = vi
    .fn<HttpGet["get"]>()
    .mockResolvedValue({ body, statusCode, contentType: "application/json" });
  return { get } satisfies HttpGet;
}

function makeHttpThrowing(err: Error) {
  const get = vi.fn<HttpGet["get"]>().mockRejectedValue(err);
  return { get } satisfies HttpGet;
}

describe("reading releases from GitHub", () => {
  describe("a repository that needs credentials", () => {
    it("lists and reads releases with the token the provider resolves", async () => {
      const { apiBase, close } = await startLocalReleases();
      try {
        const adapter = new GitHubAdapter(new HttpClient(), {
          apiBase,
          tokenProvider: { resolve: async () => PRIVATE_TOKEN },
        });

        expect(await adapter.listReleaseTags(PRIVATE_REPO)).toEqual(RELEASE_TAGS);
        expect(await adapter.readReleaseBody(PRIVATE_REPO, NOTES_TAG)).toBe(NOTES);
      } finally {
        await close();
      }
    });

    it("refuses when the provider has no token to send", async () => {
      const { apiBase, close } = await startLocalReleases();
      try {
        const adapter = new GitHubAdapter(new HttpClient(), {
          apiBase,
          tokenProvider: { resolve: async () => null },
        });

        await expect(adapter.listReleaseTags(PRIVATE_REPO)).rejects.toThrow(CatalogFetchAuthError);
      } finally {
        await close();
      }
    });
  });

  describe("a forge that does not answer", () => {
    it("throws CatalogFetchError, for the listing and for the notes alike", async () => {
      const { apiBase, close } = await startLocalReleases();
      await close();
      const adapter = new GitHubAdapter(new HttpClient(), { apiBase });

      await expect(adapter.listReleaseTags(REPO)).rejects.toThrow(CatalogFetchError);
      await expect(adapter.readReleaseBody(REPO, "v1.0.0")).rejects.toThrow(CatalogFetchError);
    });
  });

  describe("asking whether a repository is public", () => {
    it("returns true when the unauthenticated repo request succeeds (public)", async () => {
      const http = makeHttp({ full_name: REPO, private: false });
      const adapter = new GitHubAdapter(http);
      expect(await adapter.isRepoPublic(REPO)).toBe(true);
      expect(http.get).toHaveBeenCalledWith("https://api.github.com/repos/owner/repo");
    });

    it("returns false on 404 (private or non-existent repo)", async () => {
      const http = makeHttpThrowing(
        new HttpNotFoundError("https://api.github.com/repos/owner/repo")
      );
      const adapter = new GitHubAdapter(http);
      expect(await adapter.isRepoPublic(REPO)).toBe(false);
    });

    it("returns true on non-404 errors so a rate-limited public user is not gated", async () => {
      const http = makeHttpThrowing(new AuthenticationError("HTTP 403 rate limit"));
      const adapter = new GitHubAdapter(http);
      expect(await adapter.isRepoPublic(REPO)).toBe(true);
    });
  });
});
