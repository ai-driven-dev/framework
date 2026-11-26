import { join } from "node:path";
import type { PluginSourceNpm } from "../../../shared/domain/plugin/source.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import { PluginFetchError } from "../contract/distribution.error.js";
import type { NpmInstaller } from "../ports/npm-installer.js";
import type { PluginFetchOptions } from "../ports/plugin-fetcher.js";

/** Fetches a plugin published as an npm package, installed under the cache directory. */
export class NpmSourceFetcher {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly npm: NpmInstaller
  ) {}

  async fetch(
    source: PluginSourceNpm,
    cacheDir: string,
    options?: PluginFetchOptions
  ): Promise<string> {
    const { package: pkg, version } = source;
    const pkgDir = join(cacheDir, "node_modules", pkg);
    if (options?.forceRefresh && (await this.fs.fileExists(pkgDir))) {
      await this.fs.deleteDirectory(pkgDir);
    }
    const spec = `${pkg}@${version ?? "latest"}`;
    try {
      await this.npm.install(spec, cacheDir);
    } catch (err) {
      throw new PluginFetchError(`npm install failed for "${spec}": ${String(err)}`);
    }
    return pkgDir;
  }
}
