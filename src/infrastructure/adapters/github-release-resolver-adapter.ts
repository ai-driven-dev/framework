import {
  AuthenticationError,
  CatalogFetchAuthError,
  CatalogFetchError,
} from "../../domain/errors.js";
import type { LatestReleaseResolver } from "../../domain/ports/latest-release-resolver.js";
import type { TokenProvider } from "../../domain/ports/token-provider.js";
import { HttpNotFoundError } from "../errors.js";
import type { HttpClient } from "./http-client.js";

const GITHUB_API_BASE = "https://api.github.com";

export class GitHubReleaseResolverAdapter implements LatestReleaseResolver {
  constructor(
    private readonly http: HttpClient,
    private readonly tokenProvider?: TokenProvider
  ) {}

  async resolveLatest(repo: string): Promise<string | null> {
    const url = `${GITHUB_API_BASE}/repos/${repo}/releases/latest`;
    const token = (await this.tokenProvider?.resolve()) ?? undefined;
    try {
      const response = await this.http.get(url, { token });
      const body = response.body as Record<string, unknown>;
      return typeof body.tag_name === "string" ? body.tag_name : null;
    } catch (err) {
      return this.handleError(err, url);
    }
  }

  private handleError(err: unknown, url: string): never | null {
    if (err instanceof HttpNotFoundError) return null;
    if (err instanceof AuthenticationError) throw new CatalogFetchAuthError(url);
    const detail = err instanceof Error ? err.message : String(err);
    throw new CatalogFetchError(url, detail);
  }
}
