import {
  AuthenticationError,
  CatalogFetchAuthError,
  CatalogFetchError,
  CatalogFetchNotFoundError,
  HttpNotFoundError,
} from "../../../shared/domain/errors.js";
import type { PluginSourceGitHub } from "../../../shared/domain/source.js";
import type { HttpGet } from "../../../shared/ports/http-get.js";
import type { TokenProvider } from "../../auth/contract/token-provider.js";
import type { RawCatalogFetcher } from "../ports/raw-catalog-fetcher.js";

const GITHUB_API_BASE = "https://api.github.com";
const RAW_ACCEPT = "application/vnd.github.raw";

export class GitHubRawFetcherAdapter implements RawCatalogFetcher {
  constructor(
    private readonly http: HttpGet,
    private readonly tokenProvider?: TokenProvider
  ) {}

  async fetchCatalog(source: PluginSourceGitHub, catalogPath: string): Promise<string> {
    const ref = source.ref ?? "HEAD";
    try {
      return await this.fetchRaw(this.buildContentsUrl(source.repo, catalogPath, ref));
    } catch (err) {
      if (ref === "HEAD" || !(err instanceof CatalogFetchNotFoundError)) throw err;
      return this.fetchRaw(this.buildContentsUrl(source.repo, catalogPath, "HEAD"));
    }
  }

  private buildContentsUrl(repo: string, catalogPath: string, ref: string): string {
    return `${GITHUB_API_BASE}/repos/${repo}/contents/${catalogPath}?ref=${ref}`;
  }

  private async fetchRaw(url: string): Promise<string> {
    const token = (await this.tokenProvider?.resolve()) ?? undefined;
    try {
      const response = await this.http.get(url, {
        token,
        accept: RAW_ACCEPT,
      });
      const body = response.body;
      if (Buffer.isBuffer(body)) return body.toString("utf-8");
      return JSON.stringify(body);
    } catch (err) {
      this.classifyAndThrow(err, url);
    }
  }

  private classifyAndThrow(err: unknown, url: string): never {
    if (err instanceof HttpNotFoundError) throw new CatalogFetchNotFoundError(url);
    if (err instanceof AuthenticationError) throw new CatalogFetchAuthError(url);
    const detail = err instanceof Error ? err.message : String(err);
    throw new CatalogFetchError(url, detail);
  }
}
