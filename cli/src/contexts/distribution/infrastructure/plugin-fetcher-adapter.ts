import { resolve } from "node:path";
import type { PluginSource } from "../../../shared/domain/plugin/source.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import { PluginFetchError } from "../contract/distribution.error.js";
import type { PluginFetcher, PluginFetchOptions } from "../ports/plugin-fetcher.js";
import type { GitSourceFetcher } from "./git-source-fetcher.js";
import type { NpmSourceFetcher } from "./npm-source-fetcher.js";

/** Routes a plugin source to the fetcher of its kind, and answers a local path itself. */
export class PluginFetcherAdapter implements PluginFetcher {
  constructor(
    private readonly fs: FileReader,
    private readonly git: GitSourceFetcher,
    private readonly npm: NpmSourceFetcher
  ) {}

  async fetch(
    source: PluginSource,
    cacheDir: string,
    options?: PluginFetchOptions
  ): Promise<string> {
    switch (source.kind) {
      case "local":
        return this.fetchLocal(source.path);
      case "github":
      case "url":
      case "git-subdir":
        return this.git.fetch(source, cacheDir, options);
      case "npm":
        return this.npm.fetch(source, cacheDir, options);
    }
  }

  private async fetchLocal(path: string): Promise<string> {
    const resolved = resolve(path);
    if (!(await this.fs.fileExists(resolved))) {
      throw new PluginFetchError(`local path does not exist: "${resolved}"`);
    }
    return resolved;
  }
}
