import { describe, expect, it, type Mock, vi } from "vitest";
import {
  AuthenticationError,
  CatalogFetchAuthError,
  CatalogFetchError,
  CatalogFetchNotFoundError,
  HttpNotFoundError,
} from "../../../src/shared/domain/errors.js";
import { GitHubAdapter } from "../../../src/shared/infrastructure/github-adapter.js";

const CATALOG_PATH = ".claude-plugin/marketplace.json";
const SAMPLE_CATALOG = JSON.stringify({ plugins: [] });

function makeHttp(override: Partial<{ get: Mock }> = {}) {
  return {
    get:
      override.get ??
      vi.fn().mockResolvedValue({
        body: Buffer.from(SAMPLE_CATALOG),
        statusCode: 200,
        contentType: "application/json",
      }),
  };
}

describe("GitHubAdapter", () => {
  describe("fetchCatalog", () => {
    it("returns the catalog body on HTTP 200", async () => {
      const http = makeHttp();
      const adapter = new GitHubAdapter(http);

      const result = await adapter.fetchCatalog(
        { kind: "github", repo: "owner/repo" },
        CATALOG_PATH
      );

      expect(result).toBe(SAMPLE_CATALOG);
    });

    it("calls GitHub Contents API with correct URL and auth header", async () => {
      const http = makeHttp();
      const tokenProvider = { resolve: async () => "my-token" as string | null };
      const adapter = new GitHubAdapter(http, { tokenProvider });

      await adapter.fetchCatalog({ kind: "github", repo: "owner/repo", ref: "main" }, CATALOG_PATH);

      expect(http.get).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/contents/.claude-plugin/marketplace.json?ref=main",
        { token: "my-token", accept: "application/vnd.github.raw" }
      );
    });

    it("uses HEAD as ref when none specified", async () => {
      const http = makeHttp();
      const adapter = new GitHubAdapter(http);

      await adapter.fetchCatalog({ kind: "github", repo: "owner/repo" }, CATALOG_PATH);

      expect(http.get).toHaveBeenCalledWith(
        expect.stringContaining("?ref=HEAD"),
        expect.anything()
      );
    });

    it("throws CatalogFetchNotFoundError on HTTP 404", async () => {
      const http = makeHttp({
        get: vi.fn().mockRejectedValue(new HttpNotFoundError("https://api.github.com/...")),
      });
      const adapter = new GitHubAdapter(http);

      await expect(
        adapter.fetchCatalog({ kind: "github", repo: "owner/repo" }, CATALOG_PATH)
      ).rejects.toThrow(CatalogFetchNotFoundError);
    });

    it("throws CatalogFetchAuthError on HTTP 401/403", async () => {
      const http = makeHttp({
        get: vi.fn().mockRejectedValue(new AuthenticationError("HTTP 403")),
      });
      const adapter = new GitHubAdapter(http);

      await expect(
        adapter.fetchCatalog({ kind: "github", repo: "owner/repo" }, CATALOG_PATH)
      ).rejects.toThrow(CatalogFetchAuthError);
    });

    it("throws CatalogFetchError on network error", async () => {
      const http = makeHttp({
        get: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      });
      const adapter = new GitHubAdapter(http);

      await expect(
        adapter.fetchCatalog({ kind: "github", repo: "owner/repo" }, CATALOG_PATH)
      ).rejects.toThrow(CatalogFetchError);
    });
  });
});
