import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  CatalogFetchAuthError,
  CatalogFetchError,
  HttpNotFoundError,
} from "../../../src/shared/domain/errors.js";
import { GitHubAdapter } from "../../../src/shared/infrastructure/github-adapter.js";
import type { HttpGet } from "../../../src/shared/ports/http-get.js";

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

describe("GitHubAdapter", () => {
  describe("listReleaseTags", () => {
    it("lists every tag, component tags included, and leaves the root rule to the domain", async () => {
      const http = makeHttp([
        { tag_name: "aidd-refine-v1.0.0" },
        { tag_name: "aidd-context-v1.0.0" },
        { tag_name: "v4.0.0" },
        { tag_name: "v3.9.1" },
        { tag_name: "v3.7.3-pm.1" },
      ]);
      const adapter = new GitHubAdapter(http);
      const result = await adapter.listReleaseTags(REPO);
      expect(result).toEqual([
        "aidd-refine-v1.0.0",
        "aidd-context-v1.0.0",
        "v4.0.0",
        "v3.9.1",
        "v3.7.3-pm.1",
      ]);
    });

    it("requests per_page=100 so root tags are not buried", async () => {
      const http = makeHttp([{ tag_name: "v1.0.0" }]);
      const adapter = new GitHubAdapter(http);
      await adapter.listReleaseTags(REPO);
      expect(http.get).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/releases?per_page=100",
        { token: undefined }
      );
    });

    it("returns empty array when repo has no releases (404)", async () => {
      const http = makeHttpThrowing(
        new HttpNotFoundError("https://api.github.com/repos/owner/repo/releases")
      );
      const adapter = new GitHubAdapter(http);
      const result = await adapter.listReleaseTags(REPO);
      expect(result).toEqual([]);
    });

    it("throws CatalogFetchAuthError on HTTP 401/403", async () => {
      const http = makeHttpThrowing(new AuthenticationError("HTTP 401"));
      const adapter = new GitHubAdapter(http);
      await expect(adapter.listReleaseTags(REPO)).rejects.toThrow(CatalogFetchAuthError);
    });

    it("throws CatalogFetchError on network error", async () => {
      const http = makeHttpThrowing(new Error("ECONNREFUSED"));
      const adapter = new GitHubAdapter(http);
      await expect(adapter.listReleaseTags(REPO)).rejects.toThrow(CatalogFetchError);
    });
  });

  describe("isRepoPublic", () => {
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
