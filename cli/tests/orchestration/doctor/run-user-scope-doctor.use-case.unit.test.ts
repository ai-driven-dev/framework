import { describe, expect, it } from "vitest";
import { ReadMachineInstallation } from "../../../src/contexts/installation/application/doctor/read-machine-installation.use-case.js";
import type { DoctorIssue } from "../../../src/contexts/installation/contract/doctor-issue.js";
import type { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RunUserScopeDoctor } from "../../../src/orchestration/doctor/run-user-scope-doctor.use-case.js";
import { UserScopeFilterUnsupportedError } from "../../../src/orchestration/orchestration.error.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { manifestRepositoryLoading } from "../../shared/testing/partial-ports.builder.js";
import { SYNTHETIC_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";

const ISSUES: DoctorIssue[] = [];

function aRun(machine: Manifest | null) {
  const checked: unknown[] = [];
  const seen: string[][] = [];
  const useCase = new RunUserScopeDoctor(
    new ReadMachineInstallation(manifestRepositoryLoading(async () => machine)),
    {
      execute: async (command) => {
        checked.push(command);
        return ISSUES;
      },
    }
  );
  const report = {
    registered: (view: { toolIds: readonly string[] }) => seen.push([...view.toolIds]),
  };
  return { useCase, report, checked, seen };
}

describe("RunUserScopeDoctor", () => {
  it("refuses a plugin filter before reading the machine", async () => {
    const run = aRun(aManifest().withTool(SYNTHETIC_TOOL, []).build());

    await expect(
      run.useCase.execute({ projectRoot: "/p", plugin: "aidd-dev" }, run.report)
    ).rejects.toThrow(new UserScopeFilterUnsupportedError("--plugin", "doctor --plugin <name>"));
    expect(run.seen).toEqual([]);
    expect(run.checked).toEqual([]);
  });

  it("answers null and checks nothing when nothing is registered", async () => {
    const run = aRun(null);

    expect(await run.useCase.execute({ projectRoot: "/p" }, run.report)).toBeNull();
    expect(run.checked).toEqual([]);
  });

  it("reports the machine, then checks every registration", async () => {
    const run = aRun(aManifest().withTool(SYNTHETIC_TOOL, []).build());

    expect(await run.useCase.execute({ projectRoot: "/p" }, run.report)).toBe(ISSUES);
    expect(run.seen).toEqual([[SYNTHETIC_TOOL]]);
    expect(run.checked).toEqual([{ projectRoot: "/p", allowedIds: null, globalInstall: true }]);
  });

  it("limits the check to the tool asked for", async () => {
    const run = aRun(aManifest().withTool(SYNTHETIC_TOOL, []).build());

    await run.useCase.execute({ projectRoot: "/p", tool: SYNTHETIC_TOOL }, run.report);

    expect(run.checked).toEqual([
      { projectRoot: "/p", allowedIds: new Set([SYNTHETIC_TOOL]), globalInstall: true },
    ]);
  });
});
