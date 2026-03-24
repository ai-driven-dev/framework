import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SetupUseCase } from "../../../src/application/use-cases/setup-use-case.js";
import type { FrameworkResolver } from "../../../src/domain/ports/framework-resolver.js";
import { SilentPrompterAdapter } from "../../../src/infrastructure/adapters/prompter-adapter.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  FIXTURE_DIR,
  initAndInstall,
  linuxPlatform,
  noGit,
} from "./helpers.js";

describe("SetupUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  function makeLocalResolver(): FrameworkResolver {
    return {
      resolve: vi.fn().mockResolvedValue({ path: FIXTURE_DIR, version: "test", source: "local" }),
      fetchLatestVersion: vi.fn().mockResolvedValue("test"),
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

  it("handleAdopt non-interactive without toolIds — throws error mentioning --tools", async () => {
    // Create an AIDD signal file so detectSetupState returns needs-adopt
    const commandDir = join(projectRoot, ".claude", "commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(
      join(commandDir, "implement.md"),
      "---\nname: aidd:04:implement\ndescription: test\n---\nbody"
    );

    const useCase = buildUseCase(makeLocalResolver());

    await expect(
      useCase.execute({
        projectRoot,
        path: FIXTURE_DIR,
        interactive: false,
        // no toolIds, no from
      })
    ).rejects.toThrow("--tools");
  });

  it("handleUpToDate non-interactive — returns up-to-date without prompting", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    // Resolver returns same version as installed ("test") so no update is triggered
    const resolver = makeLocalResolver();
    const useCase = buildUseCase(resolver);

    const result = await useCase.execute({
      projectRoot,
      path: FIXTURE_DIR,
      interactive: false,
    });

    expect(result.kind).toBe("up-to-date");
  });
});
