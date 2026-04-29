import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printUpdateBanner } from "../../src/application/use-cases/check-update-use-case.js";
import { InitUseCase } from "../../src/application/use-cases/init-use-case.js";
import { InstallUseCase } from "../../src/application/use-cases/install/install-use-case.js";
import type { FrameworkResolver } from "../../src/domain/ports/framework-resolver.js";
import type { Logger } from "../../src/domain/ports/logger.js";
import type { SelfUpdater } from "../../src/domain/ports/self-updater.js";
import type { VersionReader } from "../../src/domain/ports/version-reader.js";
import type { ToolId } from "../../src/domain/tools/registry.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  linuxPlatform,
} from "./use-cases/helpers.js";

function makeLogger(): { logger: Logger; logs: string[] } {
  const logs: string[] = [];
  const logger: Logger = {
    debug: () => {},
    info: () => {},
    warn: (m: string) => logs.push(m),
  };
  return { logger, logs };
}

function makeResolver(latestVersion: string): FrameworkResolver {
  return {
    resolve: vi.fn(),
    fetchLatestVersion: vi.fn().mockResolvedValue(latestVersion),
    getDefaultRepo: vi.fn().mockReturnValue(undefined),
  };
}

function makeSelfUpdater(latestVersion: string): SelfUpdater {
  return {
    fetchLatestRelease: vi.fn().mockResolvedValue({ version: latestVersion, changelog: "" }),
    install: vi.fn().mockReturnValue("/usr/local/bin/aidd"),
  };
}

function makeVersionReader(version: string): VersionReader {
  return { get: () => version };
}

async function initWithVersion(
  deps: ReturnType<typeof buildDeps>,
  projectRoot: string,
  version: string
) {
  const useCase = new InitUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.loader,
    deps.hasher,
    deps.logger
  );
  await useCase.execute({ frameworkPath: FIXTURE_DIR, version, docsDir: "aidd_docs", projectRoot });
}

async function installWithVersion(
  deps: ReturnType<typeof buildDeps>,
  projectRoot: string,
  version: string
) {
  const useCase = new InstallUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.loader,
    deps.hasher,
    deps.logger,
    linuxPlatform
  );
  await useCase.execute({
    toolIds: ["claude" as ToolId],
    frameworkPath: FIXTURE_DIR,
    version,
    docsDir: "aidd_docs",
    projectRoot,
  });
}

describe("printUpdateBanner", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  it("stays silent when project is not initialized", async () => {
    const deps = buildDeps(projectRoot);
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeSelfUpdater("v1.0.0"),
      makeVersionReader("1.0.0"),
      makeResolver("v3.0.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs).toHaveLength(0);
  });

  it("stays silent for non-release versions", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "local");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeSelfUpdater("v1.0.0"),
      makeVersionReader("1.0.0"),
      makeResolver("v3.0.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs).toHaveLength(0);
  });

  it("stays silent when already on latest version", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeSelfUpdater("v1.0.0"),
      makeVersionReader("1.0.0"),
      makeResolver("v3.0.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs).toHaveLength(0);
  });

  it("stays silent when version check fails", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();
    const resolver: FrameworkResolver = {
      resolve: vi.fn(),
      fetchLatestVersion: vi.fn().mockRejectedValue(new Error("network failure")),
      getDefaultRepo: vi.fn().mockReturnValue(undefined),
    };

    await printUpdateBanner(
      makeSelfUpdater("v1.0.0"),
      makeVersionReader("1.0.0"),
      resolver,
      deps.manifestRepo,
      logger
    );

    expect(logs).toHaveLength(0);
  });

  it("shows 'aidd update' when only docs are outdated", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeSelfUpdater("v1.0.0"),
      makeVersionReader("1.0.0"),
      makeResolver("v3.1.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs.some((l) => l.includes("Update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd update"))).toBe(true);
    expect(logs.some((l) => l.includes("--docs"))).toBe(false);
  });

  it("shows 'aidd update' when only tools are outdated", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.1.0");
    await installWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeSelfUpdater("v1.0.0"),
      makeVersionReader("1.0.0"),
      makeResolver("v3.1.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs.some((l) => l.includes("Update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd update"))).toBe(true);
    expect(logs.some((l) => l.includes("--docs"))).toBe(false);
  });

  it("shows 'aidd update' when both docs and tools are outdated", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.0.0");
    await installWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeSelfUpdater("v1.0.0"),
      makeVersionReader("1.0.0"),
      makeResolver("v3.1.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs.some((l) => l.includes("Update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd update") && !l.includes("--docs"))).toBe(true);
    expect(logs.some((l) => l.includes("--docs"))).toBe(false);
  });

  it("shows CLI update when CLI is outdated", async () => {
    const deps = buildDeps(projectRoot);
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeSelfUpdater("v2.0.0"),
      makeVersionReader("1.0.0"),
      makeResolver("v3.0.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs.some((l) => l.includes("CLI update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd self-update"))).toBe(true);
  });

  it("stays silent for CLI when CLI check fails", async () => {
    const deps = buildDeps(projectRoot);
    const { logger, logs } = makeLogger();
    const failingSelfUpdater: SelfUpdater = {
      fetchLatestRelease: vi.fn().mockRejectedValue(new Error("network failure")),
      install: vi.fn().mockReturnValue("/usr/local/bin/aidd"),
    };

    await printUpdateBanner(
      failingSelfUpdater,
      makeVersionReader("1.0.0"),
      makeResolver("v3.0.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs).toHaveLength(0);
  });

  it("skips CLI update banner when skipCliCheck is true", async () => {
    const deps = buildDeps(projectRoot);
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeSelfUpdater("v2.0.0"),
      makeVersionReader("1.0.0"),
      makeResolver("v3.0.0"),
      deps.manifestRepo,
      logger,
      true
    );

    expect(logs.some((l) => l.includes("CLI update available"))).toBe(false);
  });
});
