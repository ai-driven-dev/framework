import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printUpdateBanner } from "../../src/application/check-update.js";
import { InitUseCase } from "../../src/application/use-cases/init-use-case.js";
import { InstallUseCase } from "../../src/application/use-cases/install-use-case.js";
import type { ToolId } from "../../src/domain/models/tool-config.js";
import type { CliUpdater } from "../../src/domain/ports/cli-updater.js";
import type { CurrentVersionProvider } from "../../src/domain/ports/current-version-provider.js";
import type { FrameworkResolver } from "../../src/domain/ports/framework-resolver.js";
import type { Logger } from "../../src/domain/ports/logger.js";
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
    info: (m: string) => logs.push(m),
    warn: () => {},
  };
  return { logger, logs };
}

function makeResolver(latestVersion: string): FrameworkResolver {
  return {
    resolve: vi.fn(),
    fetchLatestVersion: vi.fn().mockResolvedValue(latestVersion),
  };
}

function makeCliUpdater(latestVersion: string): CliUpdater {
  return {
    fetchLatestRelease: vi.fn().mockResolvedValue({ version: latestVersion, changelog: "" }),
    install: vi.fn().mockReturnValue("/usr/local/bin/aidd"),
  };
}

function makeCurrentVersionProvider(version: string): CurrentVersionProvider {
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
      makeCliUpdater("v1.0.0"),
      makeCurrentVersionProvider("1.0.0"),
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
      makeCliUpdater("v1.0.0"),
      makeCurrentVersionProvider("1.0.0"),
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
      makeCliUpdater("v1.0.0"),
      makeCurrentVersionProvider("1.0.0"),
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
    };

    await printUpdateBanner(
      makeCliUpdater("v1.0.0"),
      makeCurrentVersionProvider("1.0.0"),
      resolver,
      deps.manifestRepo,
      logger
    );

    expect(logs).toHaveLength(0);
  });

  it("shows 'aidd update --docs' when only docs are outdated", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeCliUpdater("v1.0.0"),
      makeCurrentVersionProvider("1.0.0"),
      makeResolver("v3.1.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs.some((l) => l.includes("Update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd update --docs"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd update") && !l.includes("--docs"))).toBe(false);
  });

  it("shows 'aidd update' when only tools are outdated", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.1.0");
    await installWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(
      makeCliUpdater("v1.0.0"),
      makeCurrentVersionProvider("1.0.0"),
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
      makeCliUpdater("v1.0.0"),
      makeCurrentVersionProvider("1.0.0"),
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
      makeCliUpdater("v2.0.0"),
      makeCurrentVersionProvider("1.0.0"),
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
    const failingCliUpdater: CliUpdater = {
      fetchLatestRelease: vi.fn().mockRejectedValue(new Error("network failure")),
      install: vi.fn().mockReturnValue("/usr/local/bin/aidd"),
    };

    await printUpdateBanner(
      failingCliUpdater,
      makeCurrentVersionProvider("1.0.0"),
      makeResolver("v3.0.0"),
      deps.manifestRepo,
      logger
    );

    expect(logs).toHaveLength(0);
  });
});
