import { join } from "node:path";
import type {
  PluginSourceGitHub,
  PluginSourceGitSubdir,
  PluginSourceUrl,
} from "../../../shared/domain/plugin/source.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { TokenProvider } from "../../auth/contract/token-provider.js";
import { injectTokenIntoUrl, withoutCredentials } from "../domain/inject-token.model.js";
import type { PluginFetchOptions } from "../ports/plugin-fetcher.js";
import type { GitCloner } from "./git-cloner-adapter.js";

export type GitPluginSource = PluginSourceGitHub | PluginSourceUrl | PluginSourceGitSubdir;

/** Fetches a plugin that lives in a git repository, whole or one subdirectory of it. */
export class GitSourceFetcher {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly git: GitCloner,
    private readonly tokenProvider?: TokenProvider
  ) {}

  async fetch(
    source: GitPluginSource,
    cacheDir: string,
    options?: PluginFetchOptions
  ): Promise<string> {
    const forceRefresh = options?.forceRefresh ?? false;
    switch (source.kind) {
      case "github":
        return this.fetchGitHub(source, cacheDir, forceRefresh);
      case "url":
        return this.fetchUrl(source, cacheDir, forceRefresh);
      case "git-subdir":
        return this.fetchGitSubdir(source, cacheDir, forceRefresh);
    }
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
    if (forceRefresh && (await this.fs.fileExists(targetDir))) {
      await this.fs.deleteDirectory(targetDir);
    }
    if (!(await this.fs.fileExists(targetDir))) {
      await clone((await this.tokenProvider?.resolve()) ?? undefined);
    }
    return targetDir;
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
