import type { HttpGet } from "../../../shared/ports/http-get.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { ReleaseLister } from "../../../shared/ports/release-lister.js";
import { CLI_PACKAGE } from "../domain/package-manager.js";
import { FrameworkResolutionError } from "../domain/update.error.js";
import type { CliRelease, CliReleaseSource } from "../ports/cli-release-source.js";

// release-please tags this package per component: `cli-v<semver>`, never a bare `v<semver>`,
// which is the root marketplace's. `fetchChangelog` swallows a missing release, so a wrong tag
// here costs the changelog silently.
const CLI_REPO = "ai-driven-dev/framework";
const CLI_TAG_PREFIX = "cli-v";
const DEFAULT_NPM_REGISTRY_BASE = "https://registry.npmjs.org";

function readString(body: unknown, key: string): string | null {
  const value = (body as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "string" ? value : null;
}

interface NpmRegistryReleaseConfig {
  npmRegistryBase?: string;
  logger?: Logger;
}

export class NpmRegistryReleaseAdapter implements CliReleaseSource {
  private readonly npmRegistryBase: string;
  private readonly logger: Logger | undefined;

  constructor(
    private readonly http: HttpGet,
    private readonly releases: Pick<ReleaseLister, "readReleaseBody">,
    config: NpmRegistryReleaseConfig = {}
  ) {
    this.npmRegistryBase = config.npmRegistryBase ?? DEFAULT_NPM_REGISTRY_BASE;
    this.logger = config.logger;
  }

  async fetchLatestRelease(): Promise<CliRelease> {
    const version = await this.resolveLatestVersion();
    return { version, changelog: await this.fetchChangelog(version) };
  }

  // npm, not GitHub: it is the registry `npm install -g` pulls from, and it is reachable
  // without a token whether the GitHub repo is public or private.
  private async resolveLatestVersion(): Promise<string> {
    const url = `${this.npmRegistryBase}/-/package/${CLI_PACKAGE}/dist-tags`;
    try {
      // npm returns 406 for the client's default GitHub Accept: request plain JSON.
      const response = await this.http.get(url, { accept: "application/json" });
      const latest = readString(response.body, "latest");
      if (latest === null) {
        throw new FrameworkResolutionError(`Unexpected npm registry response from ${url}`);
      }
      return latest;
    } catch (err) {
      if (err instanceof FrameworkResolutionError) throw err;
      const detail = err instanceof Error ? err.message : String(err);
      throw new FrameworkResolutionError(
        `Could not resolve the latest CLI version from ${url}: ${detail}`
      );
    }
  }

  // Changelog is best-effort: the GitHub release body enriches the update notice
  // but is optional. A private repo without a token reads as no release: swallow it.
  private async fetchChangelog(version: string): Promise<string | null> {
    try {
      return await this.releases.readReleaseBody(CLI_REPO, `${CLI_TAG_PREFIX}${version}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger?.debug(`Changelog unavailable: ${detail}`);
      return null;
    }
  }
}
