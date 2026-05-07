import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SetupStateService } from "../../../../src/application/use-cases/shared/setup-state-service.js";
import { DOCS_DIR } from "../../../../src/domain/models/paths.js";
import {
  buildUnitDeps,
  initAndInstall,
  initProject,
} from "../../../helpers/ports/build-unit-deps.js";

const PROJECT_ROOT = "/test-project";

describe("SetupStateService", () => {
  it("detects needs-init when no manifest and no tool signals", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(PROJECT_ROOT);

    expect(state.kind).toBe("needs-init");
  });

  it("detects needs-init when only docs directory exists", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    deps.fs.writeFile(join(PROJECT_ROOT, DOCS_DIR, ".keep"), "");
    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(PROJECT_ROOT);

    expect(state.kind).toBe("needs-init");
  });

  it("detects needs-adopt when AIDD-branded file exists without manifest", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    deps.fs.writeFile(
      join(PROJECT_ROOT, ".claude/commands/implement.md"),
      "---\nname: aidd:04:implement\n---\n"
    );
    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(PROJECT_ROOT);

    expect(state.kind).toBe("needs-adopt");
    if (state.kind === "needs-adopt") {
      expect(state.signals).toHaveLength(1);
      expect(state.signals[0]).toMatchObject({ type: "toolSignal", tool: "claude" });
    }
  });

  it("detects needs-install when manifest exists with no tools", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initProject(deps, PROJECT_ROOT);
    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(PROJECT_ROOT);

    expect(state.kind).toBe("needs-install");
  });

  it("treats installation as up-to-date when manifest has installed tools", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "claude");
    const detector = new SetupStateService(deps.manifestRepo, deps.fs);

    const state = await detector.detect(PROJECT_ROOT);

    expect(state.kind).toBe("up-to-date");
  });
});
