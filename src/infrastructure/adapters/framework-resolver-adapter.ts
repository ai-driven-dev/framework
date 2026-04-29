import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FrameworkResolutionError, NoFrameworkSourceError } from "../../domain/errors.js";
import type { PluginSource } from "../../domain/models/plugin-source.js";
import {
  GITHUB_REPO_REGEX,
  parsePluginSourceShorthand,
} from "../../domain/models/plugin-source.js";
import type {
  FrameworkResolved,
  FrameworkResolver,
  FrameworkResolverOptions,
} from "../../domain/ports/framework-resolver.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { PluginFetcher } from "../../domain/ports/plugin-fetcher.js";
import type { FrameworkCache } from "../cache/framework-cache.js";
import type { HttpClient } from "../http/http-client.js";
import type { TarExtractor } from "../tar/tar-extractor.js";

interface GithubRelease {
  tag_name: string;
  assets: Array<{ id: number; name: string }>;
}

function parseGithubRelease(body: unknown, url: string): GithubRelease {
  if (
    body === null ||
    typeof body !== "object" ||
    !("tag_name" in body) ||
    typeof (body as Record<string, unknown>).tag_name !== "string" ||
    !Array.isArray((body as Record<string, unknown>).assets)
  ) {
    throw new FrameworkResolutionError(`Unexpected GitHub API response from ${url}`);
  }
  return body as GithubRelease;
}

interface FrameworkResolverAdapterConfig {
  defaultRepo: string;
  defaultToken?: string;
  githubApiBase?: string;
  gitFetcher: PluginFetcher;
  gitCacheDir: string;
}

const DEFAULT_GITHUB_API_BASE = "https://api.github.com";

export class FrameworkResolverAdapter implements FrameworkResolver {
  private readonly defaultRepo: string;
  private readonly defaultToken: string | undefined;
  private readonly githubApiBase: string;
  private readonly gitFetcher: PluginFetcher;
  private readonly gitCacheDir: string;

  constructor(
    private readonly http: HttpClient,
    private readonly tar: TarExtractor,
    private readonly cache: FrameworkCache,
    config: FrameworkResolverAdapterConfig,
    private readonly logger?: Logger
  ) {
    this.defaultRepo = config.defaultRepo;
    this.defaultToken = config.defaultToken;
    this.githubApiBase = config.githubApiBase ?? DEFAULT_GITHUB_API_BASE;
    this.gitFetcher = config.gitFetcher;
    this.gitCacheDir = config.gitCacheDir;
  }

  async resolve(options: FrameworkResolverOptions): Promise<FrameworkResolved> {
    if (options.localPath) {
      try {
        await stat(options.localPath);
      } catch {
        throw new FrameworkResolutionError(`Framework path does not exist: ${options.localPath}`);
      }
      const version = await readVersionFile(options.localPath);
      return { path: options.localPath, version, source: "local" };
    }

    if (options.tarballPath) {
      const path = await this.resolveLocalTarball(options.tarballPath);
      const version = await readVersionFile(path);
      return { path, version, source: "local" };
    }

    // No local source — check remote is configured
    const repo = options.repo ?? this.defaultRepo;
    if (!repo) throw new NoFrameworkSourceError();
    return this.resolveRemote(options);
  }

  async fetchLatestVersion(repo?: string): Promise<string> {
    const effectiveRepo = repo ?? this.defaultRepo;
    if (!GITHUB_REPO_REGEX.test(effectiveRepo)) {
      throw new FrameworkResolutionError(
        "Version check is not supported for git-cloned framework sources. Pin a specific ref via --version."
      );
    }
    const release = await this.fetchLatestRelease(effectiveRepo, this.defaultToken);
    return release.tag_name;
  }

  getDefaultRepo(): string | undefined {
    return this.defaultRepo || undefined;
  }

