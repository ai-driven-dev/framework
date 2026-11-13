import { PrintUpdateNotice } from "../../../../src/contexts/update/application/print-update-notice.js";
import { RefreshUpdateCheck } from "../../../../src/contexts/update/application/refresh-update-check.js";
import { SelfUpdate } from "../../../../src/contexts/update/application/self-update.js";
import type { CliInstaller } from "../../../../src/contexts/update/ports/cli-installer.js";
import type { CliReleaseSource } from "../../../../src/contexts/update/ports/cli-release-source.js";
import type { UpdateCheckCache } from "../../../../src/contexts/update/ports/update-check-cache.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { FakeCliInstaller } from "./fake-cli-installer.js";
import { FakeCliReleaseSource } from "./fake-cli-release-source.js";
import { InMemoryUpdateCheckCache } from "./in-memory-update-check-cache.js";

/** `aidd update` over neutral doubles: version 1.0.0 installed, 2.0.0 published, an installer
 * that succeeds. */
export function aSelfUpdate() {
  let current = "1.0.0";
  let releases: CliReleaseSource = new FakeCliReleaseSource();
  let installer: CliInstaller = new FakeCliInstaller();
  const builder = {
    installed(version: string) {
      current = version;
      return builder;
    },
    withReleases(value: CliReleaseSource) {
      releases = value;
      return builder;
    },
    withInstaller(value: CliInstaller) {
      installer = value;
      return builder;
    },
    build: () => new SelfUpdate(releases, installer, { get: () => current }),
  };
  return builder;
}

/** The notice over an empty cache, version 1.0.0 installed, a logger that keeps what it hears. */
export function aPrintUpdateNotice() {
  let cache: UpdateCheckCache = new InMemoryUpdateCheckCache();
  let current = "1.0.0";
  const logger = new CapturingLogger();
  const builder = {
    withCache(value: UpdateCheckCache) {
      cache = value;
      return builder;
    },
    installed(version: string) {
      current = version;
      return builder;
    },
    build: () => ({
      useCase: new PrintUpdateNotice(cache, { get: () => current }, logger),
      logger,
    }),
  };
  return builder;
}

/** The refresh over an empty cache and a clock stopped at 1000. */
export function aRefreshUpdateCheck() {
  let releases: CliReleaseSource = new FakeCliReleaseSource();
  let cache: UpdateCheckCache = new InMemoryUpdateCheckCache();
  const builder = {
    withReleases(value: CliReleaseSource) {
      releases = value;
      return builder;
    },
    withCache(value: UpdateCheckCache) {
      cache = value;
      return builder;
    },
    build: () => new RefreshUpdateCheck(releases, cache, () => 1000),
  };
  return builder;
}
