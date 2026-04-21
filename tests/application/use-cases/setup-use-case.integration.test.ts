import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetupUseCase } from "../../../src/application/use-cases/setup-use-case.js";
import { type ToolId, VALID_TOOL_IDS } from "../../../src/domain/models/tool-config.js";
import type { FrameworkResolver } from "../../../src/domain/ports/framework-resolver.js";
import { SilentPrompterAdapter } from "../../../src/infrastructure/adapters/prompter-adapter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initAndInstall,
  initProject,
  linuxPlatform,
  noGit,
} from "./helpers.js";

describe("setup without TTY", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  function makeResolver(latestVersion = "test"): FrameworkResolver {
    return {
      resolve: vi
        .fn()
        .mockResolvedValue({ path: FIXTURE_DIR, version: latestVersion, source: "local" }),
      fetchLatestVersion: vi.fn().mockResolvedValue(latestVersion),
      getDefaultRepo: vi.fn().mockReturnValue(undefined),
    };
  }

  function buildUseCase(resolver: FrameworkResolver) {
    const deps = buildDeps(projectRoot);
    return new SetupUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.loader,
      deps.hasher,
      deps.logger,
      noGit,
      linuxPlatform,
      new SilentPrompterAdapter(),
      resolver
    );
  }

  async function seedAdoptSignal() {
    const commandDir = join(projectRoot, ".claude", "commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(
      join(commandDir, "implement.md"),
      "---\nname: aidd:04:implement\ndescription: test\n---\nbody"
    );
  }

  it("fresh project with all tools flag initializes and installs all tools", async () => {
    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
      toolIds: [...VALID_TOOL_IDS],
    });

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("fresh project without tool flags initializes docs only and installs no tools", async () => {
    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
    });

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results).toHaveLength(0);
    }
  });

  it("existing tool files detected with tools and from flags registers the tool in manifest", async () => {
    await seedAdoptSignal();

    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
      toolIds: ["claude" as ToolId],
      from: "test",
    });

    expect(result.kind).toBe("adopted");
  });

  it("existing tool files detected without from flag fails with a clear error", async () => {
    await seedAdoptSignal();

    await expect(
      buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
        toolIds: [...VALID_TOOL_IDS],
      })
    ).rejects.toThrow(/from/i);
  });

  it("error message includes triggering signal paths when adopt requires version", async () => {
    await seedAdoptSignal();

    await expect(
      buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
        toolIds: [...VALID_TOOL_IDS],
      })
    ).rejects.toThrow(".claude/commands/implement.md");
  });

  it("error message includes aidd_docs path when docs dir exists without manifest", async () => {
    await mkdir(join(projectRoot, "aidd_docs"), { recursive: true });

    await expect(
      buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
        toolIds: [...VALID_TOOL_IDS],
      })
    ).rejects.toThrow("aidd_docs/");
  });

  it("existing tool files detected without tools flag fails with a clear error", async () => {
    await seedAdoptSignal();

    await expect(
      buildUseCase(makeResolver()).execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
      })
    ).rejects.toThrow("--ai or --ide");
  });

  it("manifest exists but no tools installed and all tools flag installs all tools", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
      toolIds: [...VALID_TOOL_IDS],
    });

    expect(result.kind).toBe("installed");
    if (result.kind === "installed") {
      expect(result.install.results.length).toBeGreaterThan(0);
    }
  });

  it("manifest exists but no tools installed without tool flags installs nothing", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
    });

    expect(result.kind).toBe("installed");
    if (result.kind === "installed") {
      expect(result.install.results).toHaveLength(0);
    }
  });

  it("newer version available updates silently without offering additional tools", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    // "test" is not semver, "v2.0.0" is semver → triggers needs-update
    const result = await buildUseCase(makeResolver("v2.0.0")).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
    });

    expect(result.kind).toBe("updated");
    if (result.kind === "updated") {
      expect(result.additionalInstall).toBeUndefined();
    }
  });

  it("project already up to date — exits without asking to install more tools", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const result = await buildUseCase(makeResolver()).execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
    });

    expect(result.kind).toBe("up-to-date");
  });
});