  private async resolveLocalTarball(tarballPath: string): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), "aidd-extract-"));
    try {
      return await this.tar.extract(tarballPath, tempDir);
    } catch (error) {
      await rm(tempDir, { recursive: true, force: true });
      throw error;
    }
  }

  private async resolveRemote(options: FrameworkResolverOptions): Promise<FrameworkResolved> {
    const repo = options.repo ?? this.defaultRepo;
    const source = parsePluginSourceShorthand(repo);
    if (source.kind === "github") {
      return this.resolveRemoteViaGitHub(options);
    }
    return this.resolveViaGitClone(source, options.version);
  }

  private async resolveRemoteViaGitHub(
    options: FrameworkResolverOptions
  ): Promise<FrameworkResolved> {
    const repo = options.repo ?? this.defaultRepo;
    const token = options.token ?? this.defaultToken;
    const normalizedTag = this.normalizeTag(options.version);
    const release = await this.tryFetchRelease(repo, normalizedTag, token);
    return this.serveFromReleaseOrCache(repo, release, token);
  }

  private normalizeTag(version?: string): string | undefined {
    if (!version) return undefined;
    if (version === "latest") return undefined;
    return version.startsWith("v") ? version : `v${version}`;
  }

  private async tryFetchRelease(
    repo: string,
    normalizedTag: string | undefined,
    token?: string
  ): Promise<GithubRelease | null> {
    try {
      return normalizedTag
        ? await this.fetchReleaseByTag(repo, normalizedTag, token)
        : await this.fetchLatestRelease(repo, token);
    } catch (error) {
      if (normalizedTag) {
        this.throwTagNotFound(normalizedTag, error);
      }
      return null;
    }
  }

  private throwTagNotFound(normalizedTag: string, error: unknown): never {
    const cause = error instanceof Error ? error.message : String(error);
    // GitHub returns HTTP 404 for private repos when unauthenticated, not 401/403.
    // Token resolution order: --token flag > AIDD_TOKEN env > gh auth token.
    // Run `gh auth status` to verify gh CLI authentication.
    const authHint = cause.includes("HTTP 404")
      ? " The repository may be private — authenticate via gh CLI, or provide a token via --token or AIDD_TOKEN."
      : "";
    throw new FrameworkResolutionError(
      `Framework release not found: ${normalizedTag}. ${cause}.${authHint}`
    );
  }

  private async serveFromReleaseOrCache(
    repo: string,
    release: GithubRelease | null,
    token?: string
  ): Promise<FrameworkResolved> {
    if (release !== null) {
      const version = release.tag_name.replace(/^v/, "");
      if (await this.cache.has(version)) {
        this.logger?.debug(`Using cached framework v${version}`);
        return { path: this.cache.get(version), version, source: "cache" };
      }
      this.logger?.debug(`Downloading framework v${version}...`);
      const path = await this.downloadAndCache(repo, release, version, token);
      return { path, version, source: "download" };
    }
    return this.fallbackToCache();
  }

  private async fallbackToCache(): Promise<FrameworkResolved> {
    const cachedVersion = await this.cache.getLatestCached();
    if (cachedVersion !== null) {
      this.logger?.warn(`Network unavailable. Using cached framework v${cachedVersion}.`);
      return { path: this.cache.get(cachedVersion), version: cachedVersion, source: "cache" };
    }
    throw new FrameworkResolutionError(
      "Cannot reach the framework source. Check your network connection."
    );
  }

  private applyRef(source: PluginSource, ref?: string): PluginSource {
    if (!ref || source.kind === "local" || source.kind === "npm") return source;
    return { ...source, ref };
  }

  private async resolveViaGitClone(source: PluginSource, ref?: string): Promise<FrameworkResolved> {
    const sourcedWithRef = this.applyRef(source, ref);
    const path = await this.gitFetcher.fetch(sourcedWithRef, this.gitCacheDir);
    const version = await readVersionFile(path);
    return { path, version, source: "git" };
  }

  private async fetchLatestRelease(repo: string, token?: string): Promise<GithubRelease> {
    const url = `${this.githubApiBase}/repos/${repo}/releases/latest`;
    const response = await this.http.get(url, { token });
    return parseGithubRelease(response.body, url);
  }

  private async fetchReleaseByTag(
    repo: string,
    tag: string,
    token?: string
  ): Promise<GithubRelease> {
    const url = `${this.githubApiBase}/repos/${repo}/releases/tags/${tag}`;
    const response = await this.http.get(url, { token });
    return parseGithubRelease(response.body, url);
  }

  private async downloadAndCache(
    repo: string,
    release: GithubRelease,
    version: string,
    token?: string
  ): Promise<string> {
    const assetId = this.findTarballAssetId(release);
    const assetUrl = `${this.githubApiBase}/repos/${repo}/releases/assets/${assetId}`;
    this.logger?.debug(`Asset URL: ${assetUrl}`);

    const response = await this.http.get(assetUrl, { token, accept: "application/octet-stream" });
    if (!Buffer.isBuffer(response.body)) {
      throw new FrameworkResolutionError("Downloaded file is not a valid tarball");
    }

    const tempDir = await mkdtemp(join(tmpdir(), "aidd-download-"));
    const tarballPath = join(tempDir, `aidd-framework-${version}.tar.gz`);

    try {
      await writeFile(tarballPath, response.body);

      const extractDir = await mkdtemp(join(tmpdir(), "aidd-extract-"));
      try {
        this.logger?.debug("Extracting framework...");
        const frameworkRoot = await this.tar.extract(tarballPath, extractDir);
        await this.cache.put(version, frameworkRoot);
        return this.cache.get(version);
      } finally {
        await rm(extractDir, { recursive: true, force: true });
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private findTarballAssetId(release: GithubRelease): number {
    const tarball = release.assets.find(
      (a) =>
        a.name.startsWith("aidd-framework") &&
        (a.name.endsWith(".tar.gz") || a.name.endsWith(".tgz"))
    );
    if (!tarball) {
      throw new FrameworkResolutionError(
        `No tarball asset found in release ${release.tag_name}. Assets: ${release.assets.map((a) => a.name).join(", ")}`
      );
    }
    return tarball.id;
  }
}

async function readVersionFile(frameworkPath: string): Promise<string> {
  try {
    const content = await readFile(join(frameworkPath, "version.txt"), "utf-8");
    return content.trim();
  } catch {
    return "local";
  }
}
