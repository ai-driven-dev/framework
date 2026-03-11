import { readFile, stat, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  FrameworkResolved,
  FrameworkResolver,
  FrameworkResolverOptions,
} from "../../domain/ports/framework-resolver.js";
import type { Logger } from "../../domain/ports/logger.js";
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
    throw new Error(`Unexpected GitHub API response from ${url}`);
  }
  return body as GithubRelease;
}

interface FrameworkResolverAdapterConfig {
  defaultRepo: string;
  defaultToken?: string;
  githubApiBase?: string;
}

const DEFAULT_GITHUB_API_BASE = "https://api.github.com";
const REPO_FORMAT_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

export function validateRepoFormat(repo: string): void {
  if (!REPO_FORMAT_REGEX.test(repo)) {
    throw new Error("Invalid repository format. Expected: owner/repo");
  }
}

export class FrameworkResolverAdapter implements FrameworkResolver {
  private readonly defaultRepo: string;
  private readonly defaultToken: string | undefined;
  private readonly githubApiBase: string;

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
  }

  async resolve(options: FrameworkResolverOptions): Promise<FrameworkResolved> {
    if (options.localPath) {
      try {
        await stat(options.localPath);
      } catch {
        throw new Error(`Framework path does not exist: ${options.localPath}`);
      }
      const version = await readVersionFile(options.localPath);
      return { path: options.localPath, version, source: "local" };
    }

    if (options.tarballPath) {
      const path = await this.resolveLocalTarball(options.tarballPath);
      const version = await readVersionFile(path);
      return { path, version, source: "local" };
    }

    return this.resolveRemote(options);
  }

  async fetchLatestVersion(): Promise<string> {
    const release = await this.fetchLatestRelease(this.defaultRepo, this.defaultToken);
    return release.tag_name;
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
    validateRepoFormat(repo);
    const token = options.token ?? this.defaultToken;

    const normalizedTag = options.version?.startsWith("v")
      ? options.version
      : options.version
        ? `v${options.version}`
        : undefined;

    let release: GithubRelease | null = null;
    let networkError: Error | null = null;

    try {
      release = normalizedTag
        ? await this.fetchReleaseByTag(repo, normalizedTag, token)
        : await this.fetchLatestRelease(repo, token);
    } catch (error) {
      if (normalizedTag) throw new Error(`Framework release not found: ${normalizedTag}`);
      networkError = error instanceof Error ? error : new Error(String(error));
    }

    if (release !== null) {
      const version = release.tag_name.replace(/^v/, "");

      if (await this.cache.has(version)) {
        this.logger?.info(`Using cached framework v${version}`);
        return { path: this.cache.get(version), version, source: "cache" };
      }

      this.logger?.info(`Downloading framework v${version}...`);
      const path = await this.downloadAndCache(repo, release, version, token);
      return { path, version, source: "download" };
    }

    const cachedVersion = await this.cache.getLatestCached();
    if (cachedVersion !== null) {
      this.logger?.warn(`Network unavailable. Using cached framework v${cachedVersion}.`);
      return { path: this.cache.get(cachedVersion), version: cachedVersion, source: "cache" };
    }

    throw new Error("Cannot reach the framework source. Check your network connection.");
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
      throw new Error("Downloaded file is not a valid tarball");
    }

    const tempDir = await mkdtemp(join(tmpdir(), "aidd-download-"));
    const tarballPath = join(tempDir, `aidd-framework-${version}.tar.gz`);

    try {
      await writeFile(tarballPath, response.body);

      const extractDir = await mkdtemp(join(tmpdir(), "aidd-extract-"));
      try {
        this.logger?.info("Extracting framework...");
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
      throw new Error(
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
