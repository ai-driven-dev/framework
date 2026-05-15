import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  CatalogFetchAuthError,
  CatalogFetchError,
} from "../../../src/domain/errors.js";
import { GitHubReleaseResolverAdapter } from "../../../src/infrastructure/adapters/github-release-resolver-adapter.js";
import { HttpNotFoundError } from "../../../src/infrastructure/errors.js";

const REPO = "owner/repo";

function makeHttp(body: unknown, statusCode = 200) {
  return {
    get: vi.fn().mockResolvedValue({ body, statusCode, contentType: "application/json" }),
  };
}

function makeHttpThrowing(err: Error) {
  return { get: vi.fn().mockRejectedValue(err) };
}

describe("GitHubReleaseResolverAdapter", () => {
  describe("resolveLatest", () => {
    it("returns tag_name from first element on successful response with releases", async () => {
      const http = makeHttp([{ tag_name: "v1.2.3" }]);
      const adapter = new GitHubReleaseResolverAdapter(http as never);
      const result = await adapter.resolveLatest(REPO);
      expect(result).toBe("v1.2.3");
    });

    it("calls the correct GitHub releases?per_page=1 URL", async () => {
      const http = makeHttp([{ tag_name: "v1.0.0" }]);
      const tokenProvider = { resolve: async () => "my-token" as string | null };
      const adapter = new GitHubReleaseResolverAdapter(http as never, tokenProvider);
      await adapter.resolveLatest(REPO);
      expect(http.get).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/releases?per_page=1",
        { token: "my-token" }
      );
    });

    it("returns null when response body is an empty array", async () => {
      const http = makeHttp([]);
      const adapter = new GitHubReleaseResolverAdapter(http as never);
      const result = await adapter.resolveLatest(REPO);
      expect(result).toBeNull();
    });

    it("returns null when response body is not an array", async () => {
      const http = makeHttp({ message: "Not Found" });
      const adapter = new GitHubReleaseResolverAdapter(http as never);
      const result = await adapter.resolveLatest(REPO);
      expect(result).toBeNull();
    });

    it("returns null on HTTP 404 (no releases)", async () => {
      const http = makeHttpThrowing(
        new HttpNotFoundError("https://api.github.com/repos/owner/repo/releases/latest")
      );
      const adapter = new GitHubReleaseResolverAdapter(http as never);
      const result = await adapter.resolveLatest(REPO);
      expect(result).toBeNull();
    });

    it("throws CatalogFetchAuthError on HTTP 401/403", async () => {
      const http = makeHttpThrowing(new AuthenticationError("HTTP 401"));
      const adapter = new GitHubReleaseResolverAdapter(http as never);
      await expect(adapter.resolveLatest(REPO)).rejects.toThrow(CatalogFetchAuthError);
    });

    it("throws CatalogFetchError on network error", async () => {
      const http = makeHttpThrowing(new Error("ECONNREFUSED"));
      const adapter = new GitHubReleaseResolverAdapter(http as never);
      await expect(adapter.resolveLatest(REPO)).rejects.toThrow(CatalogFetchError);
    });
  });
});
