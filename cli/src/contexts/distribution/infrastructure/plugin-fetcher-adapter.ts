import { execFile as execFileCb } from "node:child_process";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type {
  PluginSource,
  PluginSourceGitHub,
  PluginSourceGitSubdir,
  PluginSourceNpm,
  PluginSourceUrl,
} from "../../../shared/domain/source.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { TokenProvider } from "../../auth/contract/token-provider.js";
import { PluginFetchError } from "../domain/distribution.error.js";
import type { PluginFetcher, PluginFetchOptions } from "../ports/plugin-fetcher.js";
import type { GitCloner } from "./git-cloner-adapter.js";
import { injectTokenIntoUrl, withoutCredentials } from "./inject-token.js";

const execFile = promisify(execFileCb);

export class PluginFetcherAdapter implements PluginFetcher {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly git: GitCloner,
    private readonly tokenProvider?: TokenProvider
  ) {}

  async fetch(
    source: PluginSource,
    cacheDir: string,
    options?: PluginFetchOptions
  ): Promise<string> {
    const forceRefresh = options?.forceRefresh ?? false;
    switch (source.kind) {
      case "local":
        return this.fetchLocal(source.path);
      case "github":
        return this.fetchGitHub(source, cacheDir, forceRefresh);
      case "url":
        return this.fetchUrl(source, cacheDir, forceRefresh);
      case "git-subdir":
        return this.fetchGitSubdir(source, cacheDir, forceRefresh);
      case "npm":
        return this.fetchNpm(source, cacheDir, forceRefresh);
    }
  }

  private async fetchLocal(path: string): Promise<string> {
    const resolved = resolve(path);
    if (!(await this.fs.fileExists(resolved))) {
      throw new PluginFetchError(`local path does not exist: "${resolved}"`);
    }
    return resolved;
  }

  private async fetchGitHub(
    source: PluginSourceGitHub,
    cacheDir: string,
    forceRefresh: boolean
  ): Promise<string> {
    const baseUrl = `https://github.com/${source.repo}.git`;
    const key = `github-${source.repo.replace("/", "-")}-${source.ref ?? "HEAD"}`;
    const targetDir = join(cacheDir, key);
    return this.cloned(targetDir, forceRefresh, (token) =>
      this.git.cloneShallow({
        authUrl: injectTokenIntoUrl(baseUrl, token),
        displayUrl: baseUrl,
        targetDir,
        ref: source.ref,
      })
    );
  }

  private async fetchUrl(
    source: PluginSourceUrl,
    cacheDir: string,
    forceRefresh: boolean
  ): Promise<string> {
    const key = `${encodeKey(withoutCredentials(source.url))}${source.ref ? `-${source.ref}` : "-HEAD"}`;
    const targetDir = join(cacheDir, key);
    return this.cloned(targetDir, forceRefresh, (token) =>
      this.git.cloneShallow({
        authUrl: authenticated(source.url, token),
        displayUrl: source.url,
        targetDir,
        ref: source.ref,
      })
    );
  }

  private async fetchGitSubdir(
    source: PluginSourceGitSubdir,
    cacheDir: string,
    forceRefresh: boolean
  ): Promise<string> {
    const { url, path: subpath, ref } = source;
    const key = `${encodeKey(withoutCredentials(url))}-subdir-${subpath.replace(/\//g, "_")}-${ref ?? "HEAD"}`;
    const targetDir = join(cacheDir, key);
    await this.cloned(targetDir, forceRefresh, (token) =>
      this.git.cloneSparse(
        { authUrl: authenticated(url, token), displayUrl: url, targetDir, ref },
        subpath
      )
    );
    return join(targetDir, subpath);
  }

  /** The cache directory, cloned into first unless a fetch already left it there. */
  private async cloned(
    targetDir: string,
    forceRefresh: boolean,
    clone: (token: string | undefined) => Promise<void>
  ): Promise<string> {
    await this.bustCacheIfNeeded(targetDir, forceRefresh);
    if (!(await this.fs.fileExists(targetDir))) {
      await clone((await this.tokenProvider?.resolve()) ?? undefined);
    }
    return targetDir;
  }

  private async bustCacheIfNeeded(targetDir: string, forceRefresh: boolean): Promise<void> {
    if (forceRefresh && (await this.fs.fileExists(targetDir))) {
      await this.fs.deleteDirectory(targetDir);
    }
  }

  private async fetchNpm(
    source: PluginSourceNpm,
    cacheDir: string,
    forceRefresh: boolean
  ): Promise<string> {
    const { package: pkg, version } = source;
    const pkgDir = join(cacheDir, "node_modules", pkg);
    await this.bustCacheIfNeeded(pkgDir, forceRefresh);
    const spec = `${pkg}@${version ?? "latest"}`;
    try {
      await execFile("pnpm", ["add", "--prefix", cacheDir, "--", spec]);
    } catch (err) {
      throw new PluginFetchError(`npm install failed for "${spec}": ${String(err)}`);
    }
    return pkgDir;
  }
}

function authenticated(url: string, token: string | undefined): string {
  return url.startsWith("git@") ? url : injectTokenIntoUrl(url, token);
}

// Truncation to 64 chars avoids filesystem path-length limits.
// URLs that differ only beyond position 64 will collide: acceptable for typical plugin URLs.
function encodeKey(url: string): string {
  return url.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 64);
}
