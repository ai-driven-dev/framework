import { describe, expect, it } from "vitest";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";
import { ACTIVATED_NOTHING, aRunSync, RESTORED_NOTHING } from "../testing/run-sync.builder.js";

const GIVEN = { projectRoot: "/project", force: false, interactive: false, files: [] };

describe("RunSync of the whole project", () => {
  it("restores first, then activates, each reported as it is known", async () => {
    const run = aRunSync({ claude: SYNTHETIC_TOOL });

    await run.useCase.execute(GIVEN, run.report);

    expect(run.calls).toEqual([
      "restoreAll",
      "report restored",
      "syncSettings",
      "report activated",
    ]);
    expect(run.syncCommands).toEqual([
      { projectRoot: "/project", recreateFrameworkIfMissing: true },
    ]);
  });

  it("asks a person only when one can answer and the run is not forced", async () => {
    const run = aRunSync({ claude: SYNTHETIC_TOOL });

    await run.useCase.execute({ ...GIVEN, interactive: true }, run.report);
    await run.useCase.execute({ ...GIVEN, interactive: true, force: true }, run.report);

    expect(run.restoreAllArgs).toEqual([
      ["/project", false, true],
      ["/project", true, false],
    ]);
  });

  it("throws naming the scopes of the restore and the activation that failed, after reporting both", async () => {
    const run = aRunSync({
      claude: SYNTHETIC_TOOL,
      restoreAll: {
        ...RESTORED_NOTHING,
        errors: [{ scope: "claude", error: "file is not ours" }],
        failed: true,
      },
      activation: {
        ...ACTIVATED_NOTHING,
        errors: [{ scope: "codex", error: "binary crashed" }],
        failed: true,
      },
    });

    await expect(run.useCase.execute(GIVEN, run.report)).rejects.toThrow(
      expect.objectContaining({
        errors: [
          { scope: "claude", error: "file is not ours" },
          { scope: "codex", error: "binary crashed" },
        ],
      })
    );
    expect(run.calls.at(-1)).toBe("report activated");
  });

  it("throws when only the activation failed", async () => {
    const run = aRunSync({
      claude: SYNTHETIC_TOOL,
      activation: {
        ...ACTIVATED_NOTHING,
        errors: [{ scope: "codex", error: "x" }],
        failed: true,
      },
    });

    await expect(run.useCase.execute(GIVEN, run.report)).rejects.toThrow(
      expect.objectContaining({ errors: [{ scope: "codex", error: "x" }] })
    );
  });
});

describe("RunSync of one tool", () => {
  it("restores the files and plugin asked, then activates only the tools restored", async () => {
    const run = aRunSync({ claude: SYNTHETIC_TOOL });

    await run.useCase.execute(
      { ...GIVEN, tool: "claude", plugin: "aidd-dev", files: ["a.md"], interactive: true },
      run.report
    );

    expect(run.calls).toEqual([
      "restoreTool",
      "report toolRestored",
      "syncSettings",
      "report activated",
    ]);
    expect(run.restoreToolCommands).toEqual([
      {
        projectRoot: "/project",
        toolId: "claude",
        files: ["a.md"],
        force: false,
        interactive: true,
        pluginName: "aidd-dev",
      },
    ]);
    expect(run.syncCommands).toEqual([
      { projectRoot: "/project", toolIds: [SYNTHETIC_TOOL], recreateFrameworkIfMissing: true },
    ]);
  });

  it("restores every drifted file when none is named", async () => {
    const run = aRunSync({ claude: SYNTHETIC_TOOL });

    await run.useCase.execute({ ...GIVEN, tool: "claude" }, run.report);

    expect(run.restoreToolCommands).toMatchObject([{ files: undefined }]);
  });

  it("throws when the activation failed", async () => {
    const run = aRunSync({
      claude: SYNTHETIC_TOOL,
      activation: {
        ...ACTIVATED_NOTHING,
        errors: [{ scope: "claude", error: "x" }],
        failed: true,
      },
    });

    await expect(run.useCase.execute({ ...GIVEN, tool: "claude" }, run.report)).rejects.toThrow(
      expect.objectContaining({ errors: [{ scope: "claude", error: "x" }] })
    );
  });
});
