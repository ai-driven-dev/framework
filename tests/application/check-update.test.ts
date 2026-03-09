import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printUpdateBanner } from "../../src/application/check-update.js";
import { InitUseCase } from "../../src/application/use-cases/init-use-case.js";
import { InstallUseCase } from "../../src/application/use-cases/install-use-case.js";
import type { ToolId } from "../../src/domain/models/tool-config.js";
import type { FrameworkResolver } from "../../src/domain/ports/framework-resolver.js";
import type { Logger } from "../../src/domain/ports/logger.js";
import {
  FIXTURE_DIR,
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initAndInstall,
  initProject,
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
    deps.logger
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

    await printUpdateBanner(makeResolver("v3.0.0"), deps.manifestRepo, logger);

    expect(logs).toHaveLength(0);
  });

  it("stays silent for non-release versions", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "local");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(makeResolver("v3.0.0"), deps.manifestRepo, logger);

    expect(logs).toHaveLength(0);
  });

  it("stays silent when already on latest version", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(makeResolver("v3.0.0"), deps.manifestRepo, logger);

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

    await printUpdateBanner(resolver, deps.manifestRepo, logger);

    expect(logs).toHaveLength(0);
  });

  it("shows docs update command when docs are outdated", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(makeResolver("v3.1.0"), deps.manifestRepo, logger);

    expect(logs.some((l) => l.includes("Update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd init --force"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd install --all"))).toBe(false);
  });

  it("shows tools update command when tools are outdated", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.1.0");
    await installWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(makeResolver("v3.1.0"), deps.manifestRepo, logger);

    expect(logs.some((l) => l.includes("Update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd install --all"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd init --force"))).toBe(false);
  });

  it("shows both update commands when docs and tools are outdated", async () => {
    const deps = buildDeps(projectRoot);
    await initWithVersion(deps, projectRoot, "3.0.0");
    await installWithVersion(deps, projectRoot, "3.0.0");
    const { logger, logs } = makeLogger();

    await printUpdateBanner(makeResolver("v3.1.0"), deps.manifestRepo, logger);

    expect(logs.some((l) => l.includes("Update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd init --force"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd install --all"))).toBe(true);
  });
});
