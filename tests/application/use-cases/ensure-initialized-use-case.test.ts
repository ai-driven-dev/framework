import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureInitialized } from "../../../src/application/use-cases/ensure-initialized-use-case.js";
import { FileSystemAdapter } from "../../../src/infrastructure/adapters/file-system-adapter.js";
import { FrameworkLoaderAdapter } from "../../../src/infrastructure/adapters/framework-loader-adapter.js";
import { HasherAdapter } from "../../../src/infrastructure/adapters/hasher-adapter.js";
import { ManifestRepositoryAdapter } from "../../../src/infrastructure/adapters/manifest-repository-adapter.js";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");

describe("ensureInitialized()", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-ensure-init-test-"));
    projectRoot = join(tempDir, "project");
    await mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function buildDeps() {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    const manifestRepo = new ManifestRepositoryAdapter(projectRoot);
    const loader = new FrameworkLoaderAdapter();
    const logger = {
      debug: (_msg: string) => {},
      info: (_msg: string) => {},
      warn: (_msg: string) => {},
    };
    return { hasher, fs, manifestRepo, loader, logger };
  }

  it("returns existing manifest without running init when already initialized", async () => {
    const deps = buildDeps();

    // First call initializes
    await ensureInitialized(deps.manifestRepo, deps.fs, deps.loader, deps.hasher, deps.logger, {
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    // Second call must return existing manifest (not re-init)
    const logged: string[] = [];
    const trackingLogger = {
      debug: (_msg: string) => {},
      info: (msg: string) => logged.push(msg),
      warn: (_msg: string) => {},
    };

    const manifest = await ensureInitialized(
      deps.manifestRepo,
      deps.fs,
      deps.loader,
      deps.hasher,
      trackingLogger,
      {
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      }
    );

    expect(manifest).not.toBeNull();
    expect(logged).toHaveLength(0); // no "Initializing docs first" message
  });

  it("runs init and returns new manifest when not initialized", async () => {
    const deps = buildDeps();

    const manifest = await ensureInitialized(
      deps.manifestRepo,
      deps.fs,
      deps.loader,
      deps.hasher,
      deps.logger,
      {
        frameworkPath: FIXTURE_DIR,
        version: "test",
        docsDir: "aidd_docs",
        projectRoot,
      }
    );

    expect(manifest).not.toBeNull();
  });

  it("logs info message when auto-initializing", async () => {
    const deps = buildDeps();
    const infoMessages: string[] = [];
    const trackingLogger = {
      debug: (_msg: string) => {},
      info: (msg: string) => infoMessages.push(msg),
      warn: (_msg: string) => {},
    };

    await ensureInitialized(deps.manifestRepo, deps.fs, deps.loader, deps.hasher, trackingLogger, {
      frameworkPath: FIXTURE_DIR,
      version: "test",
      docsDir: "aidd_docs",
      projectRoot,
    });

    expect(infoMessages.some((m) => m.includes("Initializing docs first"))).toBe(true);
  });
});
