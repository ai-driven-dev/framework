import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectSetupState } from "../../../src/application/use-cases/setup-use-case.js";
import type { FrameworkResolver } from "../../../src/domain/ports/framework-resolver.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initAndInstall,
  initProject,
} from "./helpers.js";

describe("detectSetupState", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    ({ tempDir, projectRoot } = await createTempProject());
  });

  afterEach(async () => {
    await cleanupTempProject(tempDir);
  });

  function makeResolver(opts: { latestVersion?: string; throws?: boolean }): FrameworkResolver {
    return {
      resolve: vi.fn().mockResolvedValue({ path: "/tmp", version: "v1.0.0", source: "cache" }),
      fetchLatestVersion: opts.throws
        ? vi.fn().mockRejectedValue(new Error("network failure"))
        : vi.fn().mockResolvedValue(opts.latestVersion ?? "v1.0.0"),
      getDefaultRepo: vi.fn().mockReturnValue(undefined),
    };
  }

  it("returns needs-init when no manifest and no AIDD signals", async () => {
    const deps = buildDeps(projectRoot);
    const resolver = makeResolver({ latestVersion: "v1.0.0" });

    const state = await detectSetupState(deps.manifestRepo, deps.fs, resolver, projectRoot);
    expect(state.kind).toBe("needs-init");
  });

  it("returns needs-adopt when no manifest but AIDD signals exist", async () => {
    const commandDir = join(projectRoot, ".claude/commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(join(commandDir, "implement.md"), "---\nname: aidd:04:implement\n---\n");

    const deps = buildDeps(projectRoot);
    const resolver = makeResolver({ latestVersion: "v1.0.0" });

    const state = await detectSetupState(deps.manifestRepo, deps.fs, resolver, projectRoot);
    expect(state.kind).toBe("needs-adopt");
  });

  it("returns needs-install when manifest exists but no tools installed", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const resolver = makeResolver({ latestVersion: "v1.0.0" });

    const state = await detectSetupState(deps.manifestRepo, deps.fs, resolver, projectRoot);
    expect(state.kind).toBe("needs-install");
  });

  it("returns needs-update when installed version differs from latest", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const resolver = makeResolver({ latestVersion: "v9.9.9" });

    const state = await detectSetupState(deps.manifestRepo, deps.fs, resolver, projectRoot);
    expect(state.kind).toBe("needs-update");
    if (state.kind === "needs-update") {
      expect(state.latestVersion).toBe("v9.9.9");
      expect(state.currentVersion).toBe("test");
    }
  });

  it("returns up-to-date when installed version matches latest", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const resolver = makeResolver({ latestVersion: "test" });

    const state = await detectSetupState(deps.manifestRepo, deps.fs, resolver, projectRoot);
    expect(state.kind).toBe("up-to-date");
  });

  it("returns up-to-date on network failure during version check", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const resolver = makeResolver({ throws: true });

    const state = await detectSetupState(deps.manifestRepo, deps.fs, resolver, projectRoot);
    expect(state.kind).toBe("up-to-date");
  });
});
