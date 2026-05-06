import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../../../src/domain/tools/ai/claude.js";
import "../../../../src/domain/tools/ai/copilot.js";
import "../../../../src/domain/tools/ai/cursor.js";
import "../../../../src/domain/tools/ai/opencode.js";
import { SetupStateService } from "../../../../src/application/use-cases/shared/setup-state-service.js";
import { DOCS_DIR } from "../../../../src/domain/models/paths.js";
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

  it("detects needs-init when no manifest and no tool signals", async () => {
    const deps = buildDeps(projectRoot);
    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("needs-init");
  });

  it("detects needs-init when only docs directory exists", async () => {
    await mkdir(join(projectRoot, DOCS_DIR), { recursive: true });

    const deps = buildDeps(projectRoot);
    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("needs-init");
  });

  it("detects needs-adopt when AIDD-branded file exists without manifest", async () => {
    const commandDir = join(projectRoot, ".claude/commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(join(commandDir, "implement.md"), "---\nname: aidd:04:implement\n---\n");

    const deps = buildDeps(projectRoot);
    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("needs-adopt");
    if (state.kind === "needs-adopt") {
      expect(state.signals).toHaveLength(1);
      expect(state.signals[0]).toMatchObject({ type: "toolSignal", tool: "claude" });
    }
  });

  it("detects needs-install when manifest exists with no tools", async () => {
    const deps = buildDeps(projectRoot);
    await initProject(deps, projectRoot);

    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("needs-install");
  });

  it("treats installation as up-to-date when manifest has installed tools", async () => {
    const deps = buildDeps(projectRoot);
    await initAndInstall(deps, projectRoot, "claude");

    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(projectRoot);

    expect(state.kind).toBe("up-to-date");
  });
});
