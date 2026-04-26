import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ai/copilot.js";
import "../../../../src/domain/tools/ai/cursor.js";
import "../../../../src/domain/tools/ai/opencode.js";
import { SetupStateService } from "../../../../src/application/use-cases/shared/setup-state-service.js";
import { Manifest } from "../../../../src/domain/models/manifest.js";
import type { FrameworkResolver } from "../../../../src/domain/ports/framework-resolver.js";
import {
  buildDeps,
  cleanupTempProject,
  createTempProject,
  initAndInstall,
  initProject,
} from "../helpers.js";

describe("SetupStateService", () => {
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

  it("detects needs-init state when no manifest and no tool signals found", async () => {
    const deps = buildDeps(projectRoot);
    const resolver = makeResolver({ latestVersion: "v1.0.0" });
    const detector = new SetupStateService(deps.manifestRepo, deps.fs, resolver);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("needs-init");
  });

  it("detects needs-init state when only docs directory exists without manifest and no tool signals", async () => {
    await mkdir(join(projectRoot, Manifest.DEFAULT_DOCS_DIR), { recursive: true });

    const deps = buildDeps(projectRoot);
    const resolver = makeResolver({ latestVersion: "v1.0.0" });
    const detector = new SetupStateService(deps.manifestRepo, deps.fs, resolver);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("needs-init");
  });

  it("detects needs-adopt state when AIDD-branded file found without manifest", async () => {
    const commandDir = join(projectRoot, ".claude/commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(join(commandDir, "implement.md"), "---\nname: aidd:04:implement\n---\n");

    const deps = buildDeps(projectRoot);
    const resolver = makeResolver({ latestVersion: "v1.0.0" });
    const detector = new SetupStateService(deps.manifestRepo, deps.fs, resolver);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("needs-adopt");
    if (state.kind === "needs-adopt") {
      expect(state.signals).toHaveLength(1);
      expect(state.signals[0]).toMatchObject({ type: "toolSignal", tool: "claude" });
    }
  });

  it("detects needs-install state when manifest exists with no installed tools", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const resolver = makeResolver({ latestVersion: "v1.0.0" });
    const detector = new SetupStateService(deps.manifestRepo, deps.fs, resolver);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("needs-install");
  });

  it("detects needs-update state when installed version is behind latest", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const resolver = makeResolver({ latestVersion: "v9.9.9" });
    const detector = new SetupStateService(deps.manifestRepo, deps.fs, resolver);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("needs-update");
    if (state.kind === "needs-update") {
      expect(state.latestVersion).toBe("v9.9.9");
      expect(state.currentVersion).toBe("test");
    }
  });

  it("treats installation as up-to-date when network fails to fetch latest version", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const resolver = makeResolver({ throws: true });
    const detector = new SetupStateService(deps.manifestRepo, deps.fs, resolver);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("up-to-date");
  });
});
