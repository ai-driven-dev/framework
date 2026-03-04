import { writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  FrameworkResolver,
  FrameworkResolverOptions,
} from "../../domain/ports/framework-resolver.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { FrameworkCache } from "../cache/framework-cache.js";
import type { HttpClient } from "../http/http-client.js";
import type { TarExtractor } from "../tar/tar-extractor.js";

interface GithubRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

export interface FrameworkResolverAdapterConfig {
  defaultRepo: string;
  defaultToken?: string;
  githubApiBase?: string;
}

const DEFAULT_REPO = "ai-driven-dev/aidd-framework";
const DEFAULT_GITHUB_API_BASE = "https://api.github.com";

export class FrameworkResolverAdapter implements FrameworkResolver {
  private readonly defaultRepo: string;
  private readonly defaultToken: string | undefined;
  private readonly githubApiBase: string;

  constructor(
    private readonly http: HttpClient,
    private readonly tar: TarExtractor,
    private readonly cache: FrameworkCache,
    config?: FrameworkResolverAdapterConfig,
    private readonly logger?: Logger
  ) {
    this.defaultRepo = config?.defaultRepo ?? DEFAULT_REPO;
    this.defaultToken = config?.defaultToken;
    this.githubApiBase = config?.githubApiBase ?? DEFAULT_GITHUB_API_BASE;
  }

  async resolve(options: FrameworkResolverOptions): Promise<string> {
    if (options.localPath) {
      return options.localPath;
    }

    if (options.tarballPath) {
      return this.resolveLocalTarball(options.tarballPath);
    }

    return this.resolveRemote(options);
  }

  async getLatestVersion(): Promise<string | null> {
    try {
      const release = await this.fetchLatestRelease(this.defaultRepo, this.defaultToken);
      return release.tag_name;
    } catch {
      return null;
    }
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

  private async resolveRemote(options: FrameworkResolverOptions): Promise<string> {
    const repo = options.repo ?? this.defaultRepo;
    const token = options.token ?? this.defaultToken;

    let release: GithubRelease | null = null;
    let networkError: Error | null = null;

    try {
      release = await this.fetchLatestRelease(repo, token);
    } catch (error) {
      networkError = error instanceof Error ? error : new Error(String(error));
    }

    if (release !== null) {
      const version = release.tag_name.replace(/^v/, "");

      if (await this.cache.has(version)) {
        this.logger?.debug(`Cache hit for version ${version}`);
        return this.cache.get(version);
      }

      return this.downloadAndCache(release, version, token);
    }

    const cachedVersion = await this.cache.getLatestCached();
    if (cachedVersion !== null) {
      this.logger?.warn(`Network unavailable. Using cached framework version ${cachedVersion}.`);
      return this.cache.get(cachedVersion);
    }

    throw new Error(
      `Cannot resolve framework: network unavailable and no cached version found.${networkError ? ` Cause: ${networkError.message}` : ""}`
    );
  }

  private async fetchLatestRelease(repo: string, token?: string): Promise<GithubRelease> {
    const url = `${this.githubApiBase}/repos/${repo}/releases/latest`;
    const response = await this.http.get(url, { token });
    return response.body as GithubRelease;
  }

  private async downloadAndCache(
    release: GithubRelease,
    version: string,
    token?: string
  ): Promise<string> {
    const assetUrl = this.findTarballUrl(release);
    this.logger?.debug(`Downloading framework version ${version} from ${assetUrl}`);

    const response = await this.http.get(assetUrl, { token });
    if (!Buffer.isBuffer(response.body)) {
      throw new Error("Downloaded file is not a valid tarball");
    }

    const tempDir = await mkdtemp(join(tmpdir(), "aidd-download-"));
    const tarballPath = join(tempDir, `aidd-framework-${version}.tar.gz`);

    try {
      await writeFile(tarballPath, response.body);

      const extractDir = await mkdtemp(join(tmpdir(), "aidd-extract-"));
      try {
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

  private findTarballUrl(release: GithubRelease): string {
    const tarball = release.assets.find(
      (a) => a.name.endsWith(".tar.gz") || a.name.endsWith(".tgz")
    );
    if (!tarball) {
      throw new Error(
        `No tarball asset found in release ${release.tag_name}. Assets: ${release.assets.map((a) => a.name).join(", ")}`
      );
    }
    return tarball.browser_download_url;
  }
}
