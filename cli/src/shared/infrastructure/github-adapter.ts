import {
  AuthenticationError,
  CatalogFetchAuthError,
  CatalogFetchError,
  CatalogFetchNotFoundError,
  HttpNotFoundError,
} from "../domain/errors.js";
import { asPlainObject } from "../domain/reading/plain-object.js";
import type { PluginSourceGitHub } from "../domain/source.js";
import type { HttpGet } from "../ports/http-get.js";

const DEFAULT_API_BASE = "https://api.github.com";
const RAW_ACCEPT = "application/vnd.github.raw";

interface GitHubAdapterConfig {
  apiBase?: string;
  /** The token read for each authenticated call; `null` or no provider sends none. */
  tokenProvider?: { resolve(): Promise<string | null> };
}

/**
 * The one place the GitHub API is spoken. It satisfies by shape the ports of the contexts that
 * read from GitHub: the identity check, the release listing, the repository visibility and the
 * raw catalog read.
 */
export class GitHubAdapter {
  private readonly apiBase: string;
  private readonly tokenProvider: GitHubAdapterConfig["tokenProvider"];

  constructor(
    private readonly http: HttpGet,
    config: GitHubAdapterConfig = {}
  ) {
    this.apiBase = config.apiBase ?? DEFAULT_API_BASE;
    this.tokenProvider = config.tokenProvider;
  }

  async verifyToken(token: string): Promise<string> {
    const response = await this.http.get(`${this.apiBase}/user`, { token }).catch(() => {
      // HTTP errors may carry request credentials; expose only the authentication failure.
      throw new AuthenticationError("GitHub API");
    });
    const body = response.body;
    if (
      response.statusCode < 200 ||
      response.statusCode >= 300 ||
      typeof body !== "object" ||
      body === null ||
      !("login" in body) ||
      typeof body.login !== "string" ||
      body.login.trim().length === 0
    ) {
      throw new AuthenticationError("GitHub API");
    }
    return body.login;
  }

  async listReleaseTags(repo: string): Promise<string[]> {
    // `per_page=100`, GitHub's maximum, so root tags are not buried under release-please's
    // per-component tags on a busy repository.
    const url = `${this.apiBase}/repos/${repo}/releases?per_page=100`;
    const token = (await this.tokenProvider?.resolve()) ?? undefined;
    try {
      const response = await this.http.get(url, { token });
      const body = response.body;
      if (!Array.isArray(body)) return [];
      return body
        .map((r) => asPlainObject(r)?.tag_name)
        .filter((t): t is string => typeof t === "string");
    } catch (err) {
      if (err instanceof HttpNotFoundError) return [];
      this.rethrowAsCatalogError(err, url);
    }
  }

  async readReleaseBody(repo: string, tag: string): Promise<string | null> {
    const url = `${this.apiBase}/repos/${repo}/releases/tags/${tag}`;
    const token = (await this.tokenProvider?.resolve()) ?? undefined;
    try {
      const response = await this.http.get(url, { token });
      const body = response.body;
      const notes = typeof body === "object" && body !== null && "body" in body ? body.body : null;
      return typeof notes === "string" ? notes : null;
    } catch (err) {
      if (err instanceof HttpNotFoundError) return null;
      this.rethrowAsCatalogError(err, url);
    }
  }

  async isRepoPublic(repo: string): Promise<boolean> {
    // Deliberately tokenless: only a 404 unambiguously means "auth required", so any other
    // error resolves true and a rate-limited or offline public user is not sent to login.
    const url = `${this.apiBase}/repos/${repo}`;
    try {
      await this.http.get(url);
      return true;
    } catch (err) {
      return !(err instanceof HttpNotFoundError);
    }
  }

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
    return `${this.apiBase}/repos/${repo}/contents/${catalogPath}?ref=${ref}`;
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
      if (err instanceof HttpNotFoundError) throw new CatalogFetchNotFoundError(url);
      this.rethrowAsCatalogError(err, url);
    }
  }

  private rethrowAsCatalogError(err: unknown, url: string): never {
    if (err instanceof AuthenticationError) throw new CatalogFetchAuthError(url);
    const detail = err instanceof Error ? err.message : String(err);
    throw new CatalogFetchError(url, detail);
  }
}
