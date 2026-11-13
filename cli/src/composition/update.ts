import { platform } from "node:os";
import type { TokenProvider } from "../contexts/auth/contract/token-provider.js";
import { PrintUpdateNotice } from "../contexts/update/application/print-update-notice.js";
import { RefreshUpdateCheck } from "../contexts/update/application/refresh-update-check.js";
import { SelfUpdate } from "../contexts/update/application/self-update.js";
import { NpmRegistryReleaseAdapter } from "../contexts/update/infrastructure/npm-registry-release-adapter.js";
import { PackageManagerInstallerAdapter } from "../contexts/update/infrastructure/package-manager-installer-adapter.js";
import { UpdateCheckCacheAdapter } from "../contexts/update/infrastructure/update-check-cache-adapter.js";
import type { FileReader } from "../kernel/ports/file-reader.js";
import type { FileWriter } from "../kernel/ports/file-writer.js";
import type { Logger } from "../kernel/ports/logger.js";
import type { VersionReader } from "../kernel/ports/version-reader.js";
import { userConfigDir } from "../shared/infrastructure/user-config-dir.js";
import type { Environment } from "../shared/ports/environment.js";
import type { HttpGet } from "../shared/ports/http-get.js";

export interface UpdateWiring {
  logger: Logger;
  http: HttpGet;
  fs: FileReader & FileWriter;
  environment: Environment;
  tokenProvider: TokenProvider;
  version: VersionReader;
}

export interface UpdateDeps {
  selfUpdate: SelfUpdate;
  printUpdateNotice: PrintUpdateNotice;
  refreshUpdateCheck: RefreshUpdateCheck;
}

export function wireUpdate(shared: UpdateWiring): UpdateDeps {
  const releases = new NpmRegistryReleaseAdapter(shared.http, {
    tokenProvider: shared.tokenProvider,
    githubApiBase: shared.environment.get("AIDD_SELF_UPDATE_API_BASE"),
    npmRegistryBase: shared.environment.get("AIDD_SELF_UPDATE_NPM_BASE"),
    logger: shared.logger,
  });
  const cache = new UpdateCheckCacheAdapter(shared.fs, userConfigDir);
  return {
    selfUpdate: new SelfUpdate(
      releases,
      new PackageManagerInstallerAdapter(process.env, platform()),
      shared.version
    ),
    printUpdateNotice: new PrintUpdateNotice(cache, shared.version),
    refreshUpdateCheck: new RefreshUpdateCheck(releases, cache, Date.now),
  };
}
