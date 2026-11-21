import { describe, expect, it, type Mock, vi } from "vitest";
import { CatalogFetchError } from "../../../src/shared/domain/shared.error.js";
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
    it("calls GitHub Contents API with correct URL and auth header", async () => {
      const http = makeHttp();
      const tokenProvider = { resolve: async (): Promise<string | null> => "my-token" };
      const adapter = new GitHubAdapter(http, { tokenProvider });

      await adapter.fetchCatalog({ kind: "github", repo: "owner/repo", ref: "main" }, CATALOG_PATH);

      expect(http.get).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/contents/.claude-plugin/marketplace.json?ref=main",
        { token: "my-token", accept: "application/vnd.github.raw" }
      );
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
